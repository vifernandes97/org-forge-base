import type { IncomingMessage, ServerResponse } from 'node:http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../server/auth.js';

// /api/auth/* — login, sessão, /token (JWT da Data API) e /jwks (que o Neon lê).
// Fora do Next, a Vercel não casa [...all] com mais de um segmento: o
// vercel.json reescreve /api/auth/<caminho> para cá com ?__rota=<caminho>, e
// a URL original é reconstruída antes de entregar ao Better Auth.
const handler = toNodeHandler(auth);

export default function (req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  const rota = url.searchParams.get('__rota');
  if (rota !== null) {
    url.searchParams.delete('__rota');
    req.url = `/api/auth/${rota}${url.search}`;
  }
  return handler(req, res);
}
