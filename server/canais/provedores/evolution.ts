// Evolution API v2 (Baileys). Tudo que conhece o payload e as rotas da
// Evolution fica aqui; o resto do orquestrador vê só os tipos de nucleo/tipos.ts.
/* eslint-disable @typescript-eslint/no-explicit-any -- payload externo, validado campo a campo */
import { jidToPhone, tipoJid } from '../identificacao/telefone.js';
import type { ChannelProvider, EstadoConexao, EventoNormalizado, MensagemNormalizada, MidiaInfo, ServidorCanal, TipoMensagem } from '../nucleo/tipos.js';

// Só o que o orquestrador usa. MESSAGES_SET (histórico) fica para o backfill.
const EVENTOS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];

/** "MESSAGES_UPSERT" e "messages.upsert" aparecem conforme a versão/config. */
const nomeEvento = (e: unknown) => String(e ?? '').toLowerCase().replace(/_/g, '.');

/** Tira os envelopes (temporária, visualização única, documento com legenda). */
function desembrulhar(message: any): any {
  let m = message;
  for (let i = 0; i < 4 && m; i++) {
    const dentro = m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ?? m.viewOnceMessageV2?.message
      ?? m.viewOnceMessageV2Extension?.message ?? m.documentWithCaptionMessage?.message;
    if (!dentro) break;
    m = dentro;
  }
  return m;
}

function conteudo(message: any): { type: TipoMensagem; body: string | null; media: MidiaInfo | null } | null {
  const m = desembrulhar(message);
  if (!m) return null;
  // Sem conteúdo próprio: apagar/editar (protocol), reação, enquete atualizada…
  if (m.protocolMessage || m.reactionMessage || m.pollUpdateMessage) return null;
  if (Object.keys(m).every((k) => k === 'messageContextInfo' || k === 'senderKeyDistributionMessage')) return null;
  if (typeof m.conversation === 'string') return { type: 'text', body: m.conversation, media: null };
  if (m.extendedTextMessage) return { type: 'text', body: m.extendedTextMessage.text ?? null, media: null };
  if (m.imageMessage) {
    const i = m.imageMessage;
    return { type: 'image', body: i.caption ?? null, media: { mimetype: i.mimetype, caption: i.caption } };
  }
  if (m.audioMessage) {
    const a = m.audioMessage;
    return { type: 'audio', body: null, media: { mimetype: a.mimetype, seconds: Number(a.seconds) || undefined, ptt: !!a.ptt } };
  }
  if (m.videoMessage) {
    const v = m.videoMessage;
    return { type: 'video', body: v.caption ?? null, media: { mimetype: v.mimetype, seconds: Number(v.seconds) || undefined, caption: v.caption } };
  }
  if (m.documentMessage) {
    const d = m.documentMessage;
    return { type: 'document', body: d.caption ?? null, media: { mimetype: d.mimetype, fileName: d.fileName, caption: d.caption } };
  }
  if (m.stickerMessage) return { type: 'sticker', body: null, media: { mimetype: m.stickerMessage.mimetype } };
  if (m.locationMessage) {
    const l = m.locationMessage;
    return { type: 'location', body: [l.name, l.address, `${l.degreesLatitude},${l.degreesLongitude}`].filter(Boolean).join(' · '), media: null };
  }
  if (m.contactMessage) return { type: 'contact', body: m.contactMessage.displayName ?? null, media: null };
  if (m.contactsArrayMessage) return { type: 'contact', body: (m.contactsArrayMessage.contacts ?? []).map((c: any) => c.displayName).join(', '), media: null };
  if (m.buttonsResponseMessage) return { type: 'text', body: m.buttonsResponseMessage.selectedDisplayText ?? null, media: null };
  if (m.listResponseMessage) return { type: 'text', body: m.listResponseMessage.title ?? null, media: null };
  return { type: 'other', body: null, media: null };
}

function mensagem(d: any): MensagemNormalizada | null {
  const key = d?.key;
  if (!key?.id || !key.remoteJid) return null;
  const jid: string = key.remoteJid;
  const tipo = tipoJid(jid);
  // Decisão do dono: só conversas privadas (sem grupos, status, canais).
  if (tipo !== 'person' && tipo !== 'lid') return null;

  const c = conteudo(d.message);
  if (!c) return null;

  // Conta com número oculto (@lid): a Evolution v2.3+ manda o telefone à parte.
  const phoneDigits = jidToPhone(jid) ?? jidToPhone(key.remoteJidAlt) ?? jidToPhone(key.senderPn);
  const ts = Number(d.messageTimestamp);
  const fromMe = !!key.fromMe;
  return {
    kind: 'message',
    providerMessageId: String(key.id),
    remoteJid: jid,
    phoneDigits,
    pushName: fromMe ? null : (d.pushName?.trim() || null),
    fromMe,
    type: c.type,
    body: c.body?.trim() || null,
    media: c.media,
    sentAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
    raw: d,
  };
}

const ESTADOS: Record<string, EstadoConexao> = { open: 'connected', connecting: 'pending', close: 'disconnected', refused: 'error' };

export function parseEvolutionWebhook(body: any): EventoNormalizado[] {
  const evento = nomeEvento(body?.event);
  if (evento === 'messages.upsert') {
    const itens = Array.isArray(body.data) ? body.data : Array.isArray(body.data?.messages) ? body.data.messages : [body.data];
    return itens.map(mensagem).filter((m: MensagemNormalizada | null): m is MensagemNormalizada => !!m);
  }
  if (evento === 'connection.update') {
    const d = body.data ?? {};
    return [{
      kind: 'connection',
      status: ESTADOS[d.state] ?? 'pending',
      detail: d.statusReason != null ? String(d.statusReason) : null,
      phoneNumber: jidToPhone(d.wuid),
    }];
  }
  if (evento === 'qrcode.updated') return [{ kind: 'connection', status: 'qr', detail: null, phoneNumber: null }];
  return [];
}

// ---------- API ----------

async function chamar(server: ServidorCanal, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(server.baseUrl.replace(/\/+$/, '') + path, {
    method,
    headers: { apikey: server.apiKey, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const texto = await res.text();
  let dados: any = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
  if (!res.ok) {
    const msg = dados?.response?.message ?? dados?.message ?? dados?.error ?? texto;
    throw Object.assign(new Error(`Evolution ${method} ${path}: ${res.status} ${Array.isArray(msg) ? msg.join('; ') : msg}`), { status: res.status });
  }
  return dados;
}

const webhookConfig = (url: string | null) => ({
  enabled: !!url,
  url: url ?? '',
  byEvents: false,
  base64: false,
  events: EVENTOS,
});

const enc = encodeURIComponent;

async function instancia(server: ServidorCanal, instance: string): Promise<any | null> {
  const lista = await chamar(server, 'GET', `/instance/fetchInstances?instanceName=${enc(instance)}`).catch((e) => {
    if (e.status === 404) return [];
    throw e;
  });
  const arr = Array.isArray(lista) ? lista : [];
  // v2.2+: { name, ownerJid, connectionStatus }; antes: { instance: { instanceName, owner, status } }
  return arr.find((i: any) => (i.name ?? i.instance?.instanceName) === instance) ?? null;
}

export const evolution: ChannelProvider = {
  parseWebhook: parseEvolutionWebhook,

  async ensureInstance(server, instance, { create, webhookUrl }) {
    const existe = await instancia(server, instance);
    if (existe) {
      if (create) throw new Error(`A instância "${instance}" já existe na Evolution`);
      return;
    }
    if (!create) throw new Error(`Instância "${instance}" não encontrada na Evolution`);
    await chamar(server, 'POST', '/instance/create', {
      instanceName: instance,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: false,
      groupsIgnore: true,
      webhook: webhookConfig(webhookUrl),
    });
  },

  async setWebhook(server, instance, webhookUrl) {
    await chamar(server, 'POST', `/webhook/set/${enc(instance)}`, { webhook: webhookConfig(webhookUrl) });
  },

  async connect(server, instance) {
    const r = await chamar(server, 'GET', `/instance/connect/${enc(instance)}`);
    if (r?.instance?.state === 'open') return { status: 'connected', qrCode: null, pairingCode: null };
    return { status: r?.base64 ? 'qr' : 'pending', qrCode: r?.base64 ?? null, pairingCode: r?.pairingCode ?? null };
  },

  async status(server, instance) {
    const [estado, info] = await Promise.all([
      chamar(server, 'GET', `/instance/connectionState/${enc(instance)}`),
      instancia(server, instance),
    ]);
    const owner = info?.ownerJid ?? info?.instance?.owner ?? null;
    return { status: ESTADOS[estado?.instance?.state] ?? 'pending', phoneNumber: jidToPhone(owner) };
  },

  async removeInstance(server, instance) {
    await chamar(server, 'DELETE', `/instance/logout/${enc(instance)}`).catch(() => undefined);
    await chamar(server, 'DELETE', `/instance/delete/${enc(instance)}`);
  },
};
