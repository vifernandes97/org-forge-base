import { z } from 'zod/v4';
import type { Credencial } from '../credenciais.js';
import { RecusaDoModelo, type ModeloInfo, type PedidoAnalise, type ProvedorLlm, type RespostaAnalise } from './tipos.js';

// OpenAI, Groq e servidores compatíveis (OpenRouter, Ollama…): /chat/completions
// com response_format json_schema. Quem não aceita json_schema cai para
// json_object com o schema no prompt; a resposta é validada pelo zod igual.

async function chamar(cred: Credencial, corpo: object) {
  const res = await fetch(`${cred.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cred.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(120_000),
  });
  const dados = await res.json().catch(() => null) as {
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
    error?: { message?: string };
  } | null;
  return { res, dados };
}

export const openai: ProvedorLlm = {
  async listarModelos(cred) {
    const res = await fetch(`${cred.baseUrl}/models`, { headers: { authorization: `Bearer ${cred.apiKey}` }, signal: AbortSignal.timeout(15_000) });
    const corpo = await res.json().catch(() => null) as { data?: { id: string; context_window?: number; context_length?: number }[]; error?: { message?: string } } | null;
    if (!res.ok) throw new Error(corpo?.error?.message || `O provedor recusou a chave (HTTP ${res.status})`);
    return (corpo?.data ?? []).map((m): ModeloInfo => ({
      id: m.id, nome: m.id, visao: null, estruturada: null, contexto: m.context_window ?? m.context_length ?? null,
    })).sort((a, b) => a.id.localeCompare(b.id));
  },

  async analisar<T>(cred: Credencial, modelo: string, p: PedidoAnalise<T>): Promise<RespostaAnalise<T>> {
    const jsonSchema = z.toJSONSchema(p.schema);
    const usuario = p.imagens.length
      ? [
          ...p.imagens.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mimetype};base64,${i.base64}` } })),
          { type: 'text', text: p.usuario },
        ]
      : p.usuario;
    const base = { model: modelo, messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: usuario }] };

    let { res, dados } = await chamar(cred, {
      ...base,
      response_format: { type: 'json_schema', json_schema: { name: p.nomeSchema, strict: true, schema: jsonSchema } },
    });
    if (res.status === 400 && /response_format|json_schema|schema/i.test(dados?.error?.message ?? '')) {
      ({ res, dados } = await chamar(cred, {
        ...base,
        messages: [{ role: 'system', content: `${p.sistema}\n\nResponda só com um JSON válido neste JSON Schema:\n${JSON.stringify(jsonSchema)}` }, base.messages[1]],
        response_format: { type: 'json_object' },
      }));
    }
    if (!res.ok) {
      const erro = new Error(`${dados?.error?.message || `HTTP ${res.status}`}`);
      // 429/5xx: o job tenta de novo; 4xx: erro de configuração (modelo, chave).
      throw Object.assign(erro, { status: res.status });
    }
    const escolha = dados?.choices?.[0];
    if (escolha?.message?.refusal) throw new RecusaDoModelo(escolha.message.refusal);
    if (escolha?.finish_reason === 'length') throw new Error('Resposta da IA cortada (limite de tokens)');
    const texto = escolha?.message?.content ?? '';
    const objeto = p.schema.parse(JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, '')));
    return { objeto, modelo: dados?.model ?? modelo, tokensEntrada: dados?.usage?.prompt_tokens ?? null, tokensSaida: dados?.usage?.completion_tokens ?? null };
  },
};
