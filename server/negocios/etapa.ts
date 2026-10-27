import { servicePool } from '../db.js';
import { enviarWebhook } from '../webhook-saida.js';

// Mudar a etapa de um negócio pelo servidor, com o mesmo efeito do Kanban
// (src/components/leads/kanban/KanbanView.tsx): atividade stage_change,
// tarefa de SLA da etapa e webhook da etapa. Os gatilhos do banco fazem o
// resto (stage_entered_at, tarefas/webhooks/automações da etapa).

export interface Etapa {
  id: string;
  name: string;
  position: number;
  funnel_id: string;
  sla_hours: number | null;
  webhook_url: string | null;
}

interface Movimento {
  leadId: string;
  de: Etapa;
  para: Etapa;
  /** Autor da atividade e da tarefa de SLA (o dono do número, na IA). */
  userId: string;
  quem: string;
  motivo: string | null;
  metadata: Record<string, unknown>;
}

/** Devolve false se o negócio já não estava na etapa de origem (alguém mexeu antes). */
export async function moverEtapa(m: Movimento): Promise<boolean> {
  const pool = servicePool();
  const { rows } = await pool.query<{ organization_id: string; name: string; assigned_to: string | null; priority: string; value: number; tags: string[]; source: string | null }>(
    `update leads set stage_id = $2 where id = $1 and stage_id = $3
     returning organization_id, name, assigned_to, priority, value, tags, source`,
    [m.leadId, m.para.id, m.de.id]);
  const lead = rows[0];
  if (!lead) return false;

  await pool.query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, $3, 'stage_change', $4, $5, $6)`,
    [lead.organization_id, m.leadId, m.userId, `Moveu de ${m.de.name} para ${m.para.name}`, m.motivo,
      { from_stage_id: m.de.id, from_stage_name: m.de.name, to_stage_id: m.para.id, to_stage_name: m.para.name, ...m.metadata }]);

  if (m.para.sla_hours) {
    await pool.query(
      `insert into tasks (organization_id, lead_id, assigned_to, title, task_type, due_date, priority)
       values ($1, $2, $3, $4, 'follow_up', now() + make_interval(hours => $5), $6)`,
      [lead.organization_id, m.leadId, lead.assigned_to || m.userId, `Follow-up: ${lead.name}`, m.para.sla_hours, lead.priority || 'medium']);
  }

  if (m.para.webhook_url) {
    // Formato do buildWebhookPayload do Kanban; o enrichPayload completa
    // empresa, contatos, campos personalizados e nomes.
    const { rows: org } = await pool.query<{ name: string }>(`select name from organizations where id = $1`, [lead.organization_id]);
    enviarWebhook({
      webhook_url: m.para.webhook_url,
      payload: {
        event: 'lead.stage_changed',
        timestamp: new Date().toISOString(),
        lead: { id: m.leadId, value: lead.value || 0, tags: lead.tags || [], priority: lead.priority || 'medium', source: lead.source },
        transition: {
          previous_stage: { id: m.de.id, name: m.de.name },
          new_stage: { id: m.para.id, name: m.para.name },
          funnel: { id: m.para.funnel_id },
          moved_by: { id: m.userId, name: m.quem },
          moved_at: new Date().toISOString(),
        },
        organization: { id: lead.organization_id, name: org[0]?.name ?? '' },
      },
      organization_id: lead.organization_id,
      stage_id: m.para.id,
      lead_id: m.leadId,
    }).catch((e) => console.error('[etapa] webhook da etapa', e));
  }
  return true;
}
