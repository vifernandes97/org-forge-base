import type { Credencial } from '../../ia/credenciais.js';
import { extensao } from '../midia/armazenamento.js';

// Transcrição pela API de áudio no formato da OpenAI (POST /audio/transcriptions,
// multipart). Groq (whisper-large-v3-turbo), OpenAI (gpt-4o-mini-transcribe,
// whisper-1) e servidores compatíveis respondem igual.

export class LimiteDeTaxa extends Error {
  constructor(public esperarSegundos: number, mensagem: string) {
    super(mensagem);
  }
}

/** Não adianta tentar de novo com o mesmo arquivo (formato, tamanho, chave inválida). */
export class ErroPermanente extends Error {}

/** Limite do plano gratuito da Groq e da OpenAI. */
export const TAMANHO_MAXIMO = 25 * 1024 * 1024;

export async function transcrever(
  cred: Credencial,
  modelo: string,
  audio: Buffer,
  mimetype: string,
  idioma: string,
): Promise<string> {
  if (audio.length > TAMANHO_MAXIMO) throw new ErroPermanente(`Áudio de ${(audio.length / 1048576).toFixed(1)} MB passa do limite de 25 MB`);
  const form = new FormData();
  // O provedor deduz o formato pela extensão: o .ogg do WhatsApp é opus.
  form.append('file', new Blob([audio], { type: mimetype.split(';')[0] }), `audio.${extensao(mimetype)}`);
  form.append('model', modelo);
  form.append('language', idioma);
  form.append('response_format', 'json');

  const res = await fetch(`${cred.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cred.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  const corpo = await res.json().catch(() => null) as { text?: string; error?: { message?: string } } | null;
  const msg = corpo?.error?.message || `HTTP ${res.status}`;
  if (res.status === 429) {
    const espera = Number(res.headers.get('retry-after')) || 60;
    throw new LimiteDeTaxa(espera, `Limite do provedor: ${msg}`);
  }
  if (res.status >= 500) throw new Error(`Provedor fora do ar: ${msg}`);
  if (!res.ok) throw new ErroPermanente(`Transcrição recusada: ${msg}`);
  return (corpo?.text ?? '').trim();
}
