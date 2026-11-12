import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { servicePool } from '../db.js';
import { notificar } from '../notificacoes.js';
import { moverEtapa, type Etapa } from '../negocios/etapa.js';
import { phoneMatchKey } from '../canais/identificacao/telefone.js';

// Ferramentas HTTP do agente Lara (Chatvolt, número 0573 da Oniplataforma).
// Piloto: a Lara chama o CRM durante a conversa para registrar a qualificação e
// para passar o lead a uma pessoa. A etapa muda só pelo moverEtapa (SLA e
// webhook da etapa), só para a frente e nunca para Engajamento.
//
//   POST /api/agente/chatvolt/qualificacao   Authorization: Bearer <CHATVOLT_AGENTE_TOKEN>
//   POST /api/agente/chatvolt/humano         idem
//
// Configuração (secrets.env): CHATVOLT_AGENTE_TOKEN (≥ 32 caracteres) e
// CHATVOLT_AGENTE_ORG (id da organização). Sem as duas, as rotas respondem 503.
// Lead não achado responde 200 com ok:false: a Lara segue a conversa.
//
// Handoff: com CHATVOLT_API_KEY e o campo conversa_id ({conversation-id} do
// Chatvolt), /humano põe a conversa em "Humano Solicitado" pela API do Chatvolt
// (a IA para de responder), mesmo que o lead não esteja no CRM. Isso substitui a
// ferramenta nativa "Solicitar Humano", que transfere sem seguir o prompt.

export const ETAPA_IA = 'Atendimento IA';
export const ETAPA_HUMANO = 'Atendimento Humano';
const PROIBIDA = 'engajamento';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const texto = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');

export const MOTIVOS = ['demo', 'preco', 'pessoa', 'cliente', 'reclamacao', 'duvida', 'outro'] as const;
export type Motivo = (typeof MOTIVOS)[number];

/** Etapa de destino se o negócio ainda está antes dela; nulo para não mexer (nunca volta, nunca Engajamento). */
export function etapaParaFrente(etapas: Etapa[], atualId: string, nome: string): Etapa | null {
  const atual = etapas.find((e) => e.id === atualId);
  const alvo = etapas.find((e) => normalizar(e.name) === normalizar(nome));
  if (!atual || !alvo || normalizar(alvo.name) === PROIBIDA) return null;
  return alvo.position > atual.position ? alvo : null;
}

const QUALIFICACAO: [string, string][] = [
  ['tipo_negocio', 'Tipo de negócio'],
  ['eventos_mes', 'Eventos por mês'],
  ['cidade', 'Cidade'],
  ['controle_atual', 'Como controla hoje'],
  ['maior_dor', 'Maior dor'],
];

export function textoQualificacao(c: Record<string, unknown>): string {
  const linhas = QUALIFICACAO.map(([k, rotulo]) => [rotulo, texto(c[k])] as const).filter(([, v]) => v).map(([r, v]) => `${r}: ${v}`);
  const resumo = texto(c.resumo, 1500);
  return [resumo, ...linhas].filter(Boolean).join('\n');
}

export function motivoValido(v: unknown): Motivo {
  const m = normalizar(texto(v)) as Motivo;
  return MOTIVOS.includes(m) ? m : 'outro';
}

/** Título da tarefa do handoff; nulo quando é cliente (vai para o suporte, sem mexer no funil comercial). */
export function tarefaDoHandoff(motivo: Motivo, detalhe: string, demoDia: string, demoPeriodo: string): string {
  if (motivo === 'demo') {
    const quando = [demoDia, demoPeriodo].filter(Boolean).join(', ');
    return `Confirmar horário da demo${quando ? `: ${quando}` : ''}`;
  }
  if (motivo === 'cliente') return 'Cliente da Oni no 0573: encaminhar ao suporte';
  return `Assumir conversa no Chatvolt${detalhe ? `: ${detalhe}` : ''}`.slice(0, 200);
}

const CHATVOLT_API = 'https://api.chatvolt.ai';

/** Põe a conversa em "Humano Solicitado" no Chatvolt. Falha não derruba o handoff. */
export async function pausarIaChatvolt(conversaId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const chave = process.env.CHATVOLT_API_KEY ?? '';
  if (!chave || !/^[a-z0-9]{10,40}$/i.test(conversaId)) return false;
  try {
    const r = await fetchImpl(`${CHATVOLT_API}/conversations/${conversaId}/set-status`, {
      method: 'POST',
      headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'HUMAN_REQUESTED' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('[agente] chatvolt set-status', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('[agente] chatvolt set-status', e);
    return false;
  }
}

function autorizado(header: string | undefined): boolean {
  const esperado = process.env.CHATVOLT_AGENTE_TOKEN ?? '';
  const recebido = (header ?? '').replace(/^Bearer\s+/i, '');
  if (esperado.length < 32 || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

interface Negocio {
  id: string;
  organization_id: string;
  name: string;
  stage_id: string;
  funnel_id: string;
  assigned_to: string | null;
}

/** Negócio aberto mais recente do contato com esse telefone (mesma regra de vincular.ts). */
async function negocioPorTelefone(orgId: string, telefone: string): Promise<Negocio | null> {
  const chave = phoneMatchKey(telefone);
  if (!chave) return null;
  const { rows } = await servicePool().query<Negocio>(
    `select l.id, l.organization_id, l.name, l.stage_id, l.funnel_id, l.assigned_to
     from contacts c
     join leads l on l.organization_id = c.organization_id
       and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
       and (l.id in (select lc.lead_id from lead_contacts lc where lc.contact_id = c.id) or l.id = c.lead_id)
     where c.organization_id = $1 and c.phone_key = $2
     order by l.last_activity_at desc nulls last
     limit 4`, [orgId, chave]);
  // Mais de 3 contatos/negócios com o mesmo telefone é placeholder, não pessoa.
  return rows.length && rows.length <= 3 ? rows[0] : null;
}

async function autor(n: Negocio): Promise<string> {
  if (n.assigned_to) return n.assigned_to;
  const pool = servicePool();
  const { rows } = await pool.query<{ user_id: string }>(
    `select actor_user_id as user_id from channel_connections where organization_id = $1 and actor_user_id is not null and is_active order by created_at limit 1`,
    [n.organization_id]);
  if (rows[0]) return rows[0].user_id;
  const { rows: m } = await pool.query<{ user_id: string }>(
    `select user_id from organization_members where organization_id = $1 order by (role = 'owner') desc, created_at limit 1`, [n.organization_id]);
  return m[0]?.user_id;
}

async function etapas(funnelId: string): Promise<Etapa[]> {
  const { rows } = await servicePool().query<Etapa>(
    `select id, name, position, funnel_id, sla_hours, webhook_url from stages where funnel_id = $1 order by position`, [funnelId]);
  return rows;
}

async function nota(n: Negocio, userId: string, titulo: string, descricao: string, metadata: object) {
  await servicePool().query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, $3, 'note', $4, $5, $6)`,
    [n.organization_id, n.id, userId, titulo, descricao || null, { origem: 'chatvolt_lara', ...metadata }]);
}

async function mover(n: Negocio, userId: string, nomeEtapa: string, motivo: string): Promise<string | null> {
  const lista = await etapas(n.funnel_id);
  const para = etapaParaFrente(lista, n.stage_id, nomeEtapa);
  const de = lista.find((e) => e.id === n.stage_id);
  if (!para || !de) return null;
  const ok = await moverEtapa({ leadId: n.id, de, para, userId, quem: 'Bia (IA, Chatvolt)', motivo, metadata: { origem: 'chatvolt_lara' } });
  return ok ? para.name : null;
}

type Resposta = { ok: boolean; mensagem: string; etapa?: string | null };

async function preparar(req: Request): Promise<{ orgId: string; corpo: Record<string, unknown> } | Response> {
  const orgId = process.env.CHATVOLT_AGENTE_ORG;
  if (!orgId || !process.env.CHATVOLT_AGENTE_TOKEN) return Response.json({ ok: false, mensagem: 'Integração não configurada' }, { status: 503 });
  if (!autorizado(req.headers.get('authorization') ?? undefined)) return Response.json({ ok: false, mensagem: 'Não autorizado' }, { status: 401 });
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return { orgId, corpo: corpo && typeof corpo === 'object' ? corpo : {} };
}

const naoAchado: Resposta = { ok: false, mensagem: 'Lead não encontrado no CRM. Continue a conversa normalmente.' };

export const agenteChatvolt = new Hono();

agenteChatvolt.post('/qualificacao', async (c) => {
  const p = await preparar(c.req.raw);
  if (p instanceof Response) return p;
  const n = await negocioPorTelefone(p.orgId, texto(p.corpo.telefone, 40));
  if (!n) return c.json(naoAchado);
  const userId = await autor(n);
  const descricao = textoQualificacao(p.corpo);
  await nota(n, userId, 'Qualificação pela Bia (IA)', descricao, { campos: p.corpo });
  const etapa = await mover(n, userId, ETAPA_IA, 'Lead conversando com a Bia (IA) no 0573');
  return c.json({ ok: true, mensagem: 'Qualificação registrada no CRM.', etapa } satisfies Resposta);
});

agenteChatvolt.post('/humano', async (c) => {
  const p = await preparar(c.req.raw);
  if (p instanceof Response) return p;
  const pausada = await pausarIaChatvolt(texto(p.corpo.conversa_id, 60));
  const fim = pausada ? ' A conversa já está com a equipe: avise o lead em uma frase e pare de responder.' : '';
  const n = await negocioPorTelefone(p.orgId, texto(p.corpo.telefone, 40));
  if (!n) return c.json({ ok: pausada, mensagem: `Lead não encontrado no CRM.${fim || ' Continue a conversa normalmente.'}` } satisfies Resposta);
  const userId = await autor(n);
  const motivo = motivoValido(p.corpo.motivo);
  const detalhe = texto(p.corpo.detalhe, 300);
  const demoDia = texto(p.corpo.demo_dia, 60);
  const demoPeriodo = texto(p.corpo.demo_periodo, 30);
  const resumo = texto(p.corpo.resumo, 1500);
  const titulo = tarefaDoHandoff(motivo, detalhe, demoDia, demoPeriodo);
  const descricao = [resumo, detalhe && `Motivo: ${detalhe}`, 'Responder pelo Chatvolt (número 0573).'].filter(Boolean).join('\n');
  const pool = servicePool();

  await nota(n, userId, 'Bia (IA) passou para humano', descricao, { motivo, demo_dia: demoDia || null, demo_periodo: demoPeriodo || null, ia_pausada: pausada });
  const etapa = motivo === 'cliente' ? null : await mover(n, userId, ETAPA_HUMANO, `Bia (IA) passou para humano: ${motivo}${detalhe ? `, ${detalhe}` : ''}`);

  // Tarefa para hoje, sem repetir uma aberta com o mesmo título.
  const { rows: abertas } = await pool.query(
    `select 1 from tasks where lead_id = $1 and title = $2 and completed_at is null limit 1`, [n.id, titulo]);
  if (!abertas.length) {
    await pool.query(
      `insert into tasks (organization_id, lead_id, assigned_to, title, description, task_type, due_date, priority)
       values ($1, $2, $3, $4, $5, 'follow_up', ((now() at time zone 'America/Sao_Paulo')::date + time '23:59') at time zone 'America/Sao_Paulo', 'high')`,
      [n.organization_id, n.id, userId, titulo, descricao]);
  }

  let userIds = n.assigned_to ? [n.assigned_to] : [];
  if (!userIds.length) {
    const { rows } = await pool.query<{ user_id: string }>(
      `select user_id from organization_members where organization_id = $1 and role in ('owner','admin')`, [n.organization_id]);
    userIds = rows.map((r) => r.user_id);
  }
  await notificar({ organizationId: n.organization_id, userIds, type: 'ai_update', title: `Bia passou ${n.name} para humano`, body: titulo, leadId: n.id })
    .catch((e) => console.error('[agente] notificar', e));

  return c.json({ ok: true, mensagem: `Equipe avisada no CRM.${fim}`, etapa } satisfies Resposta);
});
