// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jidToPhone, phoneMatchKey } from './identificacao/telefone';
import { parseEvolutionWebhook } from './provedores/evolution';

describe('phoneMatchKey', () => {
  it.each([
    ['(11) 98765-4321', '1187654321'],
    ['5511987654321', '1187654321'],
    ['+55 11 8765-4321', '1187654321'],
    ['551187654321', '1187654321'],
    ['=5519993686065', '1993686065'],
    ['(92)98457-4619', '9284574619'],
    ['5555981030909', '5581030909'], // DDD 55 (RS) com o 55 do país
    ['(11) 3456-7890', '1134567890'], // fixo: sem 9º dígito
    ['+1 415 555 2671', '14155552671'],
    ['98765-4321', null], // sem DDD: não casa
    ['', null],
    [null, null],
  ])('%s → %s', (entrada, esperado) => {
    expect(phoneMatchKey(entrada)).toBe(esperado);
  });

  it('JID do WhatsApp casa com o telefone cadastrado de outro jeito', () => {
    expect(phoneMatchKey(jidToPhone('5511987654321@s.whatsapp.net'))).toBe(phoneMatchKey('(11) 98765-4321'));
    // Contas antigas chegam sem o 9 no JID.
    expect(phoneMatchKey(jidToPhone('551187654321@s.whatsapp.net'))).toBe(phoneMatchKey('(11) 98765-4321'));
  });
});

const upsert = (data: object) => ({ event: 'messages.upsert', instance: 'x', data });
const key = (over: object = {}) => ({ remoteJid: '5511987654321@s.whatsapp.net', fromMe: false, id: 'ABC', ...over });

describe('parseEvolutionWebhook', () => {
  it('texto recebido', () => {
    const [m] = parseEvolutionWebhook(upsert({ key: key(), pushName: 'Maria Silva', message: { conversation: ' Oi! ' }, messageTimestamp: 1761580800 }));
    expect(m).toMatchObject({ kind: 'message', providerMessageId: 'ABC', phoneDigits: '5511987654321', pushName: 'Maria Silva', fromMe: false, type: 'text', body: 'Oi!' });
    expect(m.kind === 'message' && m.sentAt.toISOString()).toBe('2025-10-27T16:00:00.000Z');
  });

  it('mensagem nossa não usa o pushName (seria o nosso nome)', () => {
    const [m] = parseEvolutionWebhook(upsert({ key: key({ fromMe: true }), pushName: 'Eu', message: { extendedTextMessage: { text: 'Segue a proposta' } } }));
    expect(m).toMatchObject({ fromMe: true, pushName: null, body: 'Segue a proposta' });
  });

  it('áudio, imagem e envelopes', () => {
    const [a] = parseEvolutionWebhook(upsert({ key: key(), message: { audioMessage: { seconds: 12, mimetype: 'audio/ogg; codecs=opus', ptt: true } } }));
    expect(a).toMatchObject({ type: 'audio', body: null, media: { seconds: 12, ptt: true } });
    const [i] = parseEvolutionWebhook(upsert({ key: key(), message: { ephemeralMessage: { message: { imageMessage: { caption: 'print', mimetype: 'image/jpeg' } } } } }));
    expect(i).toMatchObject({ type: 'image', body: 'print', media: { mimetype: 'image/jpeg' } });
  });

  it('ignora grupos, status, reações e apagadas', () => {
    expect(parseEvolutionWebhook(upsert({ key: key({ remoteJid: '1203630@g.us' }), message: { conversation: 'oi' } }))).toEqual([]);
    expect(parseEvolutionWebhook(upsert({ key: key({ remoteJid: 'status@broadcast' }), message: { conversation: 'oi' } }))).toEqual([]);
    expect(parseEvolutionWebhook(upsert({ key: key(), message: { reactionMessage: { text: '👍' } } }))).toEqual([]);
    expect(parseEvolutionWebhook(upsert({ key: key(), message: { protocolMessage: { type: 0 } } }))).toEqual([]);
    expect(parseEvolutionWebhook(upsert({ key: key(), message: { senderKeyDistributionMessage: {}, messageContextInfo: {} } }))).toEqual([]);
  });

  it('@lid usa o telefone alternativo', () => {
    const [m] = parseEvolutionWebhook(upsert({ key: key({ remoteJid: '1234567890@lid', remoteJidAlt: '5511987654321@s.whatsapp.net' }), message: { conversation: 'oi' } }));
    expect(m).toMatchObject({ remoteJid: '1234567890@lid', phoneDigits: '5511987654321' });
    const [s] = parseEvolutionWebhook(upsert({ key: key({ remoteJid: '1234567890@lid' }), message: { conversation: 'oi' } }));
    expect(s).toMatchObject({ phoneDigits: null });
  });

  it('eventos de conexão, em qualquer grafia', () => {
    expect(parseEvolutionWebhook({ event: 'CONNECTION_UPDATE', data: { state: 'open', wuid: '5511999990000@s.whatsapp.net' } }))
      .toEqual([{ kind: 'connection', status: 'connected', detail: null, phoneNumber: '5511999990000' }]);
    expect(parseEvolutionWebhook({ event: 'qrcode.updated', data: { qrcode: { base64: 'x' } } })).toMatchObject([{ status: 'qr' }]);
    expect(parseEvolutionWebhook({ event: 'presence.update', data: {} })).toEqual([]);
  });
});

describe('transcrever (API de áudio formato OpenAI)', async () => {
  const { transcrever, LimiteDeTaxa, ErroPermanente, TAMANHO_MAXIMO } = await import('./transcricao/whisper');
  const cred = { id: 'c', organizationId: 'o', provider: 'groq' as const, baseUrl: 'https://x/v1', apiKey: 'k' };
  const responder = (status: number, body: object, headers: Record<string, string> = {}) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers }));

  afterEach(() => vi.restoreAllMocks());

  it('devolve o texto e manda modelo, idioma e extensão certa', async () => {
    const f = responder(200, { text: ' oi tudo bem ' });
    expect(await transcrever(cred, 'whisper-large-v3-turbo', Buffer.from('x'), 'audio/ogg; codecs=opus', 'pt')).toBe('oi tudo bem');
    const form = f.mock.calls[0][1]!.body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect(form.get('language')).toBe('pt');
    expect((form.get('file') as File).name).toBe('audio.ogg');
  });

  it('429 vira LimiteDeTaxa com o retry-after', async () => {
    responder(429, { error: { message: 'Rate limit' } }, { 'retry-after': '12' });
    const e = await transcrever(cred, 'm', Buffer.from('x'), 'audio/ogg', 'pt').catch((x) => x);
    expect(e).toBeInstanceOf(LimiteDeTaxa);
    expect(e.esperarSegundos).toBe(12);
  });

  it('4xx é permanente; 5xx tenta de novo', async () => {
    responder(400, { error: { message: 'formato' } });
    await expect(transcrever(cred, 'm', Buffer.from('x'), 'audio/ogg', 'pt')).rejects.toBeInstanceOf(ErroPermanente);
    responder(503, {});
    const e = await transcrever(cred, 'm', Buffer.from('x'), 'audio/ogg', 'pt').catch((x) => x);
    expect(e).not.toBeInstanceOf(ErroPermanente);
    expect(e).not.toBeInstanceOf(LimiteDeTaxa);
  });

  it('áudio acima de 25 MB nem é enviado', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    await expect(transcrever(cred, 'm', Buffer.alloc(TAMANHO_MAXIMO + 1), 'audio/ogg', 'pt')).rejects.toBeInstanceOf(ErroPermanente);
    expect(f).not.toHaveBeenCalled();
  });
});
