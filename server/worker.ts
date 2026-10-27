import { servicePool } from './db.js';
import { FILAS, fila } from './canais/fila.js';
import { vincularConversa } from './canais/identificacao/vincular.js';
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

export async function iniciarWorker() {
  // Sobe o servidor da plataforma antes do primeiro job que precisar dele.
  await servidorDaPlataforma().catch((e) => console.error('[worker] servidor da Evolution', e));
  const b = await fila();

  await b.work<{ chatId: string }>(FILAS.vincularConversa, { batchSize: 10, localConcurrency: Number(process.env.WORKER_CONCURRENCY ?? 2) }, async (jobs) => {
    for (const job of jobs) await vincularConversa(job.data.chatId);
  });

  await b.work(FILAS.manutencao, async () => {
    await servicePool().query(`select public.ensure_channel_message_partitions(2)`);
  });
  await b.work(FILAS.saudeConexoes, saudeDasConexoes);

  await b.schedule(FILAS.manutencao, '15 3 * * *', null, { tz: 'America/Sao_Paulo' });
  await b.schedule(FILAS.saudeConexoes, '*/5 * * * *');
  console.log('[worker] filas de canais no ar');
}

// Dev: `bun run dev:worker` (no container, o index.ts chama iniciarWorker).
if (import.meta.main) iniciarWorker();
