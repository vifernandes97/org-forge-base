import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { exigirAdmin } from '../acesso.js';
import { servicePool } from '../db.js';
import { esquecerConexao, receberWebhookCanal } from './ingestao.js';
import { provedor } from './provedores/index.js';
import { servidor, servidorDaPlataforma, urlDoWebhook } from './servidores.js';

// Rotas dos canais:
//   POST /api/channels/:provider/:token   webhook do provedor (público; o token é a credencial)
//   /api/channels/connections…            tela de Configurações → WhatsApp (sessão + owner/admin)
// Ler conexões e conversas é pelo PostgREST (RLS); aqui fica só o que mexe na
// Evolution ou no token.

export const canais = new Hono();

canais.post('/:provider/:token', (c) => receberWebhookCanal(c.req.param('provider'), c.req.param('token'), c.req.raw));

interface LinhaConexao {
  id: string;
  organization_id: string;
  server_id: string;
  provider: string;
  instance_name: string;
  webhook_token: string;
  managed: boolean;
}

async function conexaoDoAdmin(req: Request, id: string): Promise<{ con: LinhaConexao } | Response> {
  const { rows } = await servicePool().query<LinhaConexao>(
    `select id, organization_id, server_id, provider, instance_name, webhook_token, managed from channel_connections where id = $1`, [id]);
  const con = rows[0];
  // Mesmo 404 para "não existe" e "é de outra organização".
  const acesso = await exigirAdmin(req, con?.organization_id ?? '00000000-0000-0000-0000-000000000000');
  if (acesso instanceof Response) return acesso.status === 403 && !con ? Response.json({ error: 'Conexão não encontrada' }, { status: 404 }) : acesso;
  if (!con) return Response.json({ error: 'Conexão não encontrada' }, { status: 404 });
  return { con };
}

const erro = (e: unknown, status = 502) => Response.json({ error: (e as Error).message }, { status });

const NOME_INSTANCIA = /^[A-Za-z0-9_-]{3,64}$/;

canais.post('/connections', async (c) => {
  const corpo = (await c.req.json().catch(() => ({}))) as {
    organization_id?: string; display_name?: string; instance_name?: string; existing?: boolean; funnel_id?: string | null;
  };
  const acesso = await exigirAdmin(c.req.raw, corpo.organization_id);
  if (acesso instanceof Response) return acesso;

  const displayName = corpo.display_name?.trim();
  if (!displayName) return c.json({ error: 'Dê um nome à conexão' }, 400);
  const existente = !!corpo.existing;
  const instanceName = existente
    ? corpo.instance_name?.trim() ?? ''
    : `crm-${corpo.organization_id!.slice(0, 8)}-${randomBytes(3).toString('hex')}`;
  if (!NOME_INSTANCIA.test(instanceName)) return c.json({ error: 'Nome de instância inválido (letras, números, - e _)' }, 400);

  let serverId: string | null;
  try {
    serverId = await servidorDaPlataforma();
  } catch (e) {
    return erro(e, 500);
  }
  if (!serverId) return c.json({ error: 'Servidor da Evolution não configurado (EVOLUTION_URL / EVOLUTION_API_KEY)' }, 503);

  const pool = servicePool();
  const token = randomBytes(24).toString('base64url');
  // Grava antes de falar com a Evolution: o primeiro evento já encontra o token.
  let id: string;
  try {
    const ins = await pool.query<{ id: string }>(
      `insert into channel_connections (organization_id, server_id, provider, instance_name, display_name, webhook_token, managed, actor_user_id, funnel_id)
       values ($1, $2, 'evolution', $3, $4, $5, $6, $7, $8) returning id`,
      [corpo.organization_id, serverId, instanceName, displayName, token, !existente, acesso.userId, corpo.funnel_id ?? null]);
    id = ins.rows[0].id;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return c.json({ error: 'Essa instância já está ligada a uma conexão' }, 409);
    return erro(e, 500);
  }

  try {
    const srv = await servidor(serverId);
    const p = provedor('evolution');
    const url = urlDoWebhook('evolution', token);
    await p.ensureInstance(srv, instanceName, { create: !existente, webhookUrl: url });
    await p.setWebhook(srv, instanceName, url);
    const st = await p.status(srv, instanceName).catch(() => null);
    if (st) await pool.query(`update channel_connections set status = $2, phone_number = $3, updated_at = now() where id = $1`, [id, st.status, st.phoneNumber]);
  } catch (e) {
    await pool.query(`delete from channel_connections where id = $1`, [id]);
    return erro(e);
  }
  return c.json({ id });
});

canais.post('/connections/:id/connect', async (c) => {
  const r = await conexaoDoAdmin(c.req.raw, c.req.param('id'));
  if (r instanceof Response) return r;
  try {
    const out = await provedor(r.con.provider).connect(await servidor(r.con.server_id), r.con.instance_name);
    await servicePool().query(`update channel_connections set status = $2, updated_at = now() where id = $1`, [r.con.id, out.status]);
    return c.json(out);
  } catch (e) {
    return erro(e);
  }
});

canais.post('/connections/:id/refresh', async (c) => {
  const r = await conexaoDoAdmin(c.req.raw, c.req.param('id'));
  if (r instanceof Response) return r;
  try {
    const p = provedor(r.con.provider);
    const srv = await servidor(r.con.server_id);
    const st = await p.status(srv, r.con.instance_name);
    // Reaplica o webhook: conserta instância que perdeu a configuração.
    await p.setWebhook(srv, r.con.instance_name, urlDoWebhook(r.con.provider, r.con.webhook_token));
    await servicePool().query(
      `update channel_connections set status = $2, phone_number = coalesce($3, phone_number), status_detail = null, updated_at = now() where id = $1`,
      [r.con.id, st.status, st.phoneNumber]);
    return c.json(st);
  } catch (e) {
    return erro(e);
  }
});

canais.delete('/connections/:id', async (c) => {
  const r = await conexaoDoAdmin(c.req.raw, c.req.param('id'));
  if (r instanceof Response) return r;
  const { con } = r;
  try {
    const p = provedor(con.provider);
    const srv = await servidor(con.server_id);
    // Criada por nós: apaga a instância. Já existia: só solta o webhook.
    if (con.managed) await p.removeInstance(srv, con.instance_name);
    else await p.setWebhook(srv, con.instance_name, null);
  } catch (e) {
    // Evolution fora do ar não impede remover aqui; o token some e o webhook passa a dar 404.
    console.warn('[canais] remover na Evolution falhou', con.instance_name, (e as Error).message);
  }
  const pool = servicePool();
  await pool.query(`delete from channel_messages where connection_id = $1`, [con.id]);
  await pool.query(`delete from channel_connections where id = $1`, [con.id]);
  esquecerConexao(con.webhook_token);
  return c.json({ ok: true });
});
