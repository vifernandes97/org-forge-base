// Envio de template do WhatsApp (API oficial, número 0573) pelo Chatvolt:
//   POST /whatsapp/<phoneNumberId>/template-message  (docs.chatvolt.ai)
// Usado pela boas-vindas do formulário (boas-vindas.ts) e pela confirmação da
// demo (agente/confirmacao-demo.ts). O Chatvolt fala com a Meta com a credencial
// dele; o caminho antigo (n8n → graph.facebook.com) falhava com o erro #10
// ("Paid Message Account") por causa do token do n8n.

const CHATVOLT_API = 'https://api.chatvolt.ai';

export interface CredencialChatvolt {
  chave: string;
  /** ID do número no WhatsApp Business (Chatvolt → Implantar → WhatsApp Official). Não é o telefone. */
  phoneId: string;
  /** Agente (Bia) dono da conversa. */
  agentId: string;
}

/** Credencial do ambiente; nula se faltar qualquer parte (ou se o phoneId não for numérico). */
export function credencialChatvolt(env: NodeJS.ProcessEnv = process.env): CredencialChatvolt | null {
  const chave = env.CHATVOLT_API_KEY ?? '';
  const phoneId = env.CHATVOLT_WHATSAPP_PHONE_ID ?? '';
  const agentId = env.CHATVOLT_AGENT_ID ?? '';
  if (!chave || !/^\d{8,20}$/.test(phoneId) || !agentId) return null;
  return { chave, phoneId, agentId };
}

export type Envio = { ok: true; messageId: string | null; conversationId: string | null } | { ok: false; motivo: string };

/** Faz o POST e normaliza a resposta; erro de rede ou HTTP vira `{ ok: false }`, nunca exceção. */
export async function postarTemplate(cred: CredencialChatvolt, corpo: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<Envio> {
  try {
    const r = await fetchImpl(`${CHATVOLT_API}/whatsapp/${cred.phoneId}/template-message`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cred.chave}`, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(20_000),
    });
    const texto = await r.text();
    if (!r.ok) return { ok: false, motivo: `HTTP ${r.status} ${texto.slice(0, 300)}` };
    let j: { id?: string; messages?: { id?: string }[] } = {};
    try { j = JSON.parse(texto); } catch { /* 200 sem JSON: segue sem os ids */ }
    return { ok: true, conversationId: j.id ?? null, messageId: j.messages?.at(-1)?.id ?? null };
  } catch (e) {
    return { ok: false, motivo: (e as Error).message.slice(0, 300) };
  }
}
