import { servicePool } from '../db.js';
import { cifrar, decifrar } from './cifra.js';
import type { ServidorCanal } from './nucleo/tipos.js';

// Servidores da plataforma: vêm do secrets.env e são gravados em
// channel_servers no primeiro uso, com a chave cifrada. Uma segunda Evolution
// (ou a de um cliente) entra como outra linha da tabela.
const NOME_PLATAFORMA = 'evolution-principal';
const NOME_CHATVOLT = 'chatvolt-principal';
const CHATVOLT_API = 'https://api.chatvolt.ai';

const sincronizados = new Map<string, Promise<string | null>>();

/** Grava/atualiza um servidor da plataforma (sem organização); devolve o id (nulo sem configuração). */
function sincronizar(provider: ServidorCanal['provider'], nome: string, baseUrl: string | undefined, apiKey: string | undefined): Promise<string | null> {
  let p = sincronizados.get(nome);
  if (p) return p;
  p = (async () => {
    if (!baseUrl || !apiKey) return null;
    const pool = servicePool();
    const atual = await pool.query<{ id: string; base_url: string; api_key_enc: string }>(
      `select id, base_url, api_key_enc from channel_servers where organization_id is null and name = $1`, [nome]);
    const linha = atual.rows[0];
    if (linha) {
      if (linha.base_url !== baseUrl || decifrar(linha.api_key_enc) !== apiKey) {
        await pool.query(`update channel_servers set base_url = $2, api_key_enc = $3, updated_at = now() where id = $1`,
          [linha.id, baseUrl, cifrar(apiKey)]);
      }
      return linha.id;
    }
    const novo = await pool.query<{ id: string }>(
      `insert into channel_servers (provider, name, base_url, api_key_enc) values ($1, $2, $3, $4) returning id`,
      [provider, nome, baseUrl, cifrar(apiKey)]);
    return novo.rows[0].id;
  })().catch((e) => {
    sincronizados.delete(nome);
    throw e;
  });
  sincronizados.set(nome, p);
  return p;
}

/** Evolution da plataforma: EVOLUTION_URL + EVOLUTION_API_KEY do secrets.env. */
export const servidorDaPlataforma = () => sincronizar('evolution', NOME_PLATAFORMA, process.env.EVOLUTION_URL, process.env.EVOLUTION_API_KEY);

/** Chatvolt: CHATVOLT_API_KEY do secrets.env (a mesma da pausa da IA e do painel). */
export const servidorChatvolt = () => sincronizar('chatvolt', NOME_CHATVOLT, CHATVOLT_API, process.env.CHATVOLT_API_KEY);

const cache = new Map<string, { valor: ServidorCanal; ate: number }>();

export async function servidor(id: string): Promise<ServidorCanal> {
  const c = cache.get(id);
  if (c && c.ate > Date.now()) return c.valor;
  const { rows } = await servicePool().query<{ id: string; provider: ServidorCanal['provider']; base_url: string; api_key_enc: string; is_active: boolean }>(
    `select id, provider, base_url, api_key_enc, is_active from channel_servers where id = $1`, [id]);
  const r = rows[0];
  if (!r) throw new Error('Servidor de canal não encontrado');
  if (!r.is_active) throw new Error('Servidor de canal desativado');
  const valor: ServidorCanal = { id: r.id, provider: r.provider, baseUrl: r.base_url, apiKey: decifrar(r.api_key_enc) };
  cache.set(id, { valor, ate: Date.now() + 60_000 });
  return valor;
}

/**
 * URL que o provedor chama. A Evolution, pela rede interna da VPS (ex.:
 * http://crm-app:3000); o Chatvolt está fora dela, pelo endereço público.
 */
export function urlDoWebhook(provider: string, token: string): string {
  const interna = provider === 'chatvolt' ? '' : process.env.CHANNEL_WEBHOOK_BASE_URL;
  const base = (interna || process.env.BETTER_AUTH_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('CHANNEL_WEBHOOK_BASE_URL não definida');
  return `${base}/api/channels/${provider}/${token}`;
}
