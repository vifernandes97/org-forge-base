import { supabase } from '@/integrations/supabase/client';
import type { Contact } from '@/types';

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
}

const clean = (i: Partial<ContactInput>) => {
  const o: Record<string, any> = {};
  if (i.name !== undefined) o.name = i.name.trim();
  if (i.email !== undefined) o.email = i.email?.trim() || null;
  if (i.phone !== undefined) o.phone = i.phone?.trim() || null;
  return o;
};

export async function getCompanyContacts(companyId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('name');
  if (error) throw error;
  return (data || []) as Contact[];
}

export async function createContact(orgId: string, companyId: string, input: ContactInput): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .insert({ organization_id: orgId, company_id: companyId, ...clean(input) } as any)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(id: string, input: Partial<ContactInput>): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(clean(input) as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Contact;
}

/** Deals this contact is linked to (for delete confirmation). */
export async function getContactLeads(contactId: string) {
  const { data, error } = await supabase
    .from('lead_contacts')
    .select('lead_id, is_primary, lead:leads(id, company:companies(trade_name), stage:stages(name))')
    .eq('contact_id', contactId);
  if (error) throw error;
  return (data || []) as any[];
}

/** Deletes a contact. For every deal where it was primary, the next linked contact becomes primary. */
export async function deleteContact(contactId: string) {
  const links = await getContactLeads(contactId);
  const primaryLeadIds = links.filter(l => l.is_primary).map(l => l.lead_id);
  const { error } = await supabase.from('contacts').delete().eq('id', contactId);
  if (error) throw error;
  for (const leadId of primaryLeadIds) {
    const { data: next } = await supabase
      .from('lead_contacts')
      .select('id')
      .eq('lead_id', leadId)
      .order('created_at')
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from('lead_contacts').update({ is_primary: true }).eq('id', (next as any).id);
  }
}
