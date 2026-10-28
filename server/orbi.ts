import { Hono } from 'hono';
import { exigirAdmin } from './acesso.js';
import { cifrar, decifrar } from './canais/cifra.js';
import { servicePool } from './db.js';
import { assinaturaValida } from './orbi-assinatura.js';

// Integração com o Orbi (docs/ORBI.md). Tarefa de tipo com action
// 'orbi_meeting' entra na fila pelo trigger de db/66 (external_status =
// 'queued'); este módulo manda o pedido de reunião, cancela os que sumiram e
// recebe o retorno assinado (aceito/recusado) que conclui a tarefa.
//
//   POST   /api/orbi/config            owner/admin: grava chave e segredo (testa antes)
//   DELETE /api/orbi/config            owner/admin: desliga e apaga a credencial
//   POST   /api/orbi/retorno/:orgId    o Orbi avisa (X-Orbi-Signature)

const FUSO = 'America/Sao_Paulo';
const MAX_TENTATIVAS = 8;
const ESPERAS_MIN = [1, 5, 15, 60, 240, 480, 720];

const proxima = (tentativas: number) =>
  new Date(Date.now() + ESPERAS_MIN[Math.min(tentativas - 1, ESPERAS_MIN.length - 1)] * 60_000);

/** URL que o Orbi chama de volta (cadastrada na integração, lá). */
export function urlDoRetorno(orgId: string) {
  const base = (process.env.BETTER_AUTH_URL || 'https://crm.neosoluti.com.br').replace(/\/+$/, '');
  return `${base}/api/orbi/retorno/${orgId}`;
}

type Credencial = { baseUrl: string; chave: string };

async function credencial(orgId: string): Promise<Credencial | null> {
  const { rows } = await servicePool().query<{ base_url: string; api_key_enc: string }>(
    `select base_url, api_key_enc from org_orbi_integrations where organization_id = $1 and enabled`, [orgId]);
  if (!rows[0]) return null;
  return { baseUrl: rows[0].base_url.replace(/\/+$/, ''), chave: decifrar(rows[0].api_key_enc) };
}

const chamarOrbi = (c: Credencial, metodo: string, caminho: string, corpo?: unknown) =>
  fetch(`${c.baseUrl}/api/integrations/inbound/requests${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${c.chave}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

async function marcarIntegracao(orgId: string, erro: string | null) {
  await servicePool().query(
    erro
      ? `update org_orbi_integrations set last_error = $2, updated_at = now() where organization_id = $1`
      : `update org_orbi_integrations set last_error = null, last_ok_at = now() where organization_id = $1`,
    erro ? [orgId, erro.slice(0, 300)] : [orgId]);
}

type TarefaParaEnvio = {
  id: string; organization_id: string; lead_id: string; title: string; description: string | null;
  data: string; hora: string; email: string | null; subtipo: string | null; external_attempts: number;
  empresa: string | null; contato: string | null; telefone: string | null; contato_email: string | null; etapa: string | null;
};

async function montar(taskId: string): Promise<TarefaParaEnvio | null> {
  const { rows } = await servicePool().query<TarefaParaEnvio>(
    `select t.id, t.organization_id, t.lead_id, t.title, t.description, t.external_attempts,
            to_char(t.due_date at time zone $2, 'YYYY-MM-DD') as data,
            to_char(t.due_date at time zone $2, 'HH24:MI') as hora,
            p.email, st.label as subtipo, co.trade_name as empresa,
            ct.name as contato, ct.phone as telefone, ct.email as contato_email, s.name as etapa
       from tasks t
       join leads l on l.id = t.lead_id
       left join profiles p on p.id = t.assigned_to
       left join task_subtypes st on st.id = t.task_subtype_id
       left join companies co on co.id = l.company_id
       left join stages s on s.id = l.stage_id
       left join lateral (
         select c.name, c.phone, c.email from lead_contacts lc join contacts c on c.id = lc.contact_id
          where lc.lead_id = l.id order by lc.is_primary desc limit 1) ct on true
      where t.id = $1`, [taskId, FUSO]);
  return rows[0] ?? null;
}

async function falhar(t: { id: string; external_attempts: number }, erro: string, definitivo: boolean) {
  const tentativas = t.external_attempts + 1;
  const desistir = definitivo || tentativas >= MAX_TENTATIVAS;
  await servicePool().query(
    `update tasks set external_status = $2, external_error = $3, external_attempts = $4, external_next_at = $5
      where id = $1 and external_status = 'queued'`,
    [t.id, desistir ? 'failed' : 'queued', erro.slice(0, 500), tentativas, desistir ? null : proxima(tentativas)]);
}

/** Manda uma tarefa da fila. O externalId é o id da tarefa: reenviar atualiza o mesmo pedido. */
async function enviar(taskId: string) {
  const t = await montar(taskId);
  if (!t) return;
  let cred: Credencial | null;
  try {
    cred = await credencial(t.organization_id);
  } catch (e) {
    return falhar(t, `credencial do Orbi ilegível: ${(e as Error).message}`, true);
  }
  if (!cred) return falhar(t, 'integração com o Orbi desligada', true);
  if (!t.email) return falhar(t, 'a tarefa não tem responsável com e-mail', true);

  const crm = (process.env.BETTER_AUTH_URL || 'https://crm.neosoluti.com.br').replace(/\/+$/, '');
  const contexto = {
    ...(t.empresa ? { company: t.empresa } : {}),
    ...(t.contato || t.telefone || t.contato_email
      ? { contact: { ...(t.contato ? { name: t.contato } : {}), ...(t.telefone ? { phone: t.telefone } : {}), ...(t.contato_email ? { email: t.contato_email } : {}) } }
      : {}),
    ...(t.etapa ? { stage: t.etapa } : {}),
    crmUrl: `${crm}/?lead=${t.lead_id}`,
  };
  const corpo = {
    kind: 'meeting',
    externalId: t.id,
    assigneeEmail: t.email,
    title: t.title.slice(0, 500),
    ...(t.subtipo ? { subtype: t.subtipo.slice(0, 120) } : {}),
    ...(t.description ? { description: t.description.slice(0, 5000) } : {}),
    date: t.data,
    time: t.hora,
    durationMinutes: 60,
    timezone: FUSO,
    context: contexto,
  };

  let r: Response;
  try {
    r = await chamarOrbi(cred, 'POST', '', corpo);
  } catch (e) {
    return falhar(t, `Orbi fora do ar (${(e as Error).message})`, false);
  }
  const resposta = (await r.json().catch(() => ({}))) as { id?: string; status?: string; seriesId?: string | null; url?: string; error?: string };
  if (r.ok) {
    await marcarIntegracao(t.organization_id, null);
    // Normalmente 'pending'; se já foi decidido lá, o retorno (ou este estado) fecha.
    const status = ['pending', 'accepted', 'rejected', 'cancelled'].includes(resposta.status ?? '') ? resposta.status : 'pending';
    await servicePool().query(
      `update tasks set external_status = $2, external_request_id = $3, external_url = $4, external_ref_id = coalesce($5, external_ref_id),
              external_error = null, external_attempts = 0, external_next_at = null
        where id = $1 and external_status = 'queued'`,
      [t.id, status, resposta.id ?? null, resposta.url ?? null, resposta.seriesId ?? null]);
    return;
  }
  const msg = resposta.error || `HTTP ${r.status}`;
  if (r.status === 401 || r.status === 403) await marcarIntegracao(t.organization_id, msg);
  // 4xx (fora 429) não melhora repetindo: dado inválido ou credencial.
  return falhar(t, msg, r.status >= 400 && r.status < 500 && r.status !== 429);
}

async function cancelar(c: { id: string; organization_id: string; task_id: string; attempts: number }) {
  const apagar = () => servicePool().query(`delete from orbi_cancels where id = $1`, [c.id]);
  let cred: Credencial | null = null;
  try {
    cred = await credencial(c.organization_id);
  } catch { /* sem credencial legível: não há como cancelar */ }
  if (!cred) return apagar();
  try {
    const r = await chamarOrbi(cred, 'DELETE', `/${encodeURIComponent(c.task_id)}`);
    // 204 cancelado; 404 nunca chegou; 409 já decidido lá (o retorno conta o que houve).
    if (r.ok || r.status === 404 || r.status === 409) return apagar();
    throw new Error(`HTTP ${r.status}`);
  } catch (e) {
    const tentativas = c.attempts + 1;
    if (tentativas >= MAX_TENTATIVAS) return apagar();
    await servicePool().query(`update orbi_cancels set attempts = $2, next_at = $3, last_error = $4 where id = $1`,
      [c.id, tentativas, proxima(tentativas), (e as Error).message.slice(0, 300)]);
  }
}

/** Uma rodada: reserva os vencidos (2 min) para duas réplicas não mandarem o mesmo. */
export async function despacharOrbi(): Promise<number> {
  const { rows } = await servicePool().query<{ id: string }>(
    `update tasks set external_next_at = now() + interval '2 minutes'
      where id in (select id from tasks where external_status = 'queued' and external_next_at <= now()
                    order by external_next_at limit 20 for update skip locked)
      returning id`);
  for (const { id } of rows) await enviar(id).catch((e) => console.error('[orbi] envio falhou:', e));

  const cancelamentos = await servicePool().query<{ id: string; organization_id: string; task_id: string; attempts: number }>(
    `update orbi_cancels set next_at = now() + interval '2 minutes'
      where id in (select id from orbi_cancels where next_at <= now() order by next_at limit 20 for update skip locked)
      returning id, organization_id, task_id, attempts`);
  for (const c of cancelamentos.rows) await cancelar(c).catch((e) => console.error('[orbi] cancelamento falhou:', e));
  return rows.length + cancelamentos.rows.length;
}

/** Cron simples, como a fila de webhooks: a cada 15 s. */
export function iniciarFilaDoOrbi(intervaloMs = 15_000) {
  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const n = await despacharOrbi();
      if (n) console.log(`[orbi] ${n} pedido(s) processado(s)`);
    } catch (e) {
      console.error('[orbi] fila falhou:', e);
    } finally {
      rodando = false;
    }
  }, intervaloMs);
}

type Retorno = {
  event?: string; externalId?: string; status?: string; seriesId?: string | null; date?: string; time?: string | null;
  title?: string; decidedByEmail?: string | null; rejectReason?: string | null; url?: string;
};

const dataBr = (d?: string) => (d ? d.split('-').reverse().join('/') : '');

async function aplicarRetorno(orgId: string, r: Retorno) {
  if (!r.externalId || !['request.accepted', 'request.rejected'].includes(r.event ?? '')) return;
  const aceito = r.event === 'request.accepted';
  const { rows } = await servicePool().query<{ id: string; lead_id: string; assigned_to: string; title: string }>(
    aceito
      ? `update tasks set external_status = 'accepted', external_ref_id = $3, external_url = coalesce($4, external_url),
                external_error = null, external_next_at = null, completed_at = coalesce(completed_at, now())
          where id::text = $1 and organization_id = $2 and external_status is distinct from 'accepted'
          returning id, lead_id, assigned_to, title`
      : `update tasks set external_status = 'rejected', external_error = $3, external_url = coalesce($4, external_url), external_next_at = null
          where id::text = $1 and organization_id = $2 and external_status is distinct from 'rejected'
          returning id, lead_id, assigned_to, title`,
    [r.externalId, orgId, aceito ? r.seriesId ?? null : r.rejectReason ?? null, r.url ?? null]);
  const t = rows[0];
  if (!t) return; // tarefa apagada ou retorno repetido
  const quando = `${dataBr(r.date)}${r.time ? ` às ${r.time}` : ''}`;
  await servicePool().query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [orgId, t.lead_id, t.assigned_to, aceito ? 'task_completed' : 'note',
      aceito ? `Reunião cadastrada no Orbi: ${r.title ?? t.title}` : `Reunião recusada no Orbi: ${t.title}`,
      aceito ? `Para ${quando}${r.decidedByEmail ? `, confirmada por ${r.decidedByEmail}` : ''}.`
        : `${r.decidedByEmail ? `Recusada por ${r.decidedByEmail}` : 'Recusada'}${r.rejectReason ? `: ${r.rejectReason}` : '.'}`,
      { source: 'orbi', task_id: t.id, orbi_series_id: r.seriesId ?? null, orbi_url: r.url ?? null }]);
}

export const orbi = new Hono();

orbi.post('/retorno/:orgId', async (c) => {
  const orgId = c.req.param('orgId');
  const corpo = await c.req.text();
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return c.json({ error: 'organização inválida' }, 404);
  const { rows } = await servicePool().query<{ callback_secret_enc: string }>(
    `select callback_secret_enc from org_orbi_integrations where organization_id = $1`, [orgId]);
  if (!rows[0]) return c.json({ error: 'integração não configurada' }, 404);
  let segredo: string;
  try {
    segredo = decifrar(rows[0].callback_secret_enc);
  } catch {
    return c.json({ error: 'segredo ilegível' }, 500);
  }
  if (!assinaturaValida(segredo, c.req.header('x-orbi-timestamp'), c.req.header('x-orbi-signature'), corpo)) {
    return c.json({ error: 'assinatura inválida' }, 401);
  }
  let r: Retorno;
  try {
    r = JSON.parse(corpo) as Retorno;
  } catch {
    return c.json({ error: 'JSON inválido' }, 400);
  }
  await aplicarRetorno(orgId, r);
  return c.json({ ok: true });
});

orbi.post('/config', async (c) => {
  const corpo = (await c.req.json().catch(() => ({}))) as {
    organization_id?: string; base_url?: string; api_key?: string; callback_secret?: string;
  };
  const acesso = await exigirAdmin(c.req.raw, corpo.organization_id);
  if (acesso instanceof Response) return acesso;
  const baseUrl = (corpo.base_url?.trim() || 'https://orbi.neosoluti.com.br').replace(/\/+$/, '');
  const chave = corpo.api_key?.trim() ?? '';
  const segredo = corpo.callback_secret?.trim() ?? '';
  if (!/^https?:\/\//.test(baseUrl)) return c.json({ error: 'URL do Orbi inválida' }, 400);
  if (!chave.startsWith('orbi_int_')) return c.json({ error: 'Cole a chave da integração (começa com orbi_int_)' }, 400);
  if (!segredo.startsWith('orbi_whsec_')) return c.json({ error: 'Cole o segredo de assinatura (começa com orbi_whsec_)' }, 400);

  // Testa a chave: um pedido que não existe dá 404 com chave boa, 401/403 com chave ruim.
  try {
    const r = await chamarOrbi({ baseUrl, chave }, 'GET', '/teste-de-conexao-crm');
    if (r.status !== 404) {
      const e = (await r.json().catch(() => ({}))) as { error?: string };
      return c.json({ error: e.error || `O Orbi recusou a chave (HTTP ${r.status})` }, 400);
    }
  } catch (e) {
    return c.json({ error: `Não foi possível falar com o Orbi: ${(e as Error).message}` }, 502);
  }

  await servicePool().query(
    `insert into org_orbi_integrations (organization_id, base_url, api_key_enc, key_last4, callback_secret_enc, enabled, created_by, last_ok_at)
     values ($1, $2, $3, $4, $5, true, $6, now())
     on conflict (organization_id) do update set base_url = excluded.base_url, api_key_enc = excluded.api_key_enc,
       key_last4 = excluded.key_last4, callback_secret_enc = excluded.callback_secret_enc, enabled = true,
       last_error = null, last_ok_at = now(), updated_at = now()`,
    [corpo.organization_id, baseUrl, cifrar(chave), chave.slice(-4), cifrar(segredo), acesso.userId]);
  return c.json({ ok: true });
});

orbi.delete('/config', async (c) => {
  const orgId = c.req.query('organization_id');
  const acesso = await exigirAdmin(c.req.raw, orgId);
  if (acesso instanceof Response) return acesso;
  await servicePool().query(`delete from org_orbi_integrations where organization_id = $1`, [orgId]);
  return c.json({ ok: true });
});
