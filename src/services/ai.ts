/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora de integrations/supabase/types.ts */
import { supabase } from '@/integrations/supabase/client';

// IA da organização (Configurações → Inteligência artificial). A chave só
// entra pelo servidor (/api/ai), que testa, cifra e nunca a devolve; o resto
// é PostgREST (ai_credentials sem a chave, org_ai_settings, usage_events).

export type AiProvider = 'groq' | 'openai' | 'openai_compatible' | 'anthropic' | 'google';

export interface AiCredential {
  id: string;
  provider: AiProvider;
  label: string;
  base_url: string | null;
  key_last4: string;
  status: 'ok' | 'error';
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
}

export interface OrgAiSettings {
  organization_id: string;
  transcription_enabled: boolean;
  transcription_credential_id: string | null;
  transcription_model: string | null;
  transcription_fallback_credential_id: string | null;
  transcription_fallback_model: string | null;
  transcription_language: string;
  analysis_enabled: boolean;
  analysis_credential_id: string | null;
  analysis_model: string | null;
  analysis_fallback_credential_id: string | null;
  analysis_fallback_model: string | null;
  autonomy: 'auto' | 'suggest';
  stage_min_confidence: number;
  stage_back_min_confidence: number;
  create_leads: boolean;
  instructions: string | null;
}

export interface AiModel {
  id: string;
  nome: string;
  visao: boolean | null;
  estruturada: boolean | null;
  contexto: number | null;
}

export interface AnalysisAction {
  type: 'note' | 'stage_change' | 'task' | 'field_update' | 'create_lead' | 'classify';
  payload: Record<string, any>;
  confidence: number | null;
  state: 'applied' | 'pending' | 'skipped';
  reason: string | null;
}

export type TestAnalysisResult = {
  chat: { id: string; push_name: string | null; phone_digits: string | null };
  resultado:
    | { status: 'skipped'; motivo: string }
    | { status: 'error'; erro: string }
    | { status: 'done'; decisao: { comercial: boolean; resumo: string }; acoes: AnalysisAction[]; modelo: string; provedor: string; tokensEntrada: number | null; tokensSaida: number | null; mensagens: number };
};

export async function getAiCredentials(orgId: string): Promise<AiCredential[]> {
  const { data, error } = await supabase
    .from('ai_credentials' as any)
    .select('id, provider, label, base_url, key_last4, status, last_error, last_checked_at, created_at')
    .eq('organization_id', orgId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as unknown as AiCredential[];
}

export async function getOrgAiSettings(orgId: string): Promise<OrgAiSettings | null> {
  const { data, error } = await supabase.from('org_ai_settings' as any).select('*').eq('organization_id', orgId).maybeSingle();
  if (error) throw error;
  return data as unknown as OrgAiSettings | null;
}

export async function saveOrgAiSettings(settings: Partial<OrgAiSettings> & { organization_id: string }) {
  const { error } = await supabase.from('org_ai_settings' as any).upsert(settings, { onConflict: 'organization_id' });
  if (error) throw error;
}

/** Segundos de áudio transcritos no mês corrente. */
export async function getTranscriptionSecondsThisMonth(orgId: string): Promise<number> {
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('usage_events' as any)
    .select('quantity')
    .eq('organization_id', orgId)
    .eq('kind', 'transcription_seconds')
    .gte('created_at', inicio.toISOString());
  if (error) throw error;
  return ((data || []) as any[]).reduce((s, r) => s + Number(r.quantity), 0);
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/ai${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const createAiCredential = (payload: { organization_id: string; provider: AiProvider; label: string; base_url?: string | null; api_key: string }) =>
  api<{ id: string; models: number }>('POST', '/credentials', payload);

export const getCredentialModels = (id: string, task: 'transcription' | 'analysis') =>
  api<{ models: AiModel[] }>('GET', `/credentials/${id}/models?task=${task}`);

export const testAnalysis = (organization_id: string) =>
  api<TestAnalysisResult>('POST', '/test-analysis', { organization_id });

export const deleteAiCredential = (id: string) => api<{ ok: true }>('DELETE', `/credentials/${id}`);
