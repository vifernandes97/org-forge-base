import { servicePool } from '../db.js';
import { FILAS, fila } from './fila.js';
import type { ConexaoAtualizada, MensagemNormalizada } from './nucleo/tipos.js';
import { provedor, provedorExiste } from './provedores/index.js';

// Webhook dos provedores de canal: valida o token da conexão, normaliza,
// grava (idempotente) e enfileira. Nada de IA nem de chamada externa aqui —
// a resposta tem que sair rápido, senão o provedor reenvia e acumula.

interface Conexao {
  id: string;
  organization_id: string;
  provider: string;
  is_active: boolean;
}

const conexoes = new Map<string, { valor: Conexao | null; ate: number }>();

async function conexaoPorToken(token: string): Promise<Conexao | null> {
  const c = conexoes.get(token);
  if (c && c.ate > Date.now()) return c.valor;
  const { rows } = await servicePool().query<Conexao>(
    `select id, organization_id, provider, is_active from channel_connections where webhook_token = $1`, [token]);
  const valor = rows[0] ?? null;
  conexoes.set(token, { valor, ate: Date.now() + 30_000 });
  return valor;
}

/** Ao remover/desativar uma conexão, o webhook deixa de valer na hora neste processo. */
export const esquecerConexao = (token: string) => conexoes.delete(token);

async function gravarMensagem(con: Conexao, m: MensagemNormalizada): Promise<{ chatId: string; status: string } | null> {
  const pool = servicePool();
  const chat = await pool.query<{ id: string; status: string }>(
    `insert into channel_chats (organization_id, connection_id, remote_jid, phone_digits, push_name, last_message_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (connection_id, remote_jid) do update set
       phone_digits = coalesce(channel_chats.phone_digits, excluded.phone_digits),
       push_name = coalesce(excluded.push_name, channel_chats.push_name),
       last_message_at = greatest(channel_chats.last_message_at, excluded.last_message_at),
       updated_at = now()
     returning id, status`,
    [con.organization_id, con.id, m.remoteJid, m.phoneDigits, m.pushName, m.sentAt]);
  const { id: chatId, status } = chat.rows[0];

  const msg = await pool.query(
    `insert into channel_messages (organization_id, connection_id, chat_id, provider_message_id, from_me, message_type, body, media, sent_at, raw)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (connection_id, provider_message_id, sent_at) do nothing`,
    [con.organization_id, con.id, chatId, m.providerMessageId, m.fromMe, m.type, m.body, m.media, m.sentAt, m.raw]);
  if (!msg.rowCount) return null; // repetida
  await pool.query(`update channel_chats set message_count = message_count + 1 where id = $1`, [chatId]);
  return { chatId, status };
}

async function gravarConexao(con: Conexao, e: ConexaoAtualizada) {
  await servicePool().query(
    `update channel_connections set status = $2, status_detail = $3,
       phone_number = coalesce($4, phone_number), last_event_at = now(), updated_at = now()
     where id = $1`,
    [con.id, e.status, e.detail, e.phoneNumber]);
}

export async function receberWebhookCanal(providerName: string, token: string, req: Request): Promise<Response> {
  if (!provedorExiste(providerName)) return Response.json({ error: 'Provedor desconhecido' }, { status: 404 });
  const con = await conexaoPorToken(token);
  if (!con || con.provider !== providerName) return Response.json({ error: 'Conexão não encontrada' }, { status: 404 });
  // Desativada: 200 para o provedor não insistir, mas nada é gravado.
  if (!con.is_active) return Response.json({ ok: true, ignored: 'inactive' });

  const corpo = await req.json().catch(() => null);
  if (!corpo) return Response.json({ error: 'JSON inválido' }, { status: 400 });

  const eventos = provedor(providerName).parseWebhook(corpo);
  const vincular = new Set<string>();
  let novas = 0;
  for (const e of eventos) {
    if (e.kind === 'connection') {
      await gravarConexao(con, e);
      continue;
    }
    const r = await gravarMensagem(con, e);
    if (!r) continue;
    novas++;
    // Conversa ainda sem contato: tenta de novo a cada mensagem (o contato
    // pode ter sido cadastrado no CRM depois). Vinculada: a Fase 3 analisa.
    if (r.status === 'pending' || r.status === 'unmatched') vincular.add(r.chatId);
  }

  if (vincular.size) {
    const b = await fila();
    await Promise.all([...vincular].map((chatId) =>
      b.send(FILAS.vincularConversa, { chatId }, { singletonKey: chatId })));
  }
  return Response.json({ ok: true, events: eventos.length, stored: novas });
}
