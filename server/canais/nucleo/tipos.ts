// Formato normalizado entre o provedor de canal (Evolution hoje, API da Meta
// depois) e o resto do orquestrador. Nada fora de server/canais/provedores
// conhece o payload de um provedor.

export type TipoMensagem = 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'contact' | 'other';

export interface MidiaInfo {
  mimetype?: string;
  seconds?: number;
  fileName?: string;
  caption?: string;
  ptt?: boolean;
}

export interface MensagemNormalizada {
  kind: 'message';
  providerMessageId: string;
  /** Conversa: o JID do outro lado (sempre de pessoa; grupos são descartados no parser). */
  remoteJid: string;
  /** Dígitos do telefone do outro lado, quando o provedor informa (mesmo com @lid). */
  phoneDigits: string | null;
  /** Nome do perfil do outro lado; nulo quando a mensagem é nossa (o pushName seria o nosso). */
  pushName: string | null;
  fromMe: boolean;
  type: TipoMensagem;
  body: string | null;
  media: MidiaInfo | null;
  sentAt: Date;
  raw: unknown;
}

export type EstadoConexao = 'pending' | 'qr' | 'connected' | 'disconnected' | 'error';

export interface ConexaoAtualizada {
  kind: 'connection';
  status: EstadoConexao;
  detail: string | null;
  phoneNumber: string | null;
}

export type EventoNormalizado = MensagemNormalizada | ConexaoAtualizada;

/** Credenciais já decifradas de um servidor de provedor. */
export interface ServidorCanal {
  id: string;
  provider: 'evolution';
  baseUrl: string;
  apiKey: string;
}

export interface ChannelProvider {
  /** Converte o corpo do webhook em eventos; ignora o que não interessa (grupos, status, reações…). */
  parseWebhook(body: unknown): EventoNormalizado[];
  /** Cria a instância (gerenciada) ou só confere que ela existe (já existente). */
  ensureInstance(server: ServidorCanal, instance: string, opts: { create: boolean; webhookUrl: string }): Promise<void>;
  setWebhook(server: ServidorCanal, instance: string, webhookUrl: string | null): Promise<void>;
  connect(server: ServidorCanal, instance: string): Promise<{ status: EstadoConexao; qrCode: string | null; pairingCode: string | null }>;
  status(server: ServidorCanal, instance: string): Promise<{ status: EstadoConexao; phoneNumber: string | null }>;
  removeInstance(server: ServidorCanal, instance: string): Promise<void>;
  /** Baixa a mídia de uma mensagem (o `raw` que o parser guardou). */
  fetchMedia(server: ServidorCanal, instance: string, raw: unknown): Promise<MidiaBaixada>;
}

export interface MidiaBaixada {
  data: Buffer;
  mimetype: string;
}
