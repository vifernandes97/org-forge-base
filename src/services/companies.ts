import { supabase } from '@/integrations/supabase/client';
import type { Company } from '@/types';
import { normalizeKey } from '@/lib/leadDisplay';
import { onlyDigits } from '@/lib/cnpj';

export interface CompanyInput {
  trade_name: string;
  legal_name?: string | null;
  cnpj?: string | null;
  instagram?: string | null;
  segment?: string | null;
}

function clean(input: Partial<CompanyInput>) {
  const out: Record<string, any> = {};
  if (input.trade_name !== undefined) out.trade_name = input.trade_name.trim();
  if (input.legal_name !== undefined) out.legal_name = input.legal_name?.trim() || null;
  if (input.cnpj !== undefined) out.cnpj = onlyDigits(input.cnpj) || null;
  if (input.instagram !== undefined) out.instagram = input.instagram?.trim() || null;
  if (input.segment !== undefined) out.segment = input.segment?.trim() || null;
  if (out.trade_name !== undefined) out.match_key = normalizeKey(out.trade_name) || null;
  return out;
}

/** Search companies by trade name, legal name or CNPJ (accent-insensitive, client-side over the org list). */
export async function searchCompanies(orgId: string, term: string, limit = 20): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', orgId)
    .order('trade_name');
  if (error) throw error;
  const k = normalizeKey(term);
  const d = onlyDigits(term);
  const rows = (data || []) as Company[];
  if (!k) return rows.slice(0, limit);
  return rows
    .filter(c =>
      normalizeKey(c.trade_name).includes(k) ||
      normalizeKey(c.legal_name).includes(k) ||
      (d.length >= 3 && (c.cnpj || '').includes(d))
    )
    .slice(0, limit);
}

export async function getCompanies(orgId: string): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', orgId)
    .order('trade_name');
  if (error) throw error;
  return (data || []) as Company[];
}

export async function getCompany(id: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*, contacts(*), leads(id, status, archived_at, funnel:funnels(id, name), stage:stages(id, name, color))')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function findCompanyByCnpj(orgId: string, cnpj: string): Promise<Company | null> {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organization_id', orgId)
    .eq('cnpj', d)
    .maybeSingle();
  if (error) throw error;
  return (data as Company) || null;
}

export async function createCompany(orgId: string, input: CompanyInput): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .insert({ organization_id: orgId, ...clean(input) } as any)
    .select()
    .single();
  if (error) {
    if ((error as any).code === '23505') throw new Error('Já existe uma empresa com esse nome ou CNPJ nesta organização');
    throw error;
  }
  return data as Company;
}

export async function updateCompany(id: string, input: Partial<CompanyInput>): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .update(clean(input) as any)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if ((error as any).code === '23505') throw new Error('Já existe uma empresa com esse nome ou CNPJ nesta organização');
    throw error;
  }
  return data as Company;
}

export async function getSegments(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('segment')
    .eq('organization_id', orgId)
    .not('segment', 'is', null);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const r of data || []) {
    const s = (r as any).segment as string;
    const k = normalizeKey(s);
    if (k && !map.has(k)) map.set(k, s);
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function getCompanyCounts(companyId: string) {
  const [{ count: leads }, { count: contacts }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ]);
  return { leads: leads || 0, contacts: contacts || 0 };
}

export async function mergeCompanies(targetId: string, sourceId: string) {
  const { data, error } = await supabase.rpc('merge_companies' as any, { p_target: targetId, p_source: sourceId });
  if (error) throw error;
  return data as { leads_moved: number; contacts_moved: number; contacts_merged: number };
}
