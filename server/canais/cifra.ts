import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Segredos de provedores no banco (chave da Evolution; na Fase 3, as chaves de
// LLM) cifrados com AES-256-GCM. A chave mestra fica só no secrets.env
// (CHANNEL_SECRET_KEY, openssl rand -hex 32); o banco sozinho não abre nada.
// Formato: v1.<iv>.<tag>.<cifrado>, em base64url.

function chave(): Buffer {
  const s = process.env.CHANNEL_SECRET_KEY;
  if (!s || s.length < 32) throw new Error('CHANNEL_SECRET_KEY ausente ou curta (mínimo 32)');
  return createHash('sha256').update(s).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), dados].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function decifrar(valor: string): string {
  const [versao, iv, tag, dados] = valor.split('.');
  if (versao !== 'v1' || !iv || !tag || !dados) throw new Error('Segredo cifrado em formato desconhecido');
  const d = createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(dados, 'base64url')), d.final()]).toString('utf8');
}
