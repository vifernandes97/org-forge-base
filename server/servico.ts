import { PostgrestClient } from '@supabase/postgrest-js';
import { SignJWT } from 'jose';

// O equivalente do createClient(url, serviceRoleKey) das edge functions: o
// mesmo PostgREST, com um JWT de role service_role (ignora RLS) que só o
// servidor sabe assinar — o portão /rest nunca repassa o Authorization do
// navegador. Assim o código portado das edge functions fica igual.

const PGRST_URL = process.env.PGRST_URL ?? 'http://localhost:3000';

let token: { valor: string; expira: number } | null = null;

async function tokenDeServico(): Promise<string> {
  if (token && token.expira - Date.now() > 60_000) return token.valor;
  const segredo = process.env.PGRST_JWT_SECRET;
  if (!segredo || segredo.length < 32) throw new Error('PGRST_JWT_SECRET ausente ou curta (mínimo 32)');
  const expira = Date.now() + 10 * 60_000;
  const valor = await new SignJWT({ role: 'service_role' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expira / 1000))
    .sign(new TextEncoder().encode(segredo));
  token = { valor, expira };
  return valor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- portado do supabase-js sem tipos do banco
export const servico: PostgrestClient<any> = new PostgrestClient(PGRST_URL, {
  fetch: async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set('authorization', `Bearer ${await tokenDeServico()}`);
    return fetch(input, { ...init, headers });
  },
});
