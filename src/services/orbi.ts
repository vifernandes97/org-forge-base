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
}

export async function getOrbiIntegration(orgId: string): Promise<OrbiIntegration | null> {
  const { data, error } = await (supabase as any)
    .from('org_orbi_integrations')
    .select('organization_id, base_url, key_last4, enabled, last_error, last_ok_at, updated_at')
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

export const removeOrbiIntegration = (orgId: string) =>
  api<{ ok: true }>('DELETE', `/config?organization_id=${encodeURIComponent(orgId)}`);

/** URL do retorno para cadastrar na integração, no Orbi (mesma regra do server/orbi.ts). */
export const orbiCallbackUrl = (orgId: string) => `${window.location.origin}/api/orbi/retorno/${orgId}`;
