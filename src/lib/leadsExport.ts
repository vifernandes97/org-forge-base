import { formatCnpj } from '@/lib/cnpj';
import { format } from 'date-fns';
import type { CustomFieldDefinition } from '@/types';
import type { CustomFieldValueMap } from './leadClientFilters';

const STATUS_LABELS: Record<string, string> = {
  open: 'Em andamento',
  won: 'Ganho',
  inactive: 'Arquivado',
  lost: 'Perdido',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const ACTIVITY_LABELS: Record<string, string> = {
  company_merge: 'Empresa mesclada',
  note: 'Nota',
  stage_change: 'Mudança de etapa',
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  task: 'Tarefa',
  whatsapp: 'WhatsApp',
  created: 'Criação',
  archived: 'Arquivamento',
  unarchived: 'Reativação',
  merge: 'Mesclagem',
  import: 'Importação',
};

function dt(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : format(d, 'dd/MM/yyyy HH:mm');
}

function formatCustomValue(field: CustomFieldDefinition, raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return '';
  switch (field.field_type) {
    case 'date': {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? raw : format(d, 'dd/MM/yyyy');
    }
    case 'checkbox':
      return ['true', '1', 'sim', 'yes'].includes(raw.toLowerCase()) ? 'Sim' : 'Não';
    case 'multi_select':
      return raw
        .split(/[;,]/)
        .map(p => p.trim())
        .filter(Boolean)
        .join('; ');
    default:
      return raw;
  }
}

export function buildLeadRows(
  leads: any[],
  activitiesByLead: Record<string, any[]>,
  customFields: CustomFieldDefinition[],
  cfMap: CustomFieldValueMap
): Record<string, unknown>[] {
  return leads.map(l => {
    const contact = primaryContact(l);
    const activities = activitiesByLead[l.id] || [];
    const notes = activities
      .filter(a => a.activity_type === 'note')
      .map(a => `[${dt(a.created_at)}] ${a.description || a.title || ''}`.trim())
      .join(' | ');

    const row: Record<string, unknown> = {
      ID: l.id,
      Empresa: l.company?.trade_name || '',
      Segmento: l.company?.segment_ref?.label || '',
      'Razão social': l.company?.legal_name || '',
      CNPJ: l.company?.cnpj ? formatCnpj(l.company.cnpj) : '',
      Instagram: l.company?.instagram || '',
      'Nome do contato': contact?.name || '',
      'E-mail': contact?.email || '',
      Telefone: contact?.phone || '',
      'Outros contatos': otherContacts(l),
      Valor: l.value ?? 0,
      Prioridade: PRIORITY_LABELS[l.priority] || l.priority || '',
      'Qualificação': l.qualification ?? '',
      Fonte: l.source || '',
      Tags: (l.tags || []).join('; '),
      Funil: l.funnel?.name || '',
      Etapa: l.stage?.name || '',
      'Responsável': l.assigned_profile?.full_name || '',
      Status: STATUS_LABELS[l.status] || l.status || '',
      Notas: l.notes || '',
      'Motivo de arquivamento': l.archive_reason?.label || '',
      'Detalhes do arquivamento': (l as any).archive_details || '',
      'Arquivado em': dt(l.archived_at),
      'Mesclado em': dt(l.merged_at),
      'Mesclado no negócio': l.merged_into_lead_id || '',
      'Criado em': dt(l.created_at),
      'Atualizado em': dt(l.updated_at),
      'Última atividade': dt(l.last_activity_at),
      'Entrou na etapa em': dt(l.stage_entered_at),
      'Registros no histórico': activities.length,
      'Notas do histórico': notes,
    };

    for (const f of customFields) {
      row[f.field_label] = formatCustomValue(f, cfMap[l.id]?.[f.id]);
    }
    return row;
  });
}

export function buildActivityRows(leads: any[], activities: any[]): Record<string, unknown>[] {
  const leadById: Record<string, any> = {};
  leads.forEach(l => { leadById[l.id] = l; });
  return activities
    .filter(a => leadById[a.lead_id])
    .sort((a, b) => {
      if (a.lead_id !== b.lead_id) return a.lead_id < b.lead_id ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .map(a => {
      const l = leadById[a.lead_id];
      const contact = primaryContact(l);
      return {
        'ID do negócio': l.id,
        Empresa: l.company?.trade_name || '',
        Segmento: l.company?.segment_ref?.label || '',
        'Razão social': l.company?.legal_name || '',
        'Nome do contato': contact?.name || '',
        'Data/hora': dt(a.created_at),
        Tipo: ACTIVITY_LABELS[a.activity_type] || a.activity_type || '',
        'Tipo (técnico)': a.activity_type || '',
        'Título': a.title || '',
        'Conteúdo': a.description || '',
        Autor: a.user?.full_name || a.user?.email || '',
      };
    });
}

/** Primary contact of a deal via lead_contacts (falls back to first linked contact). */
function primaryContact(l: any): any {
  const links: any[] = Array.isArray(l.lead_contacts) ? l.lead_contacts : [];
  return (links.find(x => x.is_primary) || links[0])?.contact;
}

function otherContacts(l: any): string {
  const links: any[] = Array.isArray(l.lead_contacts) ? l.lead_contacts : [];
  return links
    .filter(x => !x.is_primary && x.contact)
    .map(x => [x.contact.name, x.contact.email, x.contact.phone].filter(Boolean).join(' / '))
    .join(' | ');
}
