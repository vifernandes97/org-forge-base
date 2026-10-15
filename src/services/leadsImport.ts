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

/** Company/contact fields sent to the shared resolution function. */
export interface ImportIdentity {
  trade_name?: string;
  legal_name?: string;
  cnpj?: string;
  instagram?: string;
  segment?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

export interface ImportPreviewRow {
  line: number;
  identity: ImportIdentity;
  /** deal-level fields only (value, priority, qualification, source, tags, notes) */
  lead: Record<string, any>;
  customValues: { field_definition_id: string; value: string }[];
  companyCreated: boolean;
  contactCreated: boolean;
  duplicate: boolean;
}

export interface ImportPreview {
  toCreate: ImportPreviewRow[];
  toUpdate: ImportPreviewRow[];
  errors: ImportRowError[];
  companies: { created: number; reused: number };
  contacts: { created: number; reused: number };
  ignored: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  ignored: number;
  companies: { created: number; reused: number };
  contacts: { created: number; reused: number };
  failed: ImportRowError[];
}

function parseRows(rows: SheetRow[], mapping: ImportMapping) {
  const valid: Omit<ImportPreviewRow, 'companyCreated' | 'contactCreated' | 'duplicate'>[] = [];
  const errors: ImportRowError[] = [];
  rows.forEach((row, idx) => {
    const line = idx + 2; // header is line 1
    const identity: ImportIdentity = {};
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
        case 'trade_name': identity.trade_name = raw; break;
        case 'legal_name': identity.legal_name = raw; break;
        case 'cnpj': identity.cnpj = raw; break;
        case 'segment': identity.segment = raw; break;
        case 'company_instagram': identity.instagram = raw; break;
        case 'name': identity.contact_name = raw; break;
        case 'email': identity.email = raw.toLowerCase(); break;
        case 'phone': { const p = normalizePhone(raw); if (p) identity.phone = p; break; }
        case 'value': { const n = parseSheetNumber(raw); if (n !== null) lead.value = n; break; }
        case 'qualification': {
          const n = parseSheetNumber(raw);
          if (n !== null && n >= 1 && n <= 5) lead.qualification = Math.round(n);
          break;
        }
        case 'priority': lead.priority = normalizePriority(raw); break;
        case 'tags': lead.tags = parseTags(raw); break;
        default: lead[target] = raw;
      }
    }
    if (!identity.trade_name && !identity.legal_name && !identity.contact_name && !identity.email && !identity.phone && !identity.cnpj) {
      errors.push({ line, reason: 'Linha sem empresa, nome, telefone ou e-mail', row });
      return;
    }
    valid.push({ line, identity, lead, customValues });
  });
  return { valid, errors };
}

const toRpcRow = (i: ImportIdentity) => ({
  trade_name: i.trade_name ?? null, legal_name: i.legal_name ?? null, cnpj: i.cnpj ?? null, instagram: i.instagram ?? null,
  segment: i.segment ?? null, contact_name: i.contact_name ?? null, email: i.email ?? null, phone: i.phone ?? null,
});

/**
 * Build the import preview with the same company/contact resolution used by the inbound webhook,
 * computed by the database without saving anything.
 */
export async function buildImportPreview(params: {
  orgId: string;
  funnelId: string;
  rows: SheetRow[];
  mapping: ImportMapping;
}): Promise<ImportPreview> {
  const { orgId, funnelId, rows, mapping } = params;
  const { valid, errors } = parseRows(rows, mapping);
  const results: any[] = [];
  for (let i = 0; i < valid.length; i += 500) {
    const { data, error } = await supabase.rpc('preview_import_resolution' as any, {
      p_org: orgId, p_funnel: funnelId, p_rows: valid.slice(i, i + 500).map(v => toRpcRow(v.identity)),
    });
    if (error) throw error;
    results.push(...((data as any[]) || []));
  }
  const toCreate: ImportPreviewRow[] = [];
  const toUpdate: ImportPreviewRow[] = [];
  const companies = { created: 0, reused: 0 };
  const contacts = { created: 0, reused: 0 };
  valid.forEach((v, idx) => {
    const r = results[idx] || {};
    const row: ImportPreviewRow = { ...v, companyCreated: !!r.company_created, contactCreated: !!r.contact_created, duplicate: !!r.duplicate };
    if (r.company_created) companies.created++; else companies.reused++;
    if (r.contact_id) { if (r.contact_created) contacts.created++; else contacts.reused++; }
    (row.duplicate ? toUpdate : toCreate).push(row);
  });
  return { toCreate, toUpdate, errors, companies, contacts, ignored: 0 };
}

/**
 * Execute the import row by row in sheet order. Each row is one deal; a row whose company already has an
 * active deal in this funnel updates it (stage kept, blanks filled, contact linked) like the webhook "update" rule.
 */
export async function runImport(params: {
  orgId: string;
  funnelId: string;
  stageId: string;
  userId: string;
  preview: ImportPreview;
  onProgress?: (done: number, total: number) => void;
}): Promise<ImportResult> {
  const { orgId, funnelId, stageId, userId, preview, onProgress } = params;
  const all = [...preview.toCreate, ...preview.toUpdate].sort((a, b) => a.line - b.line);
  const total = all.length;
  let done = 0, created = 0, updated = 0;
  const companies = { created: 0, reused: 0 };
  const contacts = { created: 0, reused: 0 };
  const failed: ImportRowError[] = [];
  const activities: any[] = [];
  const customRows: { lead_id: string; field_definition_id: string; value: string }[] = [];

  for (const r of all) {
    try {
      const id = r.identity;
      const { data: res, error: resErr } = await supabase.rpc('resolve_company_contact' as any, {
        p_org: orgId, p_trade_name: id.trade_name ?? null, p_legal_name: id.legal_name ?? null, p_cnpj: id.cnpj ?? null,
        p_instagram: id.instagram ?? null, p_segment: id.segment ?? null, p_contact_name: id.contact_name ?? null,
        p_email: id.email ?? null, p_phone: id.phone ?? null,
      });
      if (resErr || !(res as any)?.company_id) throw resErr || new Error('Empresa não resolvida');
      const rs = res as any;
      if (rs.company_created) companies.created++; else companies.reused++;
      if (rs.contact_id) { if (rs.contact_created) contacts.created++; else contacts.reused++; }
      // never discard an unknown segment: keep it in the deal notes
      const unknown: string[] = rs.unknown_segments || [];
      const extraNote = unknown.length ? unknown.map(u => `segmento: ${u}`).join('\n') : '';
      const notes = [r.lead.notes, extraNote].filter(Boolean).join('\n') || undefined;

      const { data: existing } = await supabase
        .from('leads')
        .select('id, notes, source, value, qualification, tags')
        .eq('organization_id', orgId).eq('company_id', rs.company_id).eq('funnel_id', funnelId)
        .is('archived_at', null).is('merged_into_lead_id', null)
        .order('created_at').limit(1).maybeSingle();

      let leadId: string;
      if (existing) {
        const cur: any = existing;
        const updates: Record<string, any> = {};
        if (notes && !cur.notes) updates.notes = notes;
        if (r.lead.source && !cur.source) updates.source = r.lead.source;
        if (r.lead.value && !cur.value) updates.value = r.lead.value;
        if (r.lead.qualification && !cur.qualification) updates.qualification = r.lead.qualification;
        if (r.lead.tags?.length) updates.tags = Array.from(new Set([...(cur.tags || []), ...r.lead.tags]));
        if (Object.keys(updates).length) {
          const { error } = await supabase.from('leads').update(updates).eq('id', cur.id);
          if (error) throw error;
        }
        leadId = cur.id;
        if (rs.contact_id) {
          const { data: links } = await supabase.from('lead_contacts').select('contact_id, is_primary').eq('lead_id', leadId);
          if (!(links || []).some((l: any) => l.contact_id === rs.contact_id)) {
            await supabase.from('lead_contacts').insert({
              organization_id: orgId, lead_id: leadId, contact_id: rs.contact_id,
              is_primary: !(links || []).some((l: any) => l.is_primary),
            });
          }
        }
        updated++;
        activities.push({ organization_id: orgId, lead_id: leadId, user_id: userId, activity_type: 'field_update',
          title: 'Importado via planilha', description: 'Dados atualizados através de importação de planilha.' });
      } else {
        const { data: lead, error } = await supabase.from('leads').insert({
          organization_id: orgId, funnel_id: funnelId, stage_id: stageId, company_id: rs.company_id,
          priority: r.lead.priority || 'medium', value: r.lead.value || 0, tags: r.lead.tags || [],
          qualification: r.lead.qualification ?? null, source: r.lead.source ?? null, notes: notes ?? null,
        } as any).select('id').single();
        if (error || !lead) throw error || new Error('Erro ao criar');
        leadId = lead.id;
        if (rs.contact_id) {
          await supabase.from('lead_contacts').insert({ organization_id: orgId, lead_id: leadId, contact_id: rs.contact_id, is_primary: true });
        }
        created++;
        activities.push({ organization_id: orgId, lead_id: leadId, user_id: userId, activity_type: 'field_update',
          title: 'Importado via planilha', description: 'Negócio criado através de importação de planilha.' });
      }
      r.customValues.forEach(cv => customRows.push({ lead_id: leadId, ...cv }));
    } catch (e: any) {
      failed.push({ line: r.line, reason: e?.message || 'Erro ao importar', row: {} });
    }
    done++;
    onProgress?.(done, total);
  }

  for (let i = 0; i < customRows.length; i += 200) {
    await supabase.from('custom_field_values').upsert(customRows.slice(i, i + 200), { onConflict: 'lead_id,field_definition_id' });
  }
  for (let i = 0; i < activities.length; i += 200) {
    await supabase.from('lead_activities').insert(activities.slice(i, i + 200));
  }
  return { created, updated, ignored: 0, companies, contacts, failed: [...preview.errors, ...failed] };
}
