import type { Company, Contact } from '@/types';

export interface LeadContactLink {
  id?: string;
  is_primary: boolean;
  contact: Contact | null;
}

/** Normalize like the database key: no accents, lowercase, single spaces, trimmed. */
export function normalizeKey(v: string | null | undefined): string {
  return (v || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getLeadContacts(lead: any): LeadContactLink[] {
  const links: LeadContactLink[] = Array.isArray(lead?.lead_contacts) ? lead.lead_contacts : [];
  return links
    .filter(l => l.contact)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
}

export function getPrimaryContact(lead: any): Contact | null {
  const links = getLeadContacts(lead);
  return (links.find(l => l.is_primary) || links[0])?.contact || null;
}

export function getLeadDisplay(lead: any): {
  title: string;
  segment: string | null;
  company: Company | null;
  primaryContact: Contact | null;
} {
  const company: Company | null = lead?.company || null;
  const primaryContact = getPrimaryContact(lead);
  return {
    title: company?.trade_name || primaryContact?.name || 'Sem empresa',
    segment: company?.segment_ref?.label || null,
    company,
    primaryContact,
  };
}
