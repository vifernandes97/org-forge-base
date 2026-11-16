// Chatvolt (número da API oficial da Meta atendido pela Bia, docs/WHATSAPP.md
// §20). O Chatvolt não passa pela Evolution: as mensagens chegam pelo webhook
// de saída do agente (docs.chatvolt.ai/agent/webhooks), sem QR nem instância.
// Um evento pode trazer duas mensagens: a do lead (userMessage) e a resposta
// do agente (agentResponse). Quem escreveu vai em raw.autor, que a análise
// mostra como "Contato", "Assistente virtual (IA)" ou "Equipe".
/* eslint-disable @typescript-eslint/no-explicit-any -- payload externo, validado campo a campo */
import type { ChannelProvider, EventoNormalizado, MensagemNormalizada, MidiaBaixada, TipoMensagem } from '../nucleo/tipos.js';

export type AutorChatvolt = 'lead' | 'ia' | 'equipe';

/** Quem escreveu cada parte, por evento. Os demais (bloqueada, nota, grupo, NPS, etapa) não viram mensagem. */
const PARTES: Record<string, { user?: AutorChatvolt; agent?: AutorChatvolt }> = {
  AGENT_USER_MESSAGE: { user: 'lead', agent: 'ia' },
  USER_MESSAGE_RECEIVED: { user: 'lead' },
  AGENT_MESSAGE_SENDED: { agent: 'equipe' },
  AGENT_MESSAGE_FOLLOW_UP: { agent: 'ia' },
};

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Dígitos com DDI. O Chatvolt manda "+55 13 9…", "5513…" ou só DDD + número. */
export function telefoneChatvolt(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d.length >= 12 && d.length <= 15 ? d : null;
}

function tipoDoAnexo(mime: string): TipoMensagem {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return mime ? 'document' : 'other';
}

/** Data do evento; sem ela, agora (a mensagem repetida pelo Chatvolt aí não é reconhecida). */
function instante(v: unknown): Date {
  const n = typeof v === 'number' ? v : NaN;
  const d = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n) : new Date(texto(v));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function parseChatvoltWebhook(body: any): EventoNormalizado[] {
  if (!body || typeof body !== 'object') return [];
  const conversa = texto(body.conversationId);
  const evento = texto(body.eventType) || (texto(body.userMessage) && texto(body.agentResponse) ? 'AGENT_USER_MESSAGE' : '');
  // Qualquer evento válido (inclusive o POST de teste ao salvar no Chatvolt) mostra a conexão como ativa.
  const eventos: EventoNormalizado[] = [{ kind: 'connection', status: 'connected', detail: null, phoneNumber: null }];
  const partes = PARTES[evento];
  if (!conversa || !partes) return eventos;

  const vars = body.conversation_variables && typeof body.conversation_variables === 'object' ? body.conversation_variables : {};
  const phoneDigits = telefoneChatvolt(body.userPhoneNumber) ?? telefoneChatvolt(vars['user-phone-number']);
  // Uma conversa por telefone (é o que liga ao contato); sem telefone, pela conversa do Chatvolt.
  const remoteJid = phoneDigits ? `${phoneDigits}@s.whatsapp.net` : `${conversa}@chatvolt`;
  const id = texto(body.messageId) || `${conversa}-${texto(body.createdAt) || Date.now()}`;
  const quando = instante(body.createdAt);
  const anexos: any[] = Array.isArray(body.attachments) ? body.attachments.filter((a: any) => a && typeof a.url === 'string') : [];

  const msg = (parte: 'user' | 'agent', autor: AutorChatvolt, corpo: string, sentAt: Date): MensagemNormalizada | null => {
    // Anexo vai na mensagem do lead quando há uma; senão, na do agente (envio da equipe).
    const anexo = (parte === 'user' || !partes.user) ? anexos[0] : undefined;
    if (!corpo && !anexo) return null;
    const mime = texto(anexo?.mimeType);
    const type: TipoMensagem = anexo ? tipoDoAnexo(mime) : 'text';
    return {
      kind: 'message',
      providerMessageId: `${id}:${parte}`,
      remoteJid,
      phoneDigits,
      pushName: autor === 'lead' ? texto(body.userName) || null : null,
      fromMe: autor !== 'lead',
      type,
      body: corpo || null,
      media: anexo ? { mimetype: mime || undefined, caption: corpo || undefined, fileName: texto(anexo.name) || undefined } : null,
      sentAt,
      raw: { ...body, autor, parte, anexo: anexo ?? null },
    };
  };

  // A pergunta do lead vem antes da resposta no mesmo evento: 1 s antes, para a ordem da conversa.
  const lead = partes.user ? msg('user', partes.user, texto(body.userMessage), partes.agent ? new Date(quando.getTime() - 1000) : quando) : null;
  const agente = partes.agent ? msg('agent', partes.agent, texto(body.agentResponse), quando) : null;
  for (const m of [lead, agente]) if (m) eventos.push(m);
  return eventos;
}

// Sem instância nem QR: o número é da API oficial e a conexão é só o webhook,
// configurado à mão no agente do Chatvolt com a URL que a tela mostra.
export const chatvolt: ChannelProvider = {
  parseWebhook: parseChatvoltWebhook,
  async ensureInstance() {},
  async setWebhook() {},
  async connect() {
    return { status: 'connected', qrCode: null, pairingCode: null };
  },
  async status() {
    return { status: 'connected', phoneNumber: null };
  },
  async removeInstance() {},
  async fetchMedia(server, _instance, raw): Promise<MidiaBaixada> {
    const url = texto((raw as any)?.anexo?.url);
    if (!/^https:\/\//.test(url)) throw new Error('Mensagem do Chatvolt sem anexo');
    // Anexo do Chatvolt é link de arquivo; a chave só vai para a própria API do Chatvolt.
    const proprio = new URL(url).hostname.endsWith('chatvolt.ai');
    const r = await fetch(url, { headers: proprio ? { authorization: `Bearer ${server.apiKey}` } : {}, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`Chatvolt anexo: ${r.status}`);
    return { data: Buffer.from(await r.arrayBuffer()), mimetype: texto((raw as any)?.anexo?.mimeType) || r.headers.get('content-type') || 'application/octet-stream' };
  },
};
