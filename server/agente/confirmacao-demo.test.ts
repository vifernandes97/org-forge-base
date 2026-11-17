// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  codigoDoMeet, configuracao, corpoDoTemplate, enviarTemplate, horaDaDemo, textoDaConfirmacao, type ConfirmacaoConfig,
} from './confirmacao-demo.js';

const cfg: ConfirmacaoConfig = {
  org: 'org-1', chave: 'chave', phoneId: '1335362613004445', agentId: 'cmwd4q43544zk49ekk0n9a2ws', template: 'oni_confirmacao_demo_v3',
};
const dados = { telefone: '5511987654321', nome: 'Ana', hora: '14:00', codigoMeet: 'abc-defg-hij', contato: 'Ana Souza' };

describe('configuracao', () => {
  const env = {
    CONFIRMACAO_DEMO_ATIVA: '1', CHATVOLT_AGENTE_ORG: 'org-1', CHATVOLT_API_KEY: 'k',
    CHATVOLT_WHATSAPP_PHONE_ID: '1335362613004445', CHATVOLT_AGENT_ID: 'ag',
  } as NodeJS.ProcessEnv;

  it('fica desligada sem CONFIRMACAO_DEMO_ATIVA=1', () => {
    expect(configuracao({ ...env, CONFIRMACAO_DEMO_ATIVA: undefined })).toBeNull();
    expect(configuracao({ ...env, CONFIRMACAO_DEMO_ATIVA: '0' })).toBeNull();
  });
  it('fica desligada se falta qualquer variável do Chatvolt', () => {
    for (const k of ['CHATVOLT_AGENTE_ORG', 'CHATVOLT_API_KEY', 'CHATVOLT_WHATSAPP_PHONE_ID', 'CHATVOLT_AGENT_ID']) {
      expect(configuracao({ ...env, [k]: '' })).toBeNull();
    }
  });
  it('recusa phoneNumberId que não é número (não confundir com o telefone formatado)', () => {
    expect(configuracao({ ...env, CHATVOLT_WHATSAPP_PHONE_ID: '+55 13 99999-0573' })).toBeNull();
  });
  it('usa o template v3 por padrão e aceita outro', () => {
    expect(configuracao(env)?.template).toBe('oni_confirmacao_demo_v3');
    expect(configuracao({ ...env, CONFIRMACAO_DEMO_TEMPLATE: 'outro' })?.template).toBe('outro');
  });
});

describe('codigoDoMeet', () => {
  it('extrai o código do link do Meet', () => {
    expect(codigoDoMeet('https://meet.google.com/abc-defg-hij')).toBe('abc-defg-hij');
    expect(codigoDoMeet(' https://meet.google.com/abc-defg-hij?authuser=0 ')).toBe('abc-defg-hij');
  });
  it('recusa o que não é Meet ou não tem código', () => {
    expect(codigoDoMeet(null)).toBeNull();
    expect(codigoDoMeet('')).toBeNull();
    expect(codigoDoMeet('https://meet.google.com/')).toBeNull();
    expect(codigoDoMeet('https://zoom.us/j/123456')).toBeNull();
    expect(codigoDoMeet('http://meet.google.com/abc-defg-hij')).toBeNull();
    expect(codigoDoMeet('https://meet.google.com.evil.com/abc-defg-hij')).toBeNull();
  });
});

describe('horaDaDemo', () => {
  it('formata HH:mm no fuso de São Paulo (UTC-3)', () => {
    expect(horaDaDemo(new Date('2026-11-17T17:00:00Z'))).toBe('14:00');
    expect(horaDaDemo(new Date('2026-11-17T12:30:00Z'))).toBe('09:30');
    expect(horaDaDemo(new Date('2026-11-18T03:05:00Z'))).toBe('00:05');
  });
});

describe('corpoDoTemplate', () => {
  it('monta variáveis, botão de URL (índice 0) e o texto já preenchido', () => {
    const c = corpoDoTemplate(cfg, dados);
    expect(c).toMatchObject({
      to: '5511987654321', agentId: cfg.agentId, templateName: 'oni_confirmacao_demo_v3', templateLangCode: 'pt_BR',
      var_1: 'Ana', var_2: '14:00', buttons: [{ type: 'url', value: 'abc-defg-hij', index: '0' }], contactName: 'Ana Souza',
    });
    expect(c.text).toBe(textoDaConfirmacao('Ana', '14:00'));
    expect(c.text).toContain('confirmar a demonstração às 14:00');
  });
  it('sem nome que pareça nome, não deixa {{1}} vazio', () => {
    const c = corpoDoTemplate(cfg, { ...dados, nome: null, contato: null });
    expect(c.var_1).toBe('tudo bem');
    expect(c.text.startsWith('Olá, tudo bem!')).toBe(true);
    expect('contactName' in c).toBe(false);
  });
});

describe('enviarTemplate', () => {
  const resposta = (status: number, corpo: unknown) =>
    (async () => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status })) as unknown as typeof fetch;

  it('chama o endpoint do número com Bearer e devolve os ids', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const f = (async (u: string, i: RequestInit) => {
      url = u; init = i;
      return new Response(JSON.stringify({ id: 'conv-1', messages: [{ id: 'msg-1', from: 'agent' }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await enviarTemplate(cfg, dados, f);
    expect(r).toEqual({ ok: true, conversationId: 'conv-1', messageId: 'msg-1' });
    expect(url).toBe('https://api.chatvolt.ai/whatsapp/1335362613004445/template-message');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer chave');
    expect(JSON.parse(String(init?.body)).var_2).toBe('14:00');
  });
  it('200 sem JSON conta como enviado, sem ids', async () => {
    expect(await enviarTemplate(cfg, dados, resposta(200, 'ok'))).toEqual({ ok: true, conversationId: null, messageId: null });
  });
  it('erro HTTP vira falha com o motivo', async () => {
    const r = await enviarTemplate(cfg, dados, resposta(500, { error: 'template rejected' }));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toContain('HTTP 500');
  });
  it('erro de rede vira falha, não exceção', async () => {
    const f = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    expect(await enviarTemplate(cfg, dados, f)).toEqual({ ok: false, motivo: 'ECONNRESET' });
  });
});
