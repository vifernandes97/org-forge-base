// Antes: o cliente gerado do Supabase (Lovable Cloud). Agora: a mesma
// superfície que o app usa — from/rpc (PostgREST), auth e functions — sobre o
// nosso servidor no mesmo domínio: /rest (portão do PostgREST, que confere a
// sessão pelo cookie) e /api/auth (Better Auth). Os services e o AuthContext
// seguem importando `supabase` daqui sem mudar.
import { PostgrestClient } from '@supabase/postgrest-js';
import { createAuthClient } from 'better-auth/client';
import type { Database } from './types';

const origem = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

const authClient = createAuthClient({ baseURL: origem, basePath: '/api/auth' });

// ---------- usuário no formato que os componentes já leem ----------

export interface User {
  id: string;
  email: string;
  user_metadata: { full_name: string };
}
export interface Session {
  user: User;
}

type BetterUser = { id: string; email: string; name: string };
const toUser = (u: BetterUser): User => ({ id: u.id, email: u.email, user_metadata: { full_name: u.name } });

// Mesmo domínio: o cookie de sessão vai junto, e o portão /rest cuida do resto.
const rest = new PostgrestClient<Database>(`${origem}/rest`);

// ---------- auth no formato do supabase-js (só o que o app usa) ----------

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT';
type Listener = (event: AuthEvent, session: Session | null) => void;
const listeners = new Set<Listener>();

async function currentSession(): Promise<Session | null> {
  const { data } = await authClient.getSession({ query: {} });
  if (!data?.user) return null;
  return { user: toUser(data.user as BetterUser) };
}

async function announce(event: AuthEvent) {
  const session = event === 'SIGNED_OUT' ? null : await currentSession();
  listeners.forEach((l) => l(event, session));
}

const asError = (e: { message?: string; status?: number } | null | undefined) =>
  e ? Object.assign(new Error(e.message || 'Erro de autenticação'), { status: e.status }) : null;

const auth = {
  async getSession() {
    return { data: { session: await currentSession() }, error: null };
  },
  async getUser() {
    const session = await currentSession();
    return { data: { user: session?.user ?? null }, error: null };
  },
  onAuthStateChange(listener: Listener) {
    listeners.add(listener);
    currentSession().then((s) => listener('INITIAL_SESSION', s));
    return { data: { subscription: { unsubscribe: () => {
      listeners.delete(listener);
    } } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (!error) await announce('SIGNED_IN');
    return { data, error: asError(error) };
  },
  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }) {
    const { data, error } = await authClient.signUp.email({ email, password, name: options?.data?.full_name ?? '' });
    if (!error) await announce('SIGNED_IN');
    return { data, error: asError(error) };
  },
  async signOut() {
    const { error } = await authClient.signOut({});
    await announce('SIGNED_OUT');
    return { error: asError(error) };
  },
};

// ---------- functions.invoke → Functions da Vercel (/api/<nome>) ----------

const functions = {
  async invoke(name: string, { body }: { body?: unknown } = {}) {
    const res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => null);
    return { data, error: res.ok ? null : new Error(data?.error || `HTTP ${res.status}`) };
  },
};

export const supabase = {
  from: rest.from.bind(rest) as typeof rest.from,
  rpc: rest.rpc.bind(rest) as typeof rest.rpc,
  auth,
  functions,
};
