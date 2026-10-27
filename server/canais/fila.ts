import { PgBoss } from 'pg-boss';

// Fila durável do orquestrador (pg-boss, schema "pgboss" no mesmo Postgres).
// A API só enfileira; o worker (ROLE=worker) processa. Atrás deste módulo
// para dar para trocar por Redis/BullMQ sem mexer nos jobs.

export const FILAS = {
  /** Procura contato/negócio de uma conversa. Um por conversa por vez. */
  vincularConversa: 'canais.chat.vincular',
  /** Baixa e guarda áudio/imagem (só com MEDIA_DIR). */
  baixarMidia: 'canais.midia.baixar',
  /** Transcreve um áudio. Limite de taxa do provedor → volta para a fila com espera. */
  transcreverAudio: 'canais.audio.transcrever',
  /** Analisa o lote novo de uma conversa (debounce por conversa; um por vez por conversa). */
  analisarConversa: 'canais.chat.analisar',
  /** Cron: partições de mensagens. */
  manutencao: 'canais.manutencao',
  /** Cron: status das conexões na Evolution. */
  saudeConexoes: 'canais.conexoes.saude',
} as const;

export type NomeFila = (typeof FILAS)[keyof typeof FILAS];

let boss: PgBoss | null = null;
let iniciando: Promise<PgBoss> | null = null;

export function fila(): Promise<PgBoss> {
  if (boss) return Promise.resolve(boss);
  iniciando ??= (async () => {
    const connectionString = process.env.APP_DATABASE_URL;
    if (!connectionString) throw new Error('APP_DATABASE_URL não definida');
    const b = new PgBoss({
      connectionString,
      application_name: `crm-${process.env.ROLE ?? 'all'}`,
      max: Number(process.env.QUEUE_POOL_MAX ?? 4),
      // A API não supervisiona nem agenda; só o worker.
      supervise: papelAtual() !== 'api',
      schedule: papelAtual() !== 'api',
    });
    b.on('error', (e) => console.error('[fila]', e));
    await b.start();
    await Promise.all([
      b.createQueue(FILAS.vincularConversa, { policy: 'singleton', retryLimit: 5, retryDelay: 5, retryBackoff: true, expireInSeconds: 120 }),
      b.createQueue(FILAS.baixarMidia, { retryLimit: 5, retryDelay: 10, retryBackoff: true, expireInSeconds: 120 }),
      // Groq grátis: 20 req/min. Backoff a partir de 30 s cobre a janela do limite.
      b.createQueue(FILAS.transcreverAudio, { retryLimit: 10, retryDelay: 30, retryBackoff: true, retryDelayMax: 1800, expireInSeconds: 300 }),
      // stately: por conversa, no máximo um na fila e um rodando.
      b.createQueue(FILAS.analisarConversa, { policy: 'stately', retryLimit: 6, retryDelay: 60, retryBackoff: true, retryDelayMax: 3600, expireInSeconds: 600 }),
      b.createQueue(FILAS.manutencao, { policy: 'singleton', retryLimit: 2, expireInSeconds: 300 }),
      b.createQueue(FILAS.saudeConexoes, { policy: 'singleton', retryLimit: 1, expireInSeconds: 120 }),
    ]);
    boss = b;
    return b;
  })().catch((e) => {
    iniciando = null;
    throw e;
  });
  return iniciando;
}

/** api: só HTTP; worker: só jobs; all (padrão, um container só): os dois. */
export function papelAtual(): 'api' | 'worker' | 'all' {
  const r = process.env.ROLE;
  return r === 'api' || r === 'worker' ? r : 'all';
}

export async function pararFila() {
  if (boss) await boss.stop({ graceful: true, timeout: 20_000 });
  boss = null;
  iniciando = null;
}
