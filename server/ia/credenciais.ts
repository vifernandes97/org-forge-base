import { servicePool } from '../db.js';
import { decifrar } from '../canais/cifra.js';

// Credenciais de IA da organização (db/61_ia.sql). Transcrição usa a API de
// áudio no formato da OpenAI, que Groq, OpenAI e os "compatíveis" falam igual;
// Anthropic e Google entram na Fase 3, para análise.

export type ProvedorIa = 'groq' | 'openai' | 'openai_compatible' | 'anthropic' | 'google';

export const URL_PADRAO: Partial<Record<ProvedorIa, string>> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
};

/** Provedores com transcrição (endpoint /audio/transcriptions). */
export const TRANSCREVEM: ProvedorIa[] = ['groq', 'openai', 'openai_compatible'];

export interface Credencial {
  id: string;
  organizationId: string;
  provider: ProvedorIa;
  baseUrl: string;
  apiKey: string;
}

export function urlBase(provider: ProvedorIa, baseUrl: string | null): string {
  const url = (baseUrl || URL_PADRAO[provider] || '').replace(/\/+$/, '');
  if (!url) throw new Error('Informe a URL base do provedor');
  return url;
}

const cache = new Map<string, { valor: Credencial; ate: number }>();

export async function credencial(id: string): Promise<Credencial> {
  const c = cache.get(id);
  if (c && c.ate > Date.now()) return c.valor;
  const { rows } = await servicePool().query<{ id: string; organization_id: string; provider: ProvedorIa; base_url: string | null; api_key_enc: string }>(
    `select id, organization_id, provider, base_url, api_key_enc from ai_credentials where id = $1`, [id]);
  const r = rows[0];
  if (!r) throw new Error('Credencial de IA não encontrada');
  const valor: Credencial = { id: r.id, organizationId: r.organization_id, provider: r.provider, baseUrl: urlBase(r.provider, r.base_url), apiKey: decifrar(r.api_key_enc) };
  cache.set(id, { valor, ate: Date.now() + 60_000 });
  return valor;
}

export const esquecerCredencial = (id: string) => cache.delete(id);

/** Lista os modelos que a chave enxerga (testa a chave de quebra). */
export async function listarModelos(provider: ProvedorIa, baseUrl: string, apiKey: string): Promise<string[]> {
  if (!TRANSCREVEM.includes(provider)) throw new Error('Provedor ainda não suportado (chega na Fase 3)');
  const res = await fetch(`${baseUrl}/models`, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  const corpo = await res.json().catch(() => null) as { data?: { id: string }[]; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(corpo?.error?.message || `O provedor recusou a chave (HTTP ${res.status})`);
  return (corpo?.data ?? []).map((m) => m.id).sort();
}

/** Modelos de transcrição entre os que a chave lista (whisper, *transcribe*). */
export const ehModeloDeTranscricao = (id: string) => /whisper|transcri/i.test(id);
