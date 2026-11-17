// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { boasVindasChatvolt, corpoBoasVindasChatvolt, textoPrimeiroContato } from './boas-vindas.js';
import { credencialChatvolt, postarTemplate } from './chatvolt-template.js';

const ORG = '00000000-0000-0000-0000-0000000000a1';
const env = {
  BOAS_VINDAS_CHATVOLT: '1', CHATVOLT_AGENTE_ORG: ORG, CHATVOLT_API_KEY: 'k',
  CHATVOLT_WHATSAPP_PHONE_ID: '1335362613004445', CHATVOLT_AGENT_ID: 'ag',
} as NodeJS.ProcessEnv;

describe('credencialChatvolt', () => {
  it('monta a credencial do ambiente', () => {
    expect(credencialChatvolt(env)).toEqual({ chave: 'k', phoneId: '1335362613004445', agentId: 'ag' });
  });
  it('nula se faltar parte ou se o phoneId não for numérico', () => {
    for (const k of ['CHATVOLT_API_KEY', 'CHATVOLT_WHATSAPP_PHONE_ID', 'CHATVOLT_AGENT_ID']) {
      expect(credencialChatvolt({ ...env, [k]: '' })).toBeNull();
    }
    expect(credencialChatvolt({ ...env, CHATVOLT_WHATSAPP_PHONE_ID: '+55 13 99999-0573' })).toBeNull();
  });
});

describe('boasVindasChatvolt', () => {
  it('fica desligada sem BOAS_VINDAS_CHATVOLT=1', () => {
    expect(boasVindasChatvolt(ORG, { ...env, BOAS_VINDAS_CHATVOLT: undefined })).toBeNull();
    expect(boasVindasChatvolt(ORG, { ...env, BOAS_VINDAS_CHATVOLT: '0' })).toBeNull();
  });
  it('só vale para a organização do Chatvolt', () => {
    expect(boasVindasChatvolt('outra-org', env)).toBeNull();
    expect(boasVindasChatvolt(ORG, { ...env, CHATVOLT_AGENTE_ORG: '' })).toBeNull();
  });
  it('fica desligada se a credencial do Chatvolt estiver incompleta', () => {
    expect(boasVindasChatvolt(ORG, { ...env, CHATVOLT_AGENT_ID: '' })).toBeNull();
  });
  it('usa oni_primeiro_contato por padrão e aceita outro template', () => {
    expect(boasVindasChatvolt(ORG, env)?.template).toBe('oni_primeiro_contato');
    expect(boasVindasChatvolt(ORG, { ...env, BOAS_VINDAS_TEMPLATE: 'outro' })?.template).toBe('outro');
  });
});

describe('corpoBoasVindasChatvolt', () => {
  const cfg = boasVindasChatvolt(ORG, env)!;
  it('manda o primeiro nome em var_1 e o texto do template na conversa', () => {
    const c = corpoBoasVindasChatvolt(cfg, { telefone: '5511987654321', nome: 'Ana', contato: 'Ana Souza' });
    expect(c).toEqual({
      to: '5511987654321', text: textoPrimeiroContato('Ana'), agentId: 'ag', templateName: 'oni_primeiro_contato',
      templateLangCode: 'pt_BR', var_1: 'Ana', contactName: 'Ana Souza',
    });
    expect(c.text.startsWith('Oi, Ana! Aqui é da Oniplataforma.')).toBe(true);
  });
  it('sem nome que pareça nome, não deixa {{1}} vazio e não manda contactName', () => {
    const c = corpoBoasVindasChatvolt(cfg, { telefone: '5511987654321', nome: null, contato: null });
    expect(c.var_1).toBe('tudo bem');
    expect(c.text.startsWith('Oi, tudo bem!')).toBe(true);
    expect('contactName' in c).toBe(false);
  });
  it('o botão é resposta rápida: não leva parâmetro de botão', () => {
    expect('buttons' in corpoBoasVindasChatvolt(cfg, { telefone: '5511987654321', nome: 'Ana', contato: null })).toBe(false);
  });
});

describe('postarTemplate', () => {
  const cred = { chave: 'k', phoneId: '1335362613004445', agentId: 'ag' };
  it('devolve ids da conversa e da mensagem', async () => {
    const f = (async () => new Response(JSON.stringify({ id: 'c1', messages: [{ id: 'm1' }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await postarTemplate(cred, { to: '5511987654321' }, f)).toEqual({ ok: true, conversationId: 'c1', messageId: 'm1' });
  });
  it('a falha da Meta vira { ok: false } com o motivo', async () => {
    const f = (async () => new Response('{"error":"template rejected"}', { status: 500 })) as unknown as typeof fetch;
    const r = await postarTemplate(cred, {}, f);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toContain('HTTP 500');
  });
});
