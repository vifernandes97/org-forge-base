import { PgBoss } from 'pg-boss';

// Fila durável do orquestrador (pg-boss, schema "pgboss" no mesmo Postgres).
// A API só enfileira; o worker (ROLE=worker) processa. Atrás deste módulo
// para dar para trocar por Redis/BullMQ sem mexer nos jobs.

export const FILAS = {
  /** Procura contato/negócio de uma conversa. Um por conversa por vez. */
  vincularConversa: 'canais.chat.vincular',
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
