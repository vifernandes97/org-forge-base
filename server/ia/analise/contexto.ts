import { servicePool } from '../../db.js';
import type { Etapa } from '../../negocios/etapa.js';

// Tudo que a IA precisa ver de uma conversa: o lote novo de mensagens, um
// pouco do que veio antes, e os negócios candidatos com etapas, atividades e
// tarefas abertas.

export interface MensagemCtx {
  id: string;
  sent_at: Date;
  created_at: Date;
  from_me: boolean;
  message_type: string;
  body: string | null;
  transcript: string | null;
  media: Record<string, unknown> | null;
  raw: unknown;
}

export interface NegocioCtx {
  id: string;
  name: string;
  value: number;
  stage_id: string;
  funnel_id: string;
  funnel_name: string;
  assigned_to: string | null;
  empresa: string | null;
  contatos: string[];
  etapas: Etapa[];
  atividades: { activity_type: string; title: string; description: string | null; created_at: Date }[];
  tarefas: { title: string; due_date: Date }[];
}

export interface ConversaCtx {
  id: string;
  organization_id: string;
  connection_id: string;
  remote_jid: string;
  phone_digits: string | null;
  push_name: string | null;
  status: string;
  contact_id: string | null;
  lead_id: string | null;
  analyzed_until: Date | null;
  pending_since: Date | null;
  last_analysis_at: Date | null;
  // da conexão
  funnel_id: string | null;
  actor_user_id: string | null;
  server_id: string;
  provider: string;
  instance_name: string;
  org_name: string;
}

export async function conversa(chatId: string): Promise<ConversaCtx | null> {
  const { rows } = await servicePool().query<ConversaCtx>(
    `select ch.id, ch.organization_id, ch.connection_id, ch.remote_jid, ch.phone_digits, ch.push_name, ch.status,
            ch.contact_id, ch.lead_id, ch.analyzed_until, ch.pending_since, ch.last_analysis_at,
            c.funnel_id, c.actor_user_id, c.server_id, c.provider, c.instance_name, o.name as org_name
     from channel_chats ch
     join channel_connections c on c.id = ch.connection_id
     join organizations o on o.id = ch.organization_id
     where ch.id = $1`, [chatId]);
  return rows[0] ?? null;
}

const COLUNAS_MSG = `id, sent_at, created_at, from_me, message_type, body, transcript, media, raw`;

/** Lote novo (depois de analyzed_until) e o contexto anterior. */
export async function mensagens(chat: ConversaCtx, opts: { maxNovas: number; maxAnteriores: number; tudo?: boolean }) {
  const pool = servicePool();
  const corte = opts.tudo ? null : chat.analyzed_until;
  const novas = await pool.query<MensagemCtx>(
    `select ${COLUNAS_MSG} from channel_messages
     where chat_id = $1 and ($2::timestamptz is null or sent_at > $2) order by sent_at desc limit $3`,
    [chat.id, corte, opts.maxNovas]);
  const lote = novas.rows.reverse();
  const primeira = lote[0]?.sent_at ?? new Date();
  const anteriores = await pool.query<MensagemCtx>(
    `select ${COLUNAS_MSG} from channel_messages where chat_id = $1 and sent_at < $2 order by sent_at desc limit $3`,
    [chat.id, primeira, opts.maxAnteriores]);
  return { novas: lote, anteriores: anteriores.rows.reverse() };
}

/** O negócio vinculado, ou os negócios abertos do contato (até 5). */
export async function negociosCandidatos(chat: ConversaCtx): Promise<NegocioCtx[]> {
  const pool = servicePool();
  const ids: string[] = [];
  if (chat.lead_id) ids.push(chat.lead_id);
  if (chat.contact_id) {
    const { rows } = await pool.query<{ id: string }>(
      `select l.id from leads l
       where l.organization_id = $1 and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
         and (l.id in (select lead_id from lead_contacts where contact_id = $2) or l.id = (select lead_id from contacts where id = $2))
       order by l.last_activity_at desc nulls last limit 5`, [chat.organization_id, chat.contact_id]);
    for (const r of rows) if (!ids.includes(r.id)) ids.push(r.id);
  }
  if (!ids.length) return [];

  const { rows: leads } = await pool.query<Omit<NegocioCtx, 'etapas' | 'atividades' | 'tarefas' | 'contatos'>>(
    `select l.id, l.name, l.value, l.stage_id, l.funnel_id, f.name as funnel_name, l.assigned_to, co.trade_name as empresa
     from leads l join funnels f on f.id = l.funnel_id left join companies co on co.id = l.company_id
     where l.id = any($1) and l.archived_at is null and l.merged_into_lead_id is null`, [ids]);

  return Promise.all(leads.map(async (l) => {
    const [etapas, atividades, tarefas, contatos] = await Promise.all([
      pool.query<Etapa>(`select id, name, position, funnel_id, sla_hours, webhook_url from stages where funnel_id = $1 order by position`, [l.funnel_id]),
      pool.query(`select activity_type, title, description, created_at from lead_activities where lead_id = $1 order by created_at desc limit 10`, [l.id]),
      pool.query(`select title, due_date from tasks where lead_id = $1 and completed_at is null order by due_date limit 10`, [l.id]),
      pool.query<{ name: string }>(`select c.name from lead_contacts lc join contacts c on c.id = lc.contact_id where lc.lead_id = $1 order by lc.is_primary desc`, [l.id]),
    ]);
    return {
      ...l,
      value: Number(l.value) || 0,
      etapas: etapas.rows,
      atividades: atividades.rows.reverse(),
      tarefas: tarefas.rows,
      contatos: contatos.rows.map((c) => c.name).filter(Boolean),
    } as NegocioCtx;
  })).then((lista) => lista.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
}

/** Primeira etapa do funil da conexão (ou do funil padrão) para negócios novos. */
export async function etapaDeEntrada(organizationId: string, funnelId: string | null): Promise<Etapa | null> {
  const { rows } = await servicePool().query<Etapa>(
    `select s.id, s.name, s.position, s.funnel_id, s.sla_hours, s.webhook_url from stages s
     where s.funnel_id = coalesce($2, (select id from funnels where organization_id = $1 order by is_default desc, created_at limit 1))
     order by s.position limit 1`, [organizationId, funnelId]);
  return rows[0] ?? null;
}
