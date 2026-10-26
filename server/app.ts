import { Hono } from 'hono';
import { SignJWT } from 'jose';
import { auth } from './auth.js';

// O app inteiro atrás de um domínio só (crm.neosoluti.com.br):
//   /api/auth/*  Better Auth (login, sessão)
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

app.get('/health', (c) => c.json({ ok: true }));

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

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
