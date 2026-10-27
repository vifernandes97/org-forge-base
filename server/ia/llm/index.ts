import type { ProvedorIa } from '../credenciais.js';
import { anthropic } from './anthropic.js';
import { google } from './google.js';
import { openai } from './openai.js';
import type { ModeloInfo, ProvedorLlm } from './tipos.js';

const PROVEDORES: Record<ProvedorIa, ProvedorLlm> = {
  anthropic,
  google,
  openai,
  groq: openai,
  openai_compatible: openai,
};

export const provedorLlm = (p: ProvedorIa) => PROVEDORES[p];

/** Fora da análise: áudio, imagem, embeddings, moderação. */
export const serveParaAnalise = (m: ModeloInfo) =>
  !/whisper|transcri|tts|speech|embed|moderation|dall-e|image|guard|realtime|audio/i.test(m.id);
