import { servicePool } from '../db.js';
import { decifrar } from './cifra.js';

// Boas-vindas por áudio (docs/WHATSAPP.md §17). O lead converte no formulário,
// o WhatsApp abre com a frase pronta e ele manda. Quando a frase chega, o CRM
// espera o negócio do formulário existir com segmento (o formulário e a
// mensagem chegam quase juntos, em qualquer ordem) e chama o webhook da
// conexão (n8n), que manda o áudio do segmento pela Evolution e devolve o id
// da mensagem. Esse id marca o áudio como automático para a IA.
// Decisões do dono: uma vez por contato (telefone), para sempre; sem negócio,
// sem segmento ou sem áudio do segmento → não envia.

/** Quanto esperar o negócio/segmento aparecer depois da frase. */
const ESPERA_NEGOCIO_S = Number(process.env.WELCOME_WAIT_SECONDS ?? 300);
const INTERVALO_S = 30;

/** Minúsculas, sem acento, sem pontuação, espaços simples. */
export const normalizarFrase = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** A mensagem traz a frase do formulário? (contém, para aceitar "Oi! quero falar com um consultor 🙂") */
export function ehFraseDeBoasVindas(texto: string | null, gatilho: string | null): boolean {
  if (!texto || !gatilho?.trim()) return false;
  const g = normalizarFrase(gatilho);
  return !!g && normalizarFrase(texto).includes(g);
}

interface Contexto {
  chat_id: string;
  organization_id: string;
  connection_id: string;
  remote_jid: string;
  phone_digits: string | null;
  phone_key: string | null;
  funnel_id: string | null;
  instance_name: string;
  welcome_webhook_url: string | null;
  welcome_secret: string | null;
}

interface Negocio {
  lead_id: string;
  lead_name: string | null;
  em_entrada: boolean;
  segment: string | null;
  segment_id: string | null;
  trade_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
}

export type ResultadoBoasVindas = { status: 'sent' | 'skipped' | 'failed' | 'ignored'; reason?: string; reagendarEm?: number };

async function fechar(id: string, status: 'sent' | 'skipped' | 'failed', extra: { reason?: string | null; lead_id?: string | null; segment?: string | null; provider_message_id?: string | null }) {
  await servicePool().query(
    `update channel_welcomes set status = $2, reason = $3, lead_id = coalesce($4, lead_id), segment = coalesce($5, segment),
       provider_message_id = $6, updated_at = now() where id = $1`,
    [id, status, extra.reason ?? null, extra.lead_id ?? null, extra.segment ?? null, extra.provider_message_id ?? null]);
}

export async function boasVindas(chatId: string): Promise<ResultadoBoasVindas> {
  const pool = servicePool();
  const { rows } = await pool.query<Contexto>(
    `select ch.id as chat_id, ch.organization_id, ch.connection_id, ch.remote_jid, ch.phone_digits, ch.phone_key,
            c.funnel_id, c.instance_name, c.welcome_webhook_url, c.welcome_secret
     from channel_chats ch join channel_connections c on c.id = ch.connection_id
     where ch.id = $1 and c.is_active`, [chatId]);
  const ctx = rows[0];
  if (!ctx?.welcome_webhook_url) return { status: 'ignored', reason: 'sem_configuracao' };
  // Sem telefone (número oculto sem o alternativo) não dá para garantir "uma vez por contato".
  if (!ctx.phone_key) return { status: 'ignored', reason: 'sem_telefone' };

  // A trava: uma linha por telefone na organização. Já existe de outra
  // conversa ou já terminou → não manda de novo.
  await pool.query(
    `insert into channel_welcomes (organization_id, connection_id, chat_id, phone_key) values ($1, $2, $3, $4)
     on conflict (organization_id, phone_key) do nothing`,
    [ctx.organization_id, ctx.connection_id, ctx.chat_id, ctx.phone_key]);
  const { rows: [bv] } = await pool.query<{ id: string; chat_id: string; status: string; created_at: Date }>(
    `select id, chat_id, status, created_at from channel_welcomes where organization_id = $1 and phone_key = $2`,
    [ctx.organization_id, ctx.phone_key]);
  if (bv.status !== 'waiting' || bv.chat_id !== ctx.chat_id) return { status: 'ignored', reason: 'ja_enviado' };

  // O negócio aberto mais novo do contato no funil da conexão, com o segmento
  // da empresa. em_entrada: ainda na primeira etapa (negócio que já anda não
  // recebe boas-vindas).
  const { rows: [neg] } = await pool.query<Negocio>(
    `select l.id as lead_id, l.name as lead_name,
            l.stage_id = (select s.id from stages s where s.funnel_id = l.funnel_id order by s.position limit 1) as em_entrada,
            sg.label as segment, sg.id as segment_id, co.trade_name, c.name as contact_name, c.email as contact_email
     from contacts c
     join lead_contacts lc on lc.contact_id = c.id
     join leads l on l.id = lc.lead_id
     left join companies co on co.id = l.company_id
     left join company_segments sg on sg.id = co.segment_id
     where c.organization_id = $1 and c.phone_key = $2
       and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
       and ($3::uuid is null or l.funnel_id = $3)
     order by l.created_at desc limit 1`,
    [ctx.organization_id, ctx.phone_key, ctx.funnel_id]);

  const esperou = (Date.now() - new Date(bv.created_at).getTime()) / 1000;
  if (!neg?.segment) {
    if (esperou < ESPERA_NEGOCIO_S) return { status: 'skipped', reason: 'esperando', reagendarEm: INTERVALO_S };
    const reason = neg ? 'sem_segmento' : 'sem_negocio';
    await fechar(bv.id, 'skipped', { reason, lead_id: neg?.lead_id });
    return { status: 'skipped', reason };
  }
  if (!neg.em_entrada) {
    await fechar(bv.id, 'skipped', { reason: 'negocio_em_andamento', lead_id: neg.lead_id, segment: neg.segment });
    return { status: 'skipped', reason: 'negocio_em_andamento' };
  }

  // Sem nova tentativa automática: se o n8n mandou e a resposta se perdeu,
  // repetir mandaria o áudio duas vezes. Falha fica registrada para olhar.
  try {
    const res = await fetch(ctx.welcome_webhook_url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ctx.welcome_secret ? { 'X-CRM-Token': decifrar(ctx.welcome_secret) } : {}),
      },
      body: JSON.stringify({
        welcome_id: bv.id,
        organization_id: ctx.organization_id,
        instance: ctx.instance_name,
        number: ctx.phone_digits ?? ctx.remote_jid,
        remote_jid: ctx.remote_jid,
        chat_id: ctx.chat_id,
        lead_id: neg.lead_id,
        segment: neg.segment,
        segment_id: neg.segment_id,
        company: neg.trade_name,
        contact_name: neg.contact_name,
        contact_email: neg.contact_email,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const texto = await res.text();
    let corpo: { sent?: boolean; message_id?: string; reason?: string } = {};
    try { corpo = JSON.parse(texto); } catch { /* resposta sem JSON */ }
    if (!res.ok) {
      await fechar(bv.id, 'failed', { reason: `HTTP ${res.status} ${texto.slice(0, 300)}`, lead_id: neg.lead_id, segment: neg.segment });
      return { status: 'failed', reason: `HTTP ${res.status}` };
    }
    if (corpo.sent && corpo.message_id) {
      await fechar(bv.id, 'sent', { lead_id: neg.lead_id, segment: neg.segment, provider_message_id: String(corpo.message_id) });
      return { status: 'sent' };
    }
    const reason = corpo.reason || 'n8n_nao_enviou';
    await fechar(bv.id, 'skipped', { reason, lead_id: neg.lead_id, segment: neg.segment });
    return { status: 'skipped', reason };
  } catch (e) {
    await fechar(bv.id, 'failed', { reason: (e as Error).message.slice(0, 300), lead_id: neg.lead_id, segment: neg.segment });
    return { status: 'failed', reason: (e as Error).message };
  }
}
