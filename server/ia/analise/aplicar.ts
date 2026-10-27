import { servicePool } from '../../db.js';
import { moverEtapa } from '../../negocios/etapa.js';
import { notificar, notificarNovoLead } from '../../notificacoes.js';
import { servico } from '../../servico.js';
import { enviarWebhook } from '../../webhook-saida.js';
import { etapaDeEntrada, negociosCandidatos, type ConversaCtx, type NegocioCtx } from './contexto.js';
import type { Decisao } from './decisao.js';

// A IA propõe, a política decide (docs/WHATSAPP.md §6). Cada proposta vira uma
// linha em ai_actions com o estado: applied, pending (autonomia "suggest"),
// skipped (a política barrou, com o motivo). Em teste (dryRun) nada é gravado.

export interface Politica {
  autonomy: 'auto' | 'suggest';
  stage_min_confidence: number;
  stage_back_min_confidence: number;
  create_leads: boolean;
}

export interface Acao {
  type: 'note' | 'stage_change' | 'task' | 'field_update' | 'create_lead' | 'classify';
  lead_id: string | null;
  payload: Record<string, unknown>;
  confidence: number | null;
  state: 'applied' | 'pending' | 'skipped';
  reason: string | null;
  before?: unknown;
  after?: unknown;
}

const TAREFAS_MAX = 3;
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function autorPadrao(chat: ConversaCtx, negocio: NegocioCtx | null): Promise<string> {
  if (chat.actor_user_id) return chat.actor_user_id;
  if (negocio?.assigned_to) return negocio.assigned_to;
  const { rows } = await servicePool().query<{ user_id: string }>(
    `select user_id from organization_members where organization_id = $1 order by (role = 'owner') desc, created_at limit 1`, [chat.organization_id]);
  return rows[0]?.user_id;
}

/** Quem recebe o aviso de que a IA mexeu no negócio: o responsável, ou owners/admins. */
async function avisar(chat: ConversaCtx, negocio: NegocioCtx | null, title: string, body: string | null) {
  let userIds = negocio?.assigned_to ? [negocio.assigned_to] : [];
  if (!userIds.length) {
    const { rows } = await servicePool().query<{ user_id: string }>(
      `select user_id from organization_members where organization_id = $1 and role in ('owner','admin')`, [chat.organization_id]);
    userIds = rows.map((r) => r.user_id);
  }
  await notificar({ organizationId: chat.organization_id, userIds, type: 'ai_update', title, body, leadId: negocio?.id ?? null })
    .catch((e) => console.error('[ia] notificar', e));
}

/** Negócio novo a partir de uma conversa comercial sem negócio (regras do AGENTS.md). */
async function criarNegocio(chat: ConversaCtx, d: NonNullable<Decisao['novo_negocio']>, autor: string): Promise<{ leadId: string; contactId: string | null; companyId: string }> {
  const contato = d.contato?.trim() || chat.push_name || null;
  const res = await servico.rpc('resolve_company_contact', {
    p_org: chat.organization_id,
    p_trade_name: d.empresa?.trim() || null,
    p_contact_name: contato,
    p_email: d.email?.trim() || null,
    p_phone: chat.phone_digits ? `+${chat.phone_digits}` : null,
  });
  if (res.error || !res.data?.company_id) throw new Error(`resolve_company_contact: ${res.error?.message ?? 'sem empresa'}`);
  const r = res.data as { company_id: string; contact_id: string | null };

  const etapa = await etapaDeEntrada(chat.organization_id, chat.funnel_id);
  if (!etapa) throw new Error('A organização não tem funil com etapas');
  const pool = servicePool();
  const { rows } = await pool.query<{ id: string }>(
    `insert into leads (organization_id, funnel_id, stage_id, company_id, value, source, assigned_to, tags, priority, stage_entered_at)
     values ($1, $2, $3, $4, 0, 'whatsapp', $5, '{}', 'medium', now()) returning id`,
    [chat.organization_id, etapa.funnel_id, etapa.id, r.company_id, chat.actor_user_id]);
  const leadId = rows[0].id;
  if (r.contact_id) {
    await pool.query(`insert into lead_contacts (organization_id, lead_id, contact_id, is_primary) values ($1, $2, $3, true)`,
      [chat.organization_id, leadId, r.contact_id]);
  }
  await pool.query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, $3, 'note', 'Lead captado pelo WhatsApp', $4, $5)`,
    [chat.organization_id, leadId, autor, `Conversa com ${contato ?? 'contato'}${chat.phone_digits ? ` (+${chat.phone_digits})` : ''}`,
      { source: 'whatsapp_ai', chat_id: chat.id }]);
  // Igual ao webhook de entrada: webhook e SLA da etapa de entrada.
  if (etapa.webhook_url) {
    enviarWebhook({
      webhook_url: etapa.webhook_url,
      payload: { event: 'lead.created', timestamp: new Date().toISOString(), lead: { id: leadId, source: 'whatsapp' }, organization: { id: chat.organization_id } },
      organization_id: chat.organization_id, stage_id: etapa.id, lead_id: leadId,
    }).catch(() => undefined);
  }
  if (etapa.sla_hours) {
    await pool.query(
      `insert into tasks (organization_id, lead_id, assigned_to, title, description, task_type, due_date, priority)
       values ($1, $2, $3, $4, $5, 'follow_up', now() + make_interval(hours => $6), 'medium')`,
      [chat.organization_id, leadId, chat.actor_user_id || autor, `Follow-up: ${contato ?? 'WhatsApp'}`, `SLA de ${etapa.sla_hours}h para a etapa "${etapa.name}"`, etapa.sla_hours]);
  }
  await pool.query(
    `update channel_chats set lead_id = $2, contact_id = coalesce($3, contact_id), status = 'linked', matched_by = 'ai_created', updated_at = now() where id = $1`,
    [chat.id, leadId, r.contact_id]);
  notificarNovoLead({ organizationId: chat.organization_id, leadId, companyId: r.company_id, contactName: contato })
    .catch((e) => console.error('[ia] notificarNovoLead', e));
  return { leadId, contactId: r.contact_id, companyId: r.company_id };
}

export async function aplicarDecisao(opts: {
  decisao: Decisao;
  politica: Politica;
  chat: ConversaCtx;
  candidatos: NegocioCtx[];
  analysisId: string | null;
  mensagens: number;
  dryRun: boolean;
}): Promise<Acao[]> {
  const { decisao: d, politica: pol, chat, candidatos, dryRun } = opts;
  const acoes: Acao[] = [];
  const pool = servicePool();
  const auto = pol.autonomy === 'auto';
  const meta = { source: 'whatsapp_ai', analysis_id: opts.analysisId, chat_id: chat.id };

  // 1. Qual negócio: o escolhido pela IA (se for candidato), senão o vinculado.
  let negocio = candidatos.find((c) => c.id === d.lead_id) ?? candidatos[0] ?? null;

  if (!negocio) {
    if (!d.comercial) {
      acoes.push({ type: 'classify', lead_id: null, payload: { comercial: false }, confidence: null, state: 'applied', reason: 'Conversa não comercial: ignorada' });
      if (!dryRun) await pool.query(`update channel_chats set status = 'ignored', updated_at = now() where id = $1 and lead_id is null`, [chat.id]);
      return acoes;
    }
    const proposta = d.novo_negocio ?? { empresa: null, contato: null, email: null };
    if (!pol.create_leads) {
      acoes.push({ type: 'create_lead', lead_id: null, payload: proposta, confidence: null, state: 'skipped', reason: 'Criar negócio de número desconhecido está desligado' });
      return acoes;
    }
    if (!auto) {
      acoes.push({ type: 'create_lead', lead_id: null, payload: proposta, confidence: null, state: 'pending', reason: null });
      return acoes;
    }
    if (dryRun) {
      acoes.push({ type: 'create_lead', lead_id: null, payload: proposta, confidence: null, state: 'applied', reason: null });
      return acoes;
    }
    const autor = await autorPadrao(chat, null);
    const novo = await criarNegocio(chat, proposta, autor);
    acoes.push({ type: 'create_lead', lead_id: novo.leadId, payload: proposta, confidence: null, state: 'applied', reason: null, after: novo });
    const [criado] = await negociosCandidatos({ ...chat, lead_id: novo.leadId, contact_id: novo.contactId });
    negocio = criado ?? null;
    if (!negocio) return acoes;
  } else if (!dryRun && chat.lead_id !== negocio.id) {
    await pool.query(`update channel_chats set lead_id = $2, status = 'linked', updated_at = now() where id = $1`, [chat.id, negocio.id]);
  }

  const autor = await autorPadrao(chat, negocio);

  // 2. Resumo na linha do tempo (sempre automático: só registra).
  if (d.resumo.trim()) {
    acoes.push({ type: 'note', lead_id: negocio.id, payload: { resumo: d.resumo.trim() }, confidence: null, state: 'applied', reason: null });
    if (!dryRun) {
      await pool.query(
        `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
         values ($1, $2, $3, 'whatsapp', 'Conversa no WhatsApp', $4, $5)`,
        [chat.organization_id, negocio.id, autor, d.resumo.trim(), { ...meta, mensagens: opts.mensagens }]);
    }
  }

  // 3. Etapa: mesmo funil, confiança mínima (maior para voltar), nunca a atual.
  if (d.mudar_etapa) {
    const conf = Math.max(0, Math.min(1, d.mudar_etapa.confianca));
    const de = negocio.etapas.find((e) => e.id === negocio!.stage_id);
    const para = negocio.etapas.find((e) => e.id === d.mudar_etapa!.etapa_id);
    const base: Omit<Acao, 'state' | 'reason'> = {
      type: 'stage_change', lead_id: negocio.id, confidence: conf,
      payload: { para: para?.name ?? d.mudar_etapa.etapa_id, para_id: d.mudar_etapa.etapa_id, motivo: d.mudar_etapa.motivo },
      before: de ? { stage_id: de.id, stage_name: de.name } : null,
    };
    const voltando = !!de && !!para && para.position < de.position;
    const minimo = voltando ? pol.stage_back_min_confidence : pol.stage_min_confidence;
    if (!para || !de) acoes.push({ ...base, state: 'skipped', reason: 'Etapa fora do funil do negócio' });
    else if (para.id === de.id) acoes.push({ ...base, state: 'skipped', reason: 'Já está nesta etapa' });
    else if (conf < minimo) acoes.push({ ...base, state: 'skipped', reason: `Confiança ${conf.toFixed(2)} abaixo de ${minimo}${voltando ? ' (voltar etapa)' : ''}` });
    else if (!auto) acoes.push({ ...base, state: 'pending', reason: null });
    else if (dryRun) acoes.push({ ...base, state: 'applied', reason: null, after: { stage_id: para.id, stage_name: para.name } });
    else {
      const ok = await moverEtapa({
        leadId: negocio.id, de, para, userId: autor, quem: 'IA (WhatsApp)',
        motivo: `IA pelo WhatsApp (confiança ${Math.round(conf * 100)}%): ${d.mudar_etapa.motivo}`,
        metadata: { ...meta, confidence: conf },
      });
      acoes.push({ ...base, state: ok ? 'applied' : 'skipped', reason: ok ? null : 'O negócio mudou de etapa antes da IA', after: { stage_id: para.id, stage_name: para.name } });
      if (ok) await avisar(chat, negocio, `IA moveu ${negocio.empresa || negocio.name || 'negócio'} para ${para.name}`, d.mudar_etapa.motivo);
    }
  }

  // 4. Tarefas: até 3, sem repetir as abertas.
  const abertas = new Set(negocio.tarefas.map((t) => normalizar(t.title)));
  for (const t of d.tarefas.slice(0, TAREFAS_MAX)) {
    const titulo = t.titulo.trim().slice(0, 200);
    const prazo = Math.max(0, Math.min(90, Math.round(t.prazo_dias)));
    const base = { type: 'task' as const, lead_id: negocio.id, confidence: null, payload: { titulo, descricao: t.descricao, prazo_dias: prazo, tipo: t.tipo } };
    if (!titulo || abertas.has(normalizar(titulo))) { acoes.push({ ...base, state: 'skipped', reason: 'Tarefa igual já aberta' }); continue; }
    abertas.add(normalizar(titulo));
    acoes.push({ ...base, state: 'applied', reason: null });
    if (!dryRun) {
      await pool.query(
        `insert into tasks (organization_id, lead_id, assigned_to, title, description, task_type, due_date, priority)
         values ($1, $2, $3, $4, $5, $6, (current_date + $7::int) + time '18:00', 'medium')`,
        [chat.organization_id, negocio.id, negocio.assigned_to || autor, titulo, t.descricao, t.tipo, prazo]);
    }
  }

  // 5. Valor do negócio.
  if (d.valor && d.valor.valor > 0) {
    const conf = Math.max(0, Math.min(1, d.valor.confianca));
    const base = { type: 'field_update' as const, lead_id: negocio.id, confidence: conf, payload: { campo: 'value', valor: d.valor.valor, motivo: d.valor.motivo }, before: { value: negocio.value } };
    if (d.valor.valor === negocio.value) acoes.push({ ...base, state: 'skipped', reason: 'Valor igual ao atual' });
    else if (conf < pol.stage_min_confidence) acoes.push({ ...base, state: 'skipped', reason: `Confiança ${conf.toFixed(2)} abaixo de ${pol.stage_min_confidence}` });
    else if (!auto) acoes.push({ ...base, state: 'pending', reason: null });
    else {
      acoes.push({ ...base, state: 'applied', reason: null, after: { value: d.valor.valor } });
      if (!dryRun) {
        await pool.query(`update leads set value = $2 where id = $1`, [negocio.id, d.valor.valor]);
        await pool.query(
          `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
           values ($1, $2, $3, 'field_update', 'Valor atualizado pela IA (WhatsApp)', $4, $5)`,
          [chat.organization_id, negocio.id, autor, `value: "${negocio.value}" → "${d.valor.valor}". ${d.valor.motivo}`,
            { ...meta, changes: [{ field: 'value', old_value: negocio.value, new_value: d.valor.valor }] }]);
      }
    }
  }

  return acoes;
}
