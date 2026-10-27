import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Credencial } from '../credenciais.js';
import { RecusaDoModelo, type ModeloInfo, type PedidoAnalise, type ProvedorLlm, type RespostaAnalise } from './tipos.js';

// Claude pelo SDK oficial. Saída estruturada com o schema zod
// (output_config.format, validada de novo pelo zod) e o prompt de sistema em cache.

/** Modelos que aceitam o fallback do servidor em caso de recusa (beta). */
const COM_FALLBACK = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

// Por chave (e não pelo id da credencial): o teste de uma chave nova ainda não tem id.
const clientes = new Map<string, Anthropic>();
function cliente(cred: Credencial): Anthropic {
  let c = clientes.get(`${cred.baseUrl} ${cred.apiKey}`);
  if (!c) {
    // Chave e endereço sempre da credencial: o SDK leria ANTHROPIC_AUTH_TOKEN e
    // ANTHROPIC_BASE_URL do ambiente do servidor, e a chave da organização
    // poderia ir para outro host.
    c = new Anthropic({ apiKey: cred.apiKey, authToken: null, baseURL: cred.baseUrl, timeout: 120_000, maxRetries: 2 });
    clientes.set(`${cred.baseUrl} ${cred.apiKey}`, c);
  }
  return c;
}

export const anthropic: ProvedorLlm = {
  async listarModelos(cred) {
    const modelos: ModeloInfo[] = [];
    for await (const m of cliente(cred).models.list()) {
      modelos.push({
        id: m.id,
        nome: m.display_name,
        visao: m.capabilities?.image_input?.supported ?? null,
        estruturada: m.capabilities?.structured_outputs?.supported ?? null,
        contexto: m.max_input_tokens ?? null,
      });
    }
    return modelos;
  },

  async analisar<T>(cred: Credencial, modelo: string, p: PedidoAnalise<T>): Promise<RespostaAnalise<T>> {
    const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [
      ...p.imagens.map((i): Anthropic.Beta.BetaImageBlockParam => ({
        type: 'image',
        source: { type: 'base64', media_type: i.mimetype as 'image/jpeg', data: i.base64 },
      })),
      { type: 'text', text: p.usuario },
    ];
    const fallback = COM_FALLBACK.has(modelo);
    const resposta = await cliente(cred).beta.messages.create({
      model: modelo,
      max_tokens: 16000,
      system: [{ type: 'text', text: p.sistema, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: conteudo }],
      output_config: { format: betaZodOutputFormat(p.schema) },
      // Recusa de segurança: o próprio servidor tenta outro modelo (beta).
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    // create (e não parse): a recusa chega com o texto vazio e tem que ser
    // reconhecida antes de qualquer tentativa de ler o JSON.
    if (resposta.stop_reason === 'refusal') throw new RecusaDoModelo('O modelo recusou analisar esta conversa');
    if (resposta.stop_reason === 'max_tokens') throw new Error('Resposta da IA cortada (max_tokens)');
    const texto = resposta.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return {
      objeto: p.schema.parse(JSON.parse(texto)),
      modelo: resposta.model,
      tokensEntrada: (resposta.usage.input_tokens ?? 0) + (resposta.usage.cache_read_input_tokens ?? 0) + (resposta.usage.cache_creation_input_tokens ?? 0),
      tokensSaida: resposta.usage.output_tokens ?? null,
    };
  },
};
