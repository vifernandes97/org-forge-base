/* eslint-disable @typescript-eslint/no-explicit-any -- tabela nova ainda fora de integrations/supabase/types.ts */
import { supabase } from '@/integrations/supabase/client';

// Integração com o Orbi (Configurações → Orbi). Chave e segredo só entram
// pelo servidor (/api/orbi), que testa e cifra; o navegador lê o estado.

export interface OrbiIntegration {
  organization_id: string;
  base_url: string;
  key_last4: string;
  enabled: boolean;
  last_error: string | null;
  last_ok_at: string | null;
  updated_at: string;
  /** Link do tipo de reunião do Orbi que a Bia oferece (…/agendar/<pessoa>/<tipo>). */
  booking_link: string | null;
}

export async function getOrbiIntegration(orgId: string): Promise<OrbiIntegration | null> {
  const { data, error } = await (supabase as any)
    .from('org_orbi_integrations')
    .select('organization_id, base_url, key_last4, enabled, last_error, last_ok_at, updated_at, booking_link')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data as OrbiIntegration | null;
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/orbi${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const saveOrbiIntegration = (input: { organization_id: string; base_url: string; api_key: string; callback_secret: string }) =>
  api<{ ok: true }>('POST', '/config', input);

/** Link de agendamento: …/agendar/<pessoa>/<tipo>, sem barra no fim. Vazio = desliga. */
export function normalizarLinkDeAgendamento(v: string): string | null | Error {
  const t = v.trim().replace(/\/+$/, '').toLowerCase();
  if (!t) return null;
  if (!/^https?:\/\/\S+\/agendar\/[a-z0-9-]+\/[a-z0-9-]+$/.test(t)) {
    return new Error('Cole o link do tipo de reunião, no formato https://orbi…/agendar/<pessoa>/<tipo>.');
  }
  return t;
}

export async function saveOrbiBookingLink(orgId: string, link: string | null) {
  const { error } = await (supabase as any).from('org_orbi_integrations').update({ booking_link: link }).eq('organization_id', orgId);
  if (error) throw error;
}

export const removeOrbiIntegration = (orgId: string) =>
  api<{ ok: true }>('DELETE', `/config?organization_id=${encodeURIComponent(orgId)}`);

/** URL do retorno para cadastrar na integração, no Orbi (mesma regra do server/orbi.ts). */
export const orbiCallbackUrl = (orgId: string) => `${window.location.origin}/api/orbi/retorno/${orgId}`;
