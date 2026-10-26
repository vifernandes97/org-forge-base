import { Pool } from 'pg';

// Duas conexões, cada uma com o mínimo que precisa:
// - APP_AUTH_DATABASE_URL: papel app_auth_svc, só o schema app_auth (Better Auth).
// - APP_DATABASE_URL: dono do banco, para webhooks e cron (ignora RLS).
// São nossas, não a DATABASE_URL da integração Neon↔Vercel (que em preview
// aponta para cópias isoladas): na migração apontam para a branch dev; na
// virada, para a main.
const pools = new Map<string, Pool>();

function poolFrom(envVar: 'APP_AUTH_DATABASE_URL' | 'APP_DATABASE_URL'): Pool {
  let p = pools.get(envVar);
  if (!p) {
    const connectionString = process.env[envVar];
    if (!connectionString) throw new Error(`${envVar} não definida`);
    p = new Pool({ connectionString, max: 3 });
    pools.set(envVar, p);
  }
  return p;
}

export const authPool = () => poolFrom('APP_AUTH_DATABASE_URL');
export const servicePool = () => poolFrom('APP_DATABASE_URL');
