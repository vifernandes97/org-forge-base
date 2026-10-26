import { betterAuth } from 'better-auth';
import { verifyPassword } from 'better-auth/crypto';
import { jwt } from 'better-auth/plugins';
import bcrypt from 'bcryptjs';
import { authPool } from './db.js';

// Identidade da app. As tabelas moram no schema app_auth (search_path do
// papel app_auth_svc), fora do que a Data API expõe. O JWT que sai daqui é o que a
// Data API valida pelo JWKS: sub = id do usuário = auth.uid() nas policies.

const baseURL = process.env.BETTER_AUTH_URL;

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  database: authPool(),
  trustedOrigins: [baseURL, process.env.APP_DEV_ORIGIN].filter(Boolean) as string[],
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
  plugins: [
    jwt({
      schema: {
        jwks: {
          fields: { publicKey: 'public_key', privateKey: 'private_key', createdAt: 'created_at', expiresAt: 'expires_at' },
        },
      },
      // RS256: o que a Data API do Neon documenta aceitar.
      jwks: { keyPairConfig: { alg: 'RS256', modulusLength: 2048 } },
      jwt: {
        expirationTime: '15m',
        definePayload: ({ user }) => ({ email: user.email, role: 'authenticated' }),
      },
    }),
  ],
});
