import { decifrar } from './canais/cifra.js';
import { servicePool } from './db.js';

// Cliente da entrada de integração do Orbi (chave da organização, cifrada em
// org_orbi_integrations). Separado de server/orbi.ts para as ferramentas da
// Bia (server/agente) usarem sem puxar as rotas e a autenticação do CRM.

export type Credencial = { baseUrl: string; chave: string };

export async function credencial(orgId: string): Promise<Credencial | null> {
  const { rows } = await servicePool().query<{ base_url: string; api_key_enc: string }>(
    `select base_url, api_key_enc from org_orbi_integrations where organization_id = $1 and enabled`, [orgId]);
  if (!rows[0]) return null;
  return { baseUrl: rows[0].base_url.replace(/\/+$/, ''), chave: decifrar(rows[0].api_key_enc) };
}

/** Chamada à entrada de integração do Orbi (`/api/integrations/inbound…`) com a chave da organização. */
export const chamarEntradaDoOrbi = (c: Credencial, metodo: string, caminho: string, corpo?: unknown) =>
  fetch(`${c.baseUrl}/api/integrations/inbound${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${c.chave}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

