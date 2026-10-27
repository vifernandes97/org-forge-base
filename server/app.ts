import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { auth } from './auth.js';
import { servico } from './servico.js';
import { receberWebhook } from './webhook-entrada.js';
import { enviarWebhook } from './webhook-saida.js';
import { chavePublicaVapid, removerInscricao, salvarInscricao } from './notificacoes.js';
import { canais } from './canais/api.js';

// O app inteiro atrás de um domínio só (crm.neosoluti.com.br):
//   /api/auth/*  Better Auth (login, sessão)
//   /api/inbound-webhook, /api/fire-webhook  webhooks (server/webhook-*.ts)
//   /api/push/*  Web Push: chave pública VAPID e inscrição do aparelho
//   /api/channels/*  WhatsApp (Evolution): webhook e conexões (server/canais/api.ts)
//   /rest/*      portão do PostgREST: confere a sessão e repassa com um JWT de
//                60 s (HS256, segredo compartilhado só com o PostgREST, que não
//                é exposto). Sem sessão, vai sem token e o PostgREST usa anon.
//   /health
// O estático (front) entra em server/index.ts; no dev, quem serve é o Vite.

const PGRST_URL = process.env.PGRST_URL ?? 'http://localhost:3000';
const jwtSecret = () => {
  const s = process.env.PGRST_JWT_SECRET;
  if (!s || s.length < 32) throw new Error('PGRST_JWT_SECRET ausente ou curta (mínimo 32)');
  return new TextEncoder().encode(s);
};

// O que o postgrest-js manda e o PostgREST lê; o resto (cookie, origin…) fica.
const HEADERS_PARA_O_REST = ['accept', 'content-type', 'prefer', 'range', 'range-unit', 'accept-profile', 'content-profile'];
const HEADERS_DE_VOLTA = ['content-type', 'content-range', 'content-location', 'location', 'preference-applied'];

export const app = new Hono();

// GIT_SHA vem do Easypanel em runtime: é o que scripts/deploy.sh espera ver.
app.get('/health', (c) => c.json({ ok: true, commit: process.env.GIT_SHA ?? null }));

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// Webhook de entrada (formulários, Oniplataforma, n8n): público, a chave do
// inbound_webhooks é a credencial. O Traefik põe o IP real em x-forwarded-for.
app.on(['POST', 'OPTIONS'], '/api/inbound-webhook', (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || null;
  return receberWebhook(c.req.raw, ip);
});

// Webhook da etapa disparado pelo Kanban (supabase.functions.invoke('fire-webhook')).
// Antes era aberto a qualquer um com a anon key, para qualquer URL. Agora: só
// com sessão, de quem é da organização, e só para a URL cadastrada na etapa.
app.post('/api/fire-webhook', async (c) => {
  const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessao?.user) return c.json({ error: 'Não autenticado' }, 401);

  const corpo = await c.req.json().catch(() => null);
  const { webhook_url, payload, organization_id, stage_id, lead_id } = corpo ?? {};
  if (!webhook_url || !payload || !organization_id || !stage_id) return c.json({ error: 'Missing required fields' }, 400);

  const [membro, etapa] = await Promise.all([
    servico.from('organization_members').select('id').eq('organization_id', organization_id).eq('user_id', sessao.user.id).maybeSingle(),
    servico.from('stages').select('webhook_url').eq('id', stage_id).eq('organization_id', organization_id).maybeSingle(),
  ]);
  if (!membro.data) return c.json({ error: 'Sem acesso a esta organização' }, 403);
  if (!etapa.data || etapa.data.webhook_url !== webhook_url) return c.json({ error: 'URL não é a do webhook desta etapa' }, 403);

  return c.json(await enviarWebhook({ webhook_url, payload, organization_id, stage_id, lead_id }));
});

app.route('/api/channels', canais);

app.get('/api/push/vapid-public-key', (c) => c.json({ key: chavePublicaVapid() }));

app.post('/api/push/subscribe', async (c) => {
  const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessao?.user) return c.json({ error: 'Não autenticado' }, 401);
  try {
    await salvarInscricao(sessao.user.id, await c.req.json(), c.req.header('user-agent') ?? null);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

app.post('/api/push/unsubscribe', async (c) => {
  const sessao = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!sessao?.user) return c.json({ error: 'Não autenticado' }, 401);
  const { endpoint } = (await c.req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await removerInscricao(sessao.user.id, endpoint);
  return c.json({ ok: true });
});

app.all('/rest/*', async (c) => {
  const req = c.req.raw;
  const headers = new Headers();
  for (const h of HEADERS_PARA_O_REST) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }

  const sessao = await auth.api.getSession({ headers: req.headers });
  if (sessao?.user) {
    const token = await new SignJWT({ role: 'authenticated', email: sessao.user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sessao.user.id)
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(jwtSecret());
    headers.set('authorization', `Bearer ${token}`);
  }

  const url = new URL(req.url);
  const destino = PGRST_URL + url.pathname.replace(/^\/rest/, '') + url.search;
  const temCorpo = req.method !== 'GET' && req.method !== 'HEAD';
  const res = await fetch(destino, {
    method: req.method,
    headers,
    body: temCorpo ? await req.arrayBuffer() : undefined,
  });

  const volta = new Headers();
  for (const h of HEADERS_DE_VOLTA) {
    const v = res.headers.get(h);
    if (v) volta.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: volta });
});
