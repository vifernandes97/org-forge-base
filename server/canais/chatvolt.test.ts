// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseChatvoltWebhook, telefoneChatvolt } from './provedores/chatvolt';
import type { MensagemNormalizada } from './nucleo/tipos';

const base = {
  conversationId: 'cmwjhj05v2d7p1dqpgzd9e4y4',
  agentId: 'ag1',
  channel: 'whatsapp',
  conversationStatus: 'HUMAN_REQUESTED',
  isAiEnabled: false,
  userPhoneNumber: '+5513997092891',
  userName: 'Déby Festas E Eventos',
  messageId: 'msg1',
  createdAt: '2026-11-16T18:16:00.000Z',
};

const mensagens = (corpo: unknown) => parseChatvoltWebhook(corpo).filter((e): e is MensagemNormalizada => e.kind === 'message');

describe('telefoneChatvolt', () => {
  it.each([
    ['+5513997092891', '5513997092891'],
    ['5513997092891', '5513997092891'],
    ['(13) 99709-2891', '5513997092891'],
    ['', null],
    [undefined, null],
  ])('%s → %s', (entrada, esperado) => expect(telefoneChatvolt(entrada)).toBe(esperado));
});

describe('parseChatvoltWebhook', () => {
  it('mensagem do lead com a IA desligada', () => {
    const [m] = mensagens({ ...base, eventType: 'USER_MESSAGE_RECEIVED', userMessage: 'Sim' });
    expect(m).toMatchObject({
      providerMessageId: 'msg1:user', remoteJid: '5513997092891@s.whatsapp.net', phoneDigits: '5513997092891',
      fromMe: false, pushName: 'Déby Festas E Eventos', type: 'text', body: 'Sim',
    });
    expect((m.raw as { autor: string }).autor).toBe('lead');
  });

  it('humano pela caixa do Chatvolt vira Equipe', () => {
    const [m] = mensagens({ ...base, eventType: 'AGENT_MESSAGE_SENDED', agentResponse: 'Pode ser amanhã as 10h?' });
    expect(m).toMatchObject({ providerMessageId: 'msg1:agent', fromMe: true, pushName: null, body: 'Pode ser amanhã as 10h?' });
    expect((m.raw as { autor: string }).autor).toBe('equipe');
  });

  it('lead e resposta da IA no mesmo evento, lead primeiro', () => {
    const [lead, ia] = mensagens({ ...base, eventType: 'AGENT_USER_MESSAGE', userMessage: 'Quanto custa?', agentResponse: 'O plano Pro sai R$ 399.' });
    expect(lead.fromMe).toBe(false);
    expect(ia.fromMe).toBe(true);
    expect((ia.raw as { autor: string }).autor).toBe('ia');
    expect(lead.sentAt.getTime()).toBeLessThan(ia.sentAt.getTime());
    expect(lead.providerMessageId).not.toBe(ia.providerMessageId);
  });

  it('anexo do lead vira mídia', () => {
    const [m] = mensagens({ ...base, eventType: 'USER_MESSAGE_RECEIVED', userMessage: '', attachments: [{ id: 'a', url: 'https://x.chatvolt.ai/a.ogg', mimeType: 'audio/ogg', size: 10 }] });
    expect(m).toMatchObject({ type: 'audio', body: null, media: { mimetype: 'audio/ogg' } });
  });

  it('sem telefone: conversa pelo id do Chatvolt', () => {
    const [m] = mensagens({ ...base, userPhoneNumber: undefined, eventType: 'USER_MESSAGE_RECEIVED', userMessage: 'Oi' });
    expect(m).toMatchObject({ remoteJid: 'cmwjhj05v2d7p1dqpgzd9e4y4@chatvolt', phoneDigits: null });
  });

  it('telefone pelas variáveis da conversa', () => {
    const [m] = mensagens({ ...base, userPhoneNumber: undefined, conversation_variables: { 'user-phone-number': '5513997092891' }, eventType: 'USER_MESSAGE_RECEIVED', userMessage: 'Oi' });
    expect(m.phoneDigits).toBe('5513997092891');
  });

  it('eventos sem mensagem e o teste de URL só marcam a conexão', () => {
    for (const corpo of [{ ...base, eventType: 'AGENT_MESSAGE_BLOCKED', agentResponse: 'x' }, { ...base, eventType: 'NPS_INTERACTION' }, { test: true }]) {
      const ev = parseChatvoltWebhook(corpo);
      expect(ev).toEqual([{ kind: 'connection', status: 'connected', detail: null, phoneNumber: null }]);
    }
  });

  it('mesmo evento repetido gera os mesmos ids e instantes (não duplica)', () => {
    const corpo = { ...base, eventType: 'AGENT_USER_MESSAGE', userMessage: 'a', agentResponse: 'b' };
    const [a1, b1] = mensagens(corpo);
    const [a2, b2] = mensagens(corpo);
    expect([a1.providerMessageId, a1.sentAt.getTime(), b1.providerMessageId]).toEqual([a2.providerMessageId, a2.sentAt.getTime(), b2.providerMessageId]);
  });
});
