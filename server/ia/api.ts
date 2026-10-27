import { Hono } from 'hono';
import { exigirAdmin } from '../acesso.js';
import { cifrar } from '../canais/cifra.js';
import { servicePool } from '../db.js';
import { credencial, ehModeloDeTranscricao, esquecerCredencial, listarModelos, urlBase, type ProvedorIa } from './credenciais.js';

// /api/ai — credenciais de IA da organização (Configurações → Inteligência
// artificial). A chave entra aqui, é testada (lista de modelos), cifrada e
// nunca volta. Ler a lista e escolher o modelo de cada tarefa é pelo
// PostgREST (ai_credentials sem a chave; org_ai_settings).

export const ia = new Hono();

const PROVEDORES: ProvedorIa[] = ['groq', 'openai', 'openai_compatible'];

const erro = (e: unknown, status = 400) => Response.json({ error: (e as Error).message }, { status });

async function credencialDoAdmin(req: Request, id: string) {
  const { rows } = await servicePool().query<{ organization_id: string }>(`select organization_id from ai_credentials where id = $1`, [id]);
  const acesso = await exigirAdmin(req, rows[0]?.organization_id ?? '00000000-0000-0000-0000-000000000000');
  if (acesso instanceof Response) return !rows[0] && acesso.status === 403 ? Response.json({ error: 'Credencial não encontrada' }, { status: 404 }) : acesso;
  return { organizationId: rows[0].organization_id };
}

ia.post('/credentials', async (c) => {
  const corpo = (await c.req.json().catch(() => ({}))) as {
    organization_id?: string; provider?: ProvedorIa; label?: string; base_url?: string | null; api_key?: string;
  };
  const acesso = await exigirAdmin(c.req.raw, corpo.organization_id);
  if (acesso instanceof Response) return acesso;

  const provider = corpo.provider;
  if (!provider || !PROVEDORES.includes(provider)) return c.json({ error: 'Provedor não suportado' }, 400);
  const apiKey = corpo.api_key?.trim();
  if (!apiKey || apiKey.length < 8) return c.json({ error: 'Cole a chave da API' }, 400);
  const baseCustom = provider === 'openai_compatible' ? corpo.base_url?.trim() || null : null;
  if (provider === 'openai_compatible' && !/^https?:\/\//.test(baseCustom ?? '')) return c.json({ error: 'URL base inválida' }, 400);

  let modelos: string[];
  try {
    modelos = await listarModelos(provider, urlBase(provider, baseCustom), apiKey);
  } catch (e) {
    return erro(e);
  }

  const label = corpo.label?.trim() || { groq: 'Groq', openai: 'OpenAI', openai_compatible: 'Compatível com OpenAI' }[provider as 'groq'];
  const { rows } = await servicePool().query<{ id: string }>(
    `insert into ai_credentials (organization_id, provider, label, base_url, api_key_enc, key_last4, status, last_checked_at, created_by)
     values ($1, $2, $3, $4, $5, $6, 'ok', now(), $7) returning id`,
    [corpo.organization_id, provider, label, baseCustom, cifrar(apiKey), apiKey.slice(-4), acesso.userId]);
  return c.json({ id: rows[0].id, models: modelos });
});

/** Modelos da credencial; ?task=transcription filtra os de áudio. Também revalida a chave. */
ia.get('/credentials/:id/models', async (c) => {
  const id = c.req.param('id');
  const r = await credencialDoAdmin(c.req.raw, id);
  if (r instanceof Response) return r;
  try {
    const cred = await credencial(id);
    let modelos = await listarModelos(cred.provider, cred.baseUrl, cred.apiKey);
    await servicePool().query(`update ai_credentials set status = 'ok', last_error = null, last_checked_at = now() where id = $1`, [id]);
    if (c.req.query('task') === 'transcription') modelos = modelos.filter(ehModeloDeTranscricao);
    return c.json({ models: modelos });
  } catch (e) {
    await servicePool().query(`update ai_credentials set status = 'error', last_error = $2, last_checked_at = now() where id = $1`,
      [id, (e as Error).message.slice(0, 300)]);
    return erro(e, 502);
  }
});

ia.delete('/credentials/:id', async (c) => {
  const id = c.req.param('id');
  const r = await credencialDoAdmin(c.req.raw, id);
  if (r instanceof Response) return r;
  // org_ai_settings aponta com "on delete set null": a tarefa fica sem credencial.
  await servicePool().query(`delete from ai_credentials where id = $1`, [id]);
  esquecerCredencial(id);
  return c.json({ ok: true });
});
