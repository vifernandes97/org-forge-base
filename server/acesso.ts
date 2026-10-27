import { auth } from './auth.js';
import { servicePool } from './db.js';

/** Rotas de configuração (canais, IA): exige sessão e papel owner/admin na organização. */
export async function exigirAdmin(req: Request, organizationId: string | undefined): Promise<{ userId: string } | Response> {
  const sessao = await auth.api.getSession({ headers: req.headers });
  if (!sessao?.user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  if (!organizationId) return Response.json({ error: 'organization_id obrigatório' }, { status: 400 });
  const { rows } = await servicePool().query<{ role: string }>(
    `select role from organization_members where organization_id = $1 and user_id = $2`, [organizationId, sessao.user.id]);
  if (!['owner', 'admin'].includes(rows[0]?.role ?? '')) return Response.json({ error: 'Só owner ou admin' }, { status: 403 });
  return { userId: sessao.user.id };
}
