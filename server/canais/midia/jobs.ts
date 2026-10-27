import { servicePool } from '../../db.js';
import { credencial } from '../../ia/credenciais.js';
import { FILAS, fila } from '../fila.js';
import { provedor } from '../provedores/index.js';
import { servidor } from '../servidores.js';
import { ErroPermanente, LimiteDeTaxa, transcrever } from '../transcricao/whisper.js';
import { armazenamento, chaveDaMidia } from './armazenamento.js';

// Jobs de mídia (Fase 2):
//   canais.midia.baixar     baixa da Evolution e guarda (só com MEDIA_DIR)
//   canais.audio.transcrever transcreve com a credencial escolhida pela
//                            organização; se a principal bater no limite, tenta a reserva
// Os dois são idempotentes: rodar de novo não refaz o que já está feito.

export interface RefMensagem {
  messageId: string;
  /** A tabela é particionada por sent_at: com ele a busca vai direto à partição. */
  sentAt: string;
}

interface Mensagem {
  id: string;
  organization_id: string;
  sent_at: Date;
  message_type: string;
  media: Record<string, unknown> | null;
  transcript: string | null;
  raw: unknown;
  server_id: string;
  provider: string;
  instance_name: string;
}

async function mensagem(ref: RefMensagem): Promise<Mensagem | null> {
  const { rows } = await servicePool().query<Mensagem>(
    `select m.id, m.organization_id, m.sent_at, m.message_type, m.media, m.transcript, m.raw,
            c.server_id, c.provider, c.instance_name
     from channel_messages m join channel_connections c on c.id = m.connection_id
     where m.id = $1 and m.sent_at = $2`, [ref.messageId, ref.sentAt]);
  return rows[0] ?? null;
}

async function marcar(ref: RefMensagem, campos: Record<string, unknown>, transcript?: string) {
  await servicePool().query(
    `update channel_messages set media = coalesce(media, '{}'::jsonb) || $3::jsonb,
       transcript = coalesce($4, transcript)
     where id = $1 and sent_at = $2`,
    [ref.messageId, ref.sentAt, JSON.stringify(campos), transcript ?? null]);
}

async function baixarDaOrigem(m: Mensagem) {
  return provedor(m.provider).fetchMedia(await servidor(m.server_id), m.instance_name, m.raw);
}

/** Tipos que o orquestrador usa: áudio (transcrição) e imagem (visão, Fase 3). */
export const TIPOS_COM_MIDIA = ['audio', 'image'];

export async function baixarMidia(ref: RefMensagem) {
  const store = armazenamento();
  const m = await mensagem(ref);
  if (!store || !m || !TIPOS_COM_MIDIA.includes(m.message_type) || m.media?.key) return;
  const midia = await baixarDaOrigem(m);
  const key = chaveDaMidia(m.organization_id, m.id, m.sent_at, midia.mimetype);
  await store.put(key, midia.data);
  await marcar(ref, { key, store: store.nome, size: midia.data.length, stored_mimetype: midia.mimetype });
  if (m.message_type === 'audio') await (await fila()).send(FILAS.transcreverAudio, ref);
}

interface Ajustes {
  transcription_enabled: boolean;
  transcription_credential_id: string | null;
  transcription_model: string | null;
  transcription_fallback_credential_id: string | null;
  transcription_fallback_model: string | null;
  transcription_language: string;
}

export async function transcreverAudio(ref: RefMensagem) {
  const m = await mensagem(ref);
  if (!m || m.message_type !== 'audio' || m.transcript) return;

  const { rows } = await servicePool().query<Ajustes>(`select * from org_ai_settings where organization_id = $1`, [m.organization_id]);
  const aj = rows[0];
  if (aj && !aj.transcription_enabled) return marcar(ref, { transcript_status: 'disabled' });
  const opcoes = [
    [aj?.transcription_credential_id, aj?.transcription_model],
    [aj?.transcription_fallback_credential_id, aj?.transcription_fallback_model],
  ].filter((o): o is [string, string] => !!o[0] && !!o[1]);
  if (!opcoes.length) return marcar(ref, { transcript_status: 'no_credential' });

  // Guardado no disco quando há MEDIA_DIR; senão, de novo da Evolution.
  const key = typeof m.media?.key === 'string' ? m.media.key : null;
  const guardado = key ? await armazenamento()?.get(key) : null;
  const audio = guardado
    ? { data: guardado, mimetype: String(m.media?.stored_mimetype ?? m.media?.mimetype ?? 'audio/ogg') }
    : await baixarDaOrigem(m);

  let limite: LimiteDeTaxa | null = null;
  for (const [credId, modelo] of opcoes) {
    const cred = await credencial(credId);
    try {
      const texto = await transcrever(cred, modelo, audio.data, audio.mimetype, aj?.transcription_language ?? 'pt');
      await marcar(ref, { transcript_status: 'done', transcript_provider: cred.provider, transcript_model: modelo }, texto);
      const segundos = Number(m.media?.seconds) || Math.ceil(audio.data.length / 4000);
      await servicePool().query(
        `insert into usage_events (organization_id, kind, quantity, provider, model, ref_id) values ($1, 'transcription_seconds', $2, $3, $4, $5)`,
        [m.organization_id, segundos, cred.provider, modelo, m.id]);
      return;
    } catch (e) {
      if (e instanceof LimiteDeTaxa) { limite = e; continue; }
      if (e instanceof ErroPermanente) return marcar(ref, { transcript_status: 'failed', transcript_error: e.message.slice(0, 300) });
      throw e;
    }
  }
  // Todas no limite: volta para a fila (o pg-boss espera com backoff) em vez de perder o áudio.
  throw limite ?? new Error('Transcrição sem resultado');
}
