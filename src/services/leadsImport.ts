import { supabase } from '@/integrations/supabase/client';
import {
  normalizePhone,
  normalizePriority,
  parseSheetNumber,
  parseTags,
  type SheetRow,
} from '@/lib/spreadsheet';

export interface ImportMapping {
  /** header -> '' | native key | 'cf:<definitionId>' */
  [header: string]: string;
}

export interface ImportRowError {
  line: number;
  reason: string;
  row: SheetRow;
}

export interface ImportPreviewRow {
  line: number;
  lead: Record<string, any>;
  customValues: { field_definition_id: string; value: string }[];
  duplicateId?: string;
}

export interface ImportPreview {
  toCreate: ImportPreviewRow[];
  toUpdate: ImportPreviewRow[];
  errors: ImportRowError[];
}

export interface ImportResult {
  created: number;
  updated: number;
  failed: ImportRowError[];
}

type ExistingLead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  company_instagram: string | null;
  notes: string | null;
  source: string | null;
  value: number | null;
  qualification: number | null;
  tags: string[] | null;
};

function digits(v: string | null): string {
  return (v || '').replace(/\D/g, '');
}

async function fetchExistingLeads(orgId: string): Promise<ExistingLead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, email, phone, company, company_instagram, notes, source, value, qualification, tags')
    .eq('organization_id', orgId)
    .is('merged_into_lead_id', null);
  if (error) throw error;
  return (data || []) as ExistingLead[];
}

/** Build the import preview: valid rows split between create/update plus invalid rows. */
export async function buildImportPreview(params: {
  orgId: string;
  rows: SheetRow[];
  mapping: ImportMapping;
}): Promise<ImportPreview> {
  const { orgId, rows, mapping } = params;
  const existing = await fetchExistingLeads(orgId);

  const byPhone = new Map<string, ExistingLead>();
  const byEmail = new Map<string, ExistingLead>();
  for (const lead of existing) {
    const p = digits(lead.phone);
    if (p.length >= 8) {
      const tail = p.slice(-10);
      if (!byPhone.has(tail)) byPhone.set(tail, lead);
    }
    const e = (lead.email || '').trim().toLowerCase();
    if (e && !byEmail.has(e)) byEmail.set(e, lead);
  }

  const toCreate: ImportPreviewRow[] = [];
  const toUpdate: ImportPreviewRow[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((row, idx) => {
    const line = idx + 2; // header is line 1
    const lead: Record<string, any> = {};
    const customValues: { field_definition_id: string; value: string }[] = [];

    for (const [header, target] of Object.entries(mapping)) {
      if (!target) continue;
      const raw = (row[header] ?? '').trim();
      if (target.startsWith('cf:')) {
        if (raw) customValues.push({ field_definition_id: target.slice(3), value: raw });
        continue;
      }
      if (!raw) continue;
      switch (target) {
        case 'value': {
          const n = parseSheetNumber(raw);
          if (n !== null) lead.value = n;
          break;
        }
        case 'qualification': {
          const n = parseSheetNumber(raw);
          if (n !== null && n >= 1 && n <= 5) lead.qualification = Math.round(n);
          break;
        }
        case 'phone': {
          const p = normalizePhone(raw);
          if (p) lead.phone = p;
          break;
        }
        case 'priority':
          lead.priority = normalizePriority(raw);
          break;
        case 'tags':
          lead.tags = parseTags(raw);
          break;
        case 'email':
          lead.email = raw.toLowerCase();
          break;
        default:
          lead[target] = raw;
      }
    }

    const hasIdentity = !!(lead.company || lead.name);
    const hasContact = !!(lead.phone || lead.email);
    if (!hasIdentity && !hasContact) {
      errors.push({ line, reason: 'Linha sem empresa, nome, telefone ou e-mail', row });
      return;
    }

    // Deal name follows the app convention: company as main label, contact name as fallback
    lead.name = lead.name || lead.company || lead.phone || lead.email;
    if (lead.company) lead.company_name = lead.company;

    const phoneTail = digits(lead.phone).slice(-10);
    const dup =
      (phoneTail.length >= 8 ? byPhone.get(phoneTail) : undefined) ||
      (lead.email ? byEmail.get(String(lead.email)) : undefined);

    if (dup) {
      toUpdate.push({ line, lead, customValues, duplicateId: dup.id });
    } else {
      toCreate.push({ line, lead, customValues });
    }
  });

  return { toCreate, toUpdate, errors };
}

const FILL_FIELDS = ['email', 'phone', 'company', 'company_name', 'company_instagram', 'notes', 'source'] as const;

/** Execute the import in batches. Existing deals keep their stage and only get missing data filled in. */
export async function runImport(params: {
  orgId: string;
  funnelId: string;
  stageId: string;
  userId: string;
  preview: ImportPreview;
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportResult> {
  const { orgId, funnelId, stageId, userId, preview, onProgress } = params;
  const total = preview.toCreate.length + preview.toUpdate.length;
  let done = 0;
  let created = 0;
  let updated = 0;
  const failed: ImportRowError[] = [];

  const activities: any[] = [];
  const customRows: { lead_id: string; field_definition_id: string; value: string }[] = [];

  // --- creations, in batches of 50
  const chunkSize = 50;
  for (let i = 0; i < preview.toCreate.length; i += chunkSize) {
    const chunk = preview.toCreate.slice(i, i + chunkSize);
    const payload = chunk.map(r => ({
      organization_id: orgId,
      funnel_id: funnelId,
      stage_id: stageId,
      priority: 'medium',
      value: 0,
      tags: [] as string[],
      ...r.lead,
      name: String(r.lead.name),
    }));
    const { data, error } = await supabase.from('leads').insert(payload).select('id');
    if (error || !data) {
      chunk.forEach(r => failed.push({ line: r.line, reason: error?.message || 'Erro ao criar', row: {} }));
    } else {
      created += data.length;
      data.forEach((lead, idx) => {
        const src = chunk[idx];
        src.customValues.forEach(cv => customRows.push({ lead_id: lead.id, ...cv }));
        activities.push({
          organization_id: orgId,
          lead_id: lead.id,
          user_id: userId,
          activity_type: 'field_update',
          title: 'Importado via planilha',
          description: 'Negócio criado através de importação de planilha.',
        });
      });
    }
    done += chunk.length;
    onProgress?.(done, total);
  }

  // --- updates (fill blanks only), one by one to respect existing data
  for (const r of preview.toUpdate) {
    try {
      const { data: current, error: readErr } = await supabase
        .from('leads')
        .select('id, name, company, tags, ' + FILL_FIELDS.join(', '))
        .eq('id', r.duplicateId!)
        .single();
      if (readErr || !current) throw readErr || new Error('Negócio não encontrado');

      const updates: Record<string, any> = {};
      for (const f of FILL_FIELDS) {
        const incoming = r.lead[f];
        if (incoming && !(current as any)[f]) updates[f] = incoming;
      }
      if (r.lead.value && !(current as any).value) updates.value = r.lead.value;
      if (r.lead.qualification && !(current as any).qualification) updates.qualification = r.lead.qualification;
      if (r.lead.tags?.length) {
        const merged = Array.from(new Set([...(((current as any).tags as string[]) || []), ...r.lead.tags]));
        updates.tags = merged;
      }

      if (Object.keys(updates).length) {
        const { error: updErr } = await supabase.from('leads').update(updates).eq('id', r.duplicateId!);
        if (updErr) throw updErr;
      }
      r.customValues.forEach(cv => customRows.push({ lead_id: r.duplicateId!, ...cv }));
      activities.push({
        organization_id: orgId,
        lead_id: r.duplicateId!,
        user_id: userId,
        activity_type: 'field_update',
        title: 'Importado via planilha',
        description: 'Dados atualizados através de importação de planilha.',
      });
      updated += 1;
    } catch (e: any) {
      failed.push({ line: r.line, reason: e?.message || 'Erro ao atualizar', row: {} });
    }
    done += 1;
    onProgress?.(done, total);
  }

  for (let i = 0; i < customRows.length; i += 200) {
    await supabase
      .from('custom_field_values')
      .upsert(customRows.slice(i, i + 200), { onConflict: 'lead_id,field_definition_id' });
  }
  for (let i = 0; i < activities.length; i += 200) {
    await supabase.from('lead_activities').insert(activities.slice(i, i + 200));
  }

  return { created, updated, failed: [...preview.errors, ...failed] };
}
