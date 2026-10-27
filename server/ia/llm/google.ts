import { z } from 'zod/v4';
import type { Credencial } from '../credenciais.js';
import { RecusaDoModelo, type ModeloInfo, type PedidoAnalise, type ProvedorLlm, type RespostaAnalise } from './tipos.js';

// Gemini pela API REST (generativelanguage.googleapis.com/v1beta): JSON com
// responseJsonSchema; imagens como inline_data.

const cabecalho = (cred: Credencial) => ({ 'x-goog-api-key': cred.apiKey, 'content-type': 'application/json' });

export const google: ProvedorLlm = {
  async listarModelos(cred) {
    const modelos: ModeloInfo[] = [];
    let pagina: string | undefined;
    do {
      const url = `${cred.baseUrl}/models?pageSize=1000${pagina ? `&pageToken=${pagina}` : ''}`;
      const res = await fetch(url, { headers: cabecalho(cred), signal: AbortSignal.timeout(15_000) });
      const corpo = await res.json().catch(() => null) as {
        models?: { name: string; displayName?: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }[];
        nextPageToken?: string;
        error?: { message?: string };
      } | null;
      if (!res.ok) throw new Error(corpo?.error?.message || `O provedor recusou a chave (HTTP ${res.status})`);
      for (const m of corpo?.models ?? []) {
        if (!m.supportedGenerationMethods?.includes('generateContent')) continue;
        modelos.push({ id: m.name.replace(/^models\//, ''), nome: m.displayName ?? m.name, visao: /gemini/i.test(m.name) || null, estruturada: true, contexto: m.inputTokenLimit ?? null });
      }
      pagina = corpo?.nextPageToken;
    } while (pagina);
    return modelos;
  },

  async analisar<T>(cred: Credencial, modelo: string, p: PedidoAnalise<T>): Promise<RespostaAnalise<T>> {
    const res = await fetch(`${cred.baseUrl}/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: cabecalho(cred),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: p.sistema }] },
        contents: [{
          role: 'user',
          parts: [...p.imagens.map((i) => ({ inline_data: { mime_type: i.mimetype, data: i.base64 } })), { text: p.usuario }],
        }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(p.schema) },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const dados = await res.json().catch(() => null) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      modelVersion?: string;
      error?: { message?: string };
    } | null;
    if (!res.ok) throw Object.assign(new Error(dados?.error?.message || `HTTP ${res.status}`), { status: res.status });
    if (dados?.promptFeedback?.blockReason) throw new RecusaDoModelo(`Bloqueado: ${dados.promptFeedback.blockReason}`);
    const cand = dados?.candidates?.[0];
    if (cand?.finishReason === 'SAFETY') throw new RecusaDoModelo('Bloqueado por segurança');
    if (cand?.finishReason === 'MAX_TOKENS') throw new Error('Resposta da IA cortada (limite de tokens)');
    const texto = (cand?.content?.parts ?? []).map((x) => x.text ?? '').join('');
    return {
      objeto: p.schema.parse(JSON.parse(texto)),
      modelo: dados?.modelVersion ?? modelo,
      tokensEntrada: dados?.usageMetadata?.promptTokenCount ?? null,
      tokensSaida: dados?.usageMetadata?.candidatesTokenCount ?? null,
    };
  },
};
