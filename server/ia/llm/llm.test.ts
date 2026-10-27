// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { Decisao } from '../analise/decisao';
import { anthropic } from './anthropic';
import { google } from './google';
import { openai } from './openai';
import { RecusaDoModelo } from './tipos';

const decisao = {
  comercial: true, lead_id: 'L1', resumo: 'Fechou.', mudar_etapa: { etapa_id: 'S2', confianca: 0.9, motivo: 'disse fechado' },
  tarefas: [], valor: null, novo_negocio: null,
};
const pedido = { sistema: 'regras', usuario: 'mensagens', imagens: [{ mimetype: 'image/png', base64: 'AAAA' }], schema: Decisao, nomeSchema: 'decisao_crm' };
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const corpoDe = (f: MockInstance, i = 0) => {
  const [input, init] = f.mock.calls[i] as [RequestInfo | URL, RequestInit | undefined];
  const req = input instanceof Request ? input : null;
  return { url: String(req ? req.url : input), body: JSON.parse(String(init?.body ?? '{}')), headers: new Headers(init?.headers ?? req?.headers) };
};

// Nenhuma chamada sai para a rede: o que não foi preparado no teste falha.
let f: MockInstance;
beforeEach(() => {
  f = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('rede bloqueada no teste'));
});
afterEach(() => vi.restoreAllMocks());
// O cliente da Anthropic é guardado por chave: uma chave por teste pega o fetch do teste.
let n = 0;
const chave = () => `sk-ant-teste-${++n}`;

describe('anthropic', () => {
  const cred = () => ({ id: 'a', organizationId: 'o', provider: 'anthropic' as const, baseUrl: 'https://api.anthropic.com', apiKey: chave() });
  const mensagem = (texto: string, stop = 'end_turn') => json({
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: stop, stop_sequence: null,
    content: [{ type: 'text', text: texto }],
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
  });

  it('manda schema, cache do sistema, imagem e fallback; devolve o objeto validado', async () => {
    f.mockResolvedValueOnce(mensagem(JSON.stringify(decisao)));
    const c = cred();
    const r = await anthropic.analisar(c, 'claude-opus-5-5', pedido);
    expect(r.objeto).toEqual(decisao);
    expect(r.tokensEntrada).toBe(1000);
    const { url, body, headers } = corpoDe(f);
    // Nunca o ANTHROPIC_BASE_URL/AUTH_TOKEN do ambiente: o host e a chave da credencial.
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(headers.get('authorization')).toBe(`Bearer ${c.apiKey}`);
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(body.fallbacks).toBe('default');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.output_config.format.schema.properties.mudar_etapa).toBeTruthy();
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });
  });

  it('modelo sem fallback não manda o beta; recusa vira RecusaDoModelo', async () => {
    f.mockResolvedValueOnce(mensagem('', 'refusal'));
    await expect(anthropic.analisar(cred(), 'claude-haiku-5-5', pedido)).rejects.toBeInstanceOf(RecusaDoModelo);
    const { body, headers } = corpoDe(f);
    expect(body.fallbacks).toBeUndefined();
    expect(headers.get('anthropic-beta')).toBeNull();
  });

  it('lista modelos com visão e saída estruturada', async () => {
    f.mockResolvedValueOnce(json({
      data: [{ id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', type: 'model', created_at: '2026-01-01T00:00:00Z', max_input_tokens: 1000000,
        capabilities: { image_input: { supported: true }, structured_outputs: { supported: true } } }],
      has_more: false, first_id: 'claude-opus-5-5', last_id: 'claude-opus-5-5',
    }));
    expect(await anthropic.listarModelos(cred())).toEqual([{ id: 'claude-opus-5-5', nome: 'Claude Opus 5.5', visao: true, estruturada: true, contexto: 1000000 }]);
  });
});

describe('google', () => {
  const cred = { id: 'g', organizationId: 'o', provider: 'google' as const, baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: 'AIza-teste' };

  it('manda JSON schema e imagem inline; valida a resposta', async () => {
    f.mockResolvedValueOnce(json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(decisao) }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }, modelVersion: 'gemini-x',
    }));
    const r = await google.analisar(cred, 'gemini-x', pedido);
    expect(r.objeto).toEqual(decisao);
    const { url, body, headers } = corpoDe(f);
    expect(url).toContain('/models/gemini-x:generateContent');
    expect(headers.get('x-goog-api-key')).toBe('AIza-teste');
    expect(body.generationConfig.responseJsonSchema.properties.resumo).toBeTruthy();
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe('image/png');
  });

  it('bloqueio de segurança vira RecusaDoModelo', async () => {
    f.mockResolvedValueOnce(json({ promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(google.analisar(cred, 'gemini-x', pedido)).rejects.toBeInstanceOf(RecusaDoModelo);
  });
});

describe('openai e compatíveis', () => {
  const cred = { id: 'o', organizationId: 'o', provider: 'groq' as const, baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'gsk' };

  it('cai para json_object quando o modelo não aceita json_schema', async () => {
    f.mockResolvedValueOnce(json({ error: { message: 'response_format json_schema not supported' } }, 400))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: '```json\n' + JSON.stringify(decisao) + '\n```' }, finish_reason: 'stop' }] }));
    expect((await openai.analisar(cred, 'llama', pedido)).objeto).toEqual(decisao);
    expect(corpoDe(f, 0).body.response_format.type).toBe('json_schema');
    expect(corpoDe(f, 1).body.response_format.type).toBe('json_object');
  });

  it('JSON fora do schema é erro (não grava decisão inventada)', async () => {
    f.mockResolvedValueOnce(json({ choices: [{ message: { content: '{"comercial":"sim"}' }, finish_reason: 'stop' }] }));
    await expect(openai.analisar(cred, 'llama', pedido)).rejects.toThrow();
  });
});
