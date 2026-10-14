import { supabase } from '@/integrations/supabase/client';

export async function linkContact(orgId: string, leadId: string, contactId: string, isPrimary = false) {
  if (isPrimary) {
    await supabase.from('lead_contacts').update({ is_primary: false }).eq('lead_id', leadId).eq('is_primary', true);
  } else {
    const { count } = await supabase
      .from('lead_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', leadId)
      .eq('is_primary', true);
    if (!count) isPrimary = true;
  }
  const { error } = await supabase
    .from('lead_contacts')
    .upsert(
      { organization_id: orgId, lead_id: leadId, contact_id: contactId, is_primary: isPrimary } as any,
      { onConflict: 'lead_id,contact_id' }
    );
  if (error) throw error;
}

/** Unlinks a contact from a deal; if it was primary, the next linked contact becomes primary. */
export async function unlinkContact(leadId: string, contactId: string) {
  const { data: link } = await supabase
    .from('lead_contacts')
    .select('is_primary')
    .eq('lead_id', leadId)
    .eq('contact_id', contactId)
    .maybeSingle();
  const { error } = await supabase.from('lead_contacts').delete().eq('lead_id', leadId).eq('contact_id', contactId);
  if (error) throw error;
  if ((link as any)?.is_primary) {
    const { data: next } = await supabase
      .from('lead_contacts').select('id').eq('lead_id', leadId).order('created_at').limit(1).maybeSingle();
    if (next) await supabase.from('lead_contacts').update({ is_primary: true }).eq('id', (next as any).id);
  }
}

export async function setPrimaryContact(leadId: string, contactId: string) {
  const { error: e1 } = await supabase
    .from('lead_contacts').update({ is_primary: false }).eq('lead_id', leadId).eq('is_primary', true);
  if (e1) throw e1;
  const { error } = await supabase
    .from('lead_contacts').update({ is_primary: true }).eq('lead_id', leadId).eq('contact_id', contactId);
  if (error) throw error;
}

/** Replace all contact links of a deal (used by the deal form). First id = primary. */
export async function setLeadContacts(orgId: string, leadId: string, contactIds: string[], primaryId?: string | null) {
  const { error } = await supabase.from('lead_contacts').delete().eq('lead_id', leadId);
  if (error) throw error;
  if (!contactIds.length) return;
  const primary = primaryId && contactIds.includes(primaryId) ? primaryId : contactIds[0];
  const rows = contactIds.map(id => ({ organization_id: orgId, lead_id: leadId, contact_id: id, is_primary: id === primary }));
  const { error: e2 } = await supabase.from('lead_contacts').insert(rows as any);
  if (e2) throw e2;
}

/** Change the deal's company, unlinking contacts that do not belong to the new company. */
export async function changeLeadCompany(leadId: string, companyId: string) {
  const { error } = await supabase.from('leads').update({ company_id: companyId } as any).eq('id', leadId);
  if (error) throw error;
  const { data: links } = await supabase
    .from('lead_contacts')
    .select('id, contact:contacts(company_id)')
    .eq('lead_id', leadId);
  const stale = (links || []).filter((l: any) => l.contact?.company_id !== companyId).map((l: any) => l.id);
  if (stale.length) {
    const { error: e2 } = await supabase.from('lead_contacts').delete().in('id', stale);
    if (e2) throw e2;
  }
}
