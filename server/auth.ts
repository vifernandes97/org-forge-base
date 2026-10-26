import { betterAuth } from 'better-auth';
import { verifyPassword } from 'better-auth/crypto';
import bcrypt from 'bcryptjs';
import { authPool } from './db.js';

// Identidade da app. As tabelas moram no schema app_auth (search_path do
// papel app_auth_svc), fora do que o PostgREST expõe. A sessão (cookie) é
// conferida no portão /rest (server/app.ts), que repassa o id do usuário ao
// PostgREST num JWT curto: sub = auth.uid() nas policies.

// Só a origem (esquema + host): barra final, espaço ou caminho no valor da
// env viram "Invalid origin" no Better Auth.
const origem = (valor?: string) => {
  const v = valor?.trim();
  if (!v) return undefined;
  try {
    return new URL(v.includes('://') ? v : `https://${v}`).origin;
  } catch {
    return undefined;
  }
};

const baseURL = origem(process.env.BETTER_AUTH_URL);

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  database: authPool(),
  trustedOrigins: [baseURL, origem(process.env.APP_DEV_ORIGIN)].filter(Boolean) as string[],
  advanced: {
    database: { generateId: 'uuid' },
  },
  user: {
    modelName: 'users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    // O portão /rest confere a sessão a cada consulta: o cookie assinado
    // segura 1 min sem ir ao banco.
    cookieCache: { enabled: true, maxAge: 60 },
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
  },
  account: {
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // O Supabase tinha auto-confirm: ninguém verifica e-mail hoje.
    requireEmailVerification: false,
    password: {
      // Quem veio do Supabase tem hash bcrypt ($2a$/$2b$); conta nova usa o
      // scrypt da biblioteca. As duas entram pela mesma porta.
      verify: async ({ hash, password }) =>
        hash.startsWith('$2') ? bcrypt.compare(password, hash) : verifyPassword({ hash, password }),
    },
  },
});
