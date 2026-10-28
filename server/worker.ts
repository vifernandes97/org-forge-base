import { servicePool } from './db.js';
import { FILAS, fila } from './canais/fila.js';
import { vincularConversa } from './canais/identificacao/vincular.js';
import { baixarMidia, transcreverAudio, type RefMensagem } from './canais/midia/jobs.js';
import { armazenamento } from './canais/midia/armazenamento.js';
import { boasVindas } from './canais/boas-vindas.js';
import { analisarConversa } from './ia/analise/analisar.js';
import { agendarAnalise } from './ia/analise/agendar.js';
import { provedor } from './canais/provedores/index.js';
import { servidor, servidorDaPlataforma } from './canais/servidores.js';

// Worker do orquestrador de canais (ROLE=worker, ou junto da API com ROLE=all).
// Mais réplicas = mais vazão: os jobs são idempotentes e o pg-boss entrega
// cada um a um worker só.

async function saudeDasConexoes() {
  const { rows } = await servicePool().query<{ id: string; server_id: string; provider: string; instance_name: string; status: string }>(
    `select id, server_id, provider, instance_name, status from channel_connections where is_active`);
  for (const con of rows) {
    try {
      const st = await provedor(con.provider).status(await servidor(con.server_id), con.instance_name);
      if (st.status !== con.status) {
        await servicePool().query(
          `update channel_connections set status = $2, phone_number = coalesce($3, phone_number), updated_at = now() where id = $1`,
          [con.id, st.status, st.phoneNumber]);
      }
    } catch (e) {
      await servicePool().query(`update channel_connections set status = 'error', status_detail = $2, updated_at = now() where id = $1`,
        [con.id, (e as Error).message.slice(0, 500)]);
    }
  }
}

// Retenção (docs/WHATSAPP.md §4): mídia 90 dias, payload bruto 30 dias.
// Texto e transcrição ficam enquanto a conversa existir.
const RETER_MIDIA_MESES = Number(process.env.MEDIA_RETENTION_MONTHS ?? 3);
const RETER_RAW_DIAS = Number(process.env.RAW_RETENTION_DAYS ?? 30);

async function manutencao() {
  await servicePool().query(`select public.ensure_channel_message_partitions(2)`);
  await servicePool().query(
    `update channel_messages set raw = null where raw is not null and sent_at < now() - make_interval(days => $1)`, [RETER_RAW_DIAS]);
  const store = armazenamento();
  if (store) {
    const limite = new Date();
    limite.setUTCMonth(limite.getUTCMonth() - RETER_MIDIA_MESES);
    const n = await store.purgeBefore(limite.toISOString().slice(0, 7));
    if (n) console.log(`[worker] retenção: ${n} meses de mídia apagados`);
  }
}

export async function iniciarWorker() {
  // Sobe o servidor da plataforma antes do primeiro job que precisar dele.
  await servidorDaPlataforma().catch((e) => console.error('[worker] servidor da Evolution', e));
  const b = await fila();

  await b.work<{ chatId: string }>(FILAS.vincularConversa, { batchSize: 10, localConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) }, async (jobs) => {
    for (const job of jobs) await vincularConversa(job.data.chatId);
  });

  await b.work<RefMensagem>(FILAS.baixarMidia, { batchSize: 5, localConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) }, async (jobs) => {
    for (const job of jobs) await baixarMidia(job.data);
  });
  // Um por vez por worker: o limite do provedor é da organização inteira.
  await b.work<RefMensagem>(FILAS.transcreverAudio, { batchSize: 1, localConcurrency: Number(process.env.TRANSCRIPTION_CONCURRENCY ?? 1) }, async ([job]) => {
    await transcreverAudio(job.data);
  });

  await b.work<{ chatId: string }>(FILAS.analisarConversa, { batchSize: 1, localConcurrency: Number(process.env.ANALYSIS_CONCURRENCY ?? 2) }, async ([job]) => {
    const r = await analisarConversa(job.data.chatId);
    if (r.status === 'skipped' && r.reagendarEm) await agendarAnalise(job.data.chatId, r.reagendarEm);
    else if (r.status === 'done') {
      // Chegou mensagem enquanto a IA pensava: o lote seguinte já entra no debounce.
      const { rows } = await servicePool().query(`select 1 from channel_chats where id = $1 and pending_since is not null`, [job.data.chatId]);
      if (rows.length) await agendarAnalise(job.data.chatId);
    }
  });

  await b.work<{ chatId: string }>(FILAS.boasVindas, { batchSize: 1 }, async ([job]) => {
    const r = await boasVindas(job.data.chatId);
    if (r.reagendarEm) {
      await b.send(FILAS.boasVindas, job.data, { singletonKey: job.data.chatId, startAfter: r.reagendarEm });
    } else if (r.status !== 'ignored') {
      console.log(`[canais] boas-vindas ${job.data.chatId}: ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
    }
  });

  await b.work(FILAS.manutencao, manutencao);
  await b.work(FILAS.saudeConexoes, saudeDasConexoes);

  await b.schedule(FILAS.manutencao, '15 3 * * *', null, { tz: 'America/Sao_Paulo' });
  await b.schedule(FILAS.saudeConexoes, '*/5 * * * *');
  console.log('[worker] filas de canais no ar');
}

// Dev: `bun run dev:worker` (no container, o index.ts chama iniciarWorker).
if ((import.meta as { main?: boolean }).main) iniciarWorker();
