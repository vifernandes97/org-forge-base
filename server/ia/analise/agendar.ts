import { servicePool } from '../../db.js';
import { FILAS, fila } from '../../canais/fila.js';

// Debounce por conversa (docs/WHATSAPP.md §2): cada mensagem nova empurra a
// análise para 3 min depois dela; teto de 15 min desde a primeira mensagem
// ainda não analisada (pending_since), para conversa que não para.
const ESPERA_S = Number(process.env.ANALYSIS_DEBOUNCE_SECONDS ?? 180);
const TETO_S = Number(process.env.ANALYSIS_MAX_WAIT_SECONDS ?? 900);
/** Conversa marcada como não comercial: reavalia no máximo 1×/dia. */
const REAVALIAR_IGNORADA_H = 24;

export async function agendarAnalise(chatId: string, emSegundos?: number) {
  const { rows } = await servicePool().query<{ pending_since: Date; status: string; last_analysis_at: Date | null }>(
    `update channel_chats set pending_since = coalesce(pending_since, now()) where id = $1
     returning pending_since, status, last_analysis_at`, [chatId]);
  const c = rows[0];
  if (!c) return;
  if (c.status === 'ignored' && c.last_analysis_at && Date.now() - new Date(c.last_analysis_at).getTime() < REAVALIAR_IGNORADA_H * 3600_000) return;

  const quando = new Date(Math.min(
    Date.now() + (emSegundos ?? ESPERA_S) * 1000,
    new Date(c.pending_since).getTime() + TETO_S * 1000,
  ));
  // upsert pelo singletonKey: reagenda o job que ainda está na fila, ou cria.
  await (await fila()).upsert(FILAS.analisarConversa, { chatId }, { singletonKey: chatId, startAfter: quando });
}
