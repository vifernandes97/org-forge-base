import { servicePool } from '../db.js';
import { cifrar, decifrar } from './cifra.js';
import type { ServidorCanal } from './nucleo/tipos.js';

// Servidor da plataforma: vem do secrets.env (EVOLUTION_URL + EVOLUTION_API_KEY)
// e é gravado em channel_servers na subida, com a chave cifrada. Uma segunda
// Evolution (ou a de um cliente) entra como outra linha da tabela.
const NOME_PLATAFORMA = 'evolution-principal';

let sincronizado: Promise<string | null> | null = null;

/** Grava/atualiza o servidor da plataforma; devolve o id (nulo sem configuração). */
export function servidorDaPlataforma(): Promise<string | null> {
  sincronizado ??= (async () => {
    const baseUrl = process.env.EVOLUTION_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    if (!baseUrl || !apiKey) return null;
    const pool = servicePool();
    const atual = await pool.query<{ id: string; base_url: string; api_key_enc: string }>(
      `select id, base_url, api_key_enc from channel_servers where organization_id is null and name = $1`, [NOME_PLATAFORMA]);
    const linha = atual.rows[0];
    if (linha) {
      if (linha.base_url !== baseUrl || decifrar(linha.api_key_enc) !== apiKey) {
        await pool.query(`update channel_servers set base_url = $2, api_key_enc = $3, updated_at = now() where id = $1`,
          [linha.id, baseUrl, cifrar(apiKey)]);
      }
      return linha.id;
    }
    const novo = await pool.query<{ id: string }>(
      `insert into channel_servers (provider, name, base_url, api_key_enc) values ('evolution', $1, $2, $3) returning id`,
      [NOME_PLATAFORMA, baseUrl, cifrar(apiKey)]);
    return novo.rows[0].id;
  })().catch((e) => {
    sincronizado = null;
    throw e;
  });
  return sincronizado;
}

const cache = new Map<string, { valor: ServidorCanal; ate: number }>();

export async function servidor(id: string): Promise<ServidorCanal> {
  const c = cache.get(id);
  if (c && c.ate > Date.now()) return c.valor;
  const { rows } = await servicePool().query<{ id: string; provider: 'evolution'; base_url: string; api_key_enc: string; is_active: boolean }>(
    `select id, provider, base_url, api_key_enc, is_active from channel_servers where id = $1`, [id]);
  const r = rows[0];
  if (!r) throw new Error('Servidor de canal não encontrado');
  if (!r.is_active) throw new Error('Servidor de canal desativado');
  const valor: ServidorCanal = { id: r.id, provider: r.provider, baseUrl: r.base_url, apiKey: decifrar(r.api_key_enc) };
  cache.set(id, { valor, ate: Date.now() + 60_000 });
  return valor;
}

/** URL que o provedor chama. Na VPS, pela rede interna (ex.: http://crm-app:3000). */
export function urlDoWebhook(provider: string, token: string): string {
  const base = (process.env.CHANNEL_WEBHOOK_BASE_URL || process.env.BETTER_AUTH_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('CHANNEL_WEBHOOK_BASE_URL não definida');
  return `${base}/api/channels/${provider}/${token}`;
}
