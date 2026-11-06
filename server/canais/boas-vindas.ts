import { servicePool } from '../db.js';
import { decifrar } from './cifra.js';

// Boas-vindas por áudio (docs/WHATSAPP.md §17). O lead converte no formulário,
// o WhatsApp abre com a frase pronta e ele manda. Quando a frase chega, o CRM
// espera o negócio do formulário existir com segmento (o formulário e a
// mensagem chegam quase juntos, em qualquer ordem) e chama o webhook da
// conexão (n8n), que manda o áudio do segmento pela Evolution e devolve o id
// da mensagem. Esse id marca o áudio como automático para a IA.
// Decisões do dono: uma vez por contato (telefone), para sempre; sem negócio,
// sem segmento ou sem áudio do segmento → não envia. Quem não manda a frase
// recebe 10 min depois do formulário, com um texto antes (boasVindasFormulario).

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

type Fechamento = { reason?: string | null; lead_id?: string | null; segment?: string | null; provider_message_id?: string | null; intro_message_id?: string | null };

async function fechar(id: string, status: 'sent' | 'skipped' | 'failed', extra: Fechamento) {
  await servicePool().query(
    `update channel_welcomes set status = $2, reason = $3, lead_id = coalesce($4, lead_id), segment = coalesce($5, segment),
       provider_message_id = $6, intro_message_id = $7, updated_at = now() where id = $1`,
    [id, status, extra.reason ?? null, extra.lead_id ?? null, extra.segment ?? null, extra.provider_message_id ?? null, extra.intro_message_id ?? null]);
}

/**
 * Chama o webhook (n8n) e fecha a linha de channel_welcomes com o resultado.
 * Sem nova tentativa automática: se o n8n mandou e a resposta se perdeu,
 * repetir mandaria o áudio duas vezes. Falha fica registrada para olhar.
 */
async function chamarWebhook(url: string, segredo: string | null, welcomeId: string, neg: { lead_id: string; segment: string | null },
  corpoEnvio: Record<string, unknown>): Promise<ResultadoBoasVindas> {
  const base = { lead_id: neg.lead_id, segment: neg.segment };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(segredo ? { 'X-CRM-Token': decifrar(segredo) } : {}) },
      body: JSON.stringify({ welcome_id: welcomeId, ...corpoEnvio }),
      signal: AbortSignal.timeout(60_000),
    });
    const texto = await res.text();
    let corpo: { sent?: boolean; message_id?: string; text_message_id?: string; reason?: string } = {};
    try { corpo = JSON.parse(texto); } catch { /* resposta sem JSON */ }
    if (!res.ok) {
      await fechar(welcomeId, 'failed', { ...base, reason: `HTTP ${res.status} ${texto.slice(0, 300)}` });
      return { status: 'failed', reason: `HTTP ${res.status}` };
    }
    if (corpo.sent && corpo.message_id) {
      await fechar(welcomeId, 'sent', { ...base, provider_message_id: String(corpo.message_id),
        intro_message_id: corpo.text_message_id ? String(corpo.text_message_id) : null });
      return { status: 'sent' };
    }
    const reason = corpo.reason || 'n8n_nao_enviou';
    await fechar(welcomeId, 'skipped', { ...base, reason, intro_message_id: corpo.text_message_id ? String(corpo.text_message_id) : null });
    return { status: 'skipped', reason };
  } catch (e) {
    await fechar(welcomeId, 'failed', { ...base, reason: (e as Error).message.slice(0, 300) });
    return { status: 'failed', reason: (e as Error).message };
  }
}

/** Distância máxima entre o formulário e a frase no WhatsApp. */
const JANELA_FORMULARIO_MIN = 10;

const NEGOCIO_COLS = `l.id as lead_id, l.name as lead_name,
  l.stage_id = (select s.id from stages s where s.funnel_id = l.funnel_id order by s.position limit 1) as em_entrada,
  sg.label as segment, sg.id as segment_id, co.trade_name, c.name as contact_name, c.email as contact_email`;

/** O lead já escreveu (mensagem recebida) numa conversa ligada a este negócio? */
const LEAD_CONVERSOU = (lead: string) => `exists (select 1 from channel_chats ch where ch.lead_id = ${lead}
  and exists (select 1 from channel_messages m where m.chat_id = ch.id and not m.from_me))`;

/**
 * A frase chegou de um número que não está em nenhum contato. Procura o
 * negócio que o formulário criou ou atualizou perto da frase (±10 min), no
 * funil da conexão e sem conversa em que o lead já tenha escrito. Só liga se
 * houver exatamente um — com dois leads no mesmo intervalo não dá para saber
 * qual é. A ligação é direta na conversa (channel_chats.lead_id); o telefone
 * do contato fica o do formulário, e uma nota no negócio registra o número do WhatsApp.
 */
async function negocioDoFormularioRecente(ctx: Contexto, fraseEm: Date): Promise<Negocio | undefined> {
  const pool = servicePool();
  const { rows } = await pool.query<Negocio & { contact_id: string | null }>(
    `select ${NEGOCIO_COLS}, c.id as contact_id
     from leads l
     left join companies co on co.id = l.company_id
     left join company_segments sg on sg.id = co.segment_id
     left join lateral (
       select c.* from lead_contacts lc join contacts c on c.id = lc.contact_id
       where lc.lead_id = l.id order by lc.is_primary desc, lc.created_at limit 1
     ) c on true
     where l.organization_id = $1
       and ($2::uuid is null or l.funnel_id = $2)
       and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
       and exists (select 1 from inbound_webhook_logs w where w.lead_id = l.id
                   and w.created_at between $3::timestamptz - make_interval(mins => $4) and $3::timestamptz + make_interval(mins => $4))
       and not ${LEAD_CONVERSOU('l.id')}
     limit 2`,
    [ctx.organization_id, ctx.funnel_id, fraseEm, JANELA_FORMULARIO_MIN]);
  if (rows.length !== 1) return undefined;
  const { contact_id, ...neg } = rows[0];

  const { rowCount } = await pool.query(
    `update channel_chats set status = 'linked', lead_id = $2, contact_id = coalesce($3, contact_id), matched_by = 'form_recent', updated_at = now()
     where id = $1 and lead_id is null`,
    [ctx.chat_id, neg.lead_id, contact_id]);
  if (!rowCount) return undefined;
  await pool.query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, (select coalesce(l.assigned_to, (select m.user_id from organization_members m where m.organization_id = $1 order by (m.role = 'owner') desc, m.created_at limit 1)) from leads l where l.id = $2),
             'note', 'WhatsApp ligado pelo formulário', $3, $4)`,
    [ctx.organization_id, neg.lead_id,
      `O lead chamou no WhatsApp por outro número${ctx.phone_digits ? ` (+${ctx.phone_digits})` : ''}, diferente do telefone do formulário. A conversa foi ligada a este negócio porque foi o único formulário recebido perto da mensagem.`,
      { source: 'whatsapp_welcome', chat_id: ctx.chat_id, matched_by: 'form_recent' }]);
  return neg;
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
  // conversa (ou do envio depois do formulário) ou já terminou → não manda de novo.
  await pool.query(
    `insert into channel_welcomes (organization_id, connection_id, chat_id, phone_key) values ($1, $2, $3, $4)
     on conflict (organization_id, phone_key) do nothing`,
    [ctx.organization_id, ctx.connection_id, ctx.chat_id, ctx.phone_key]);
  const { rows: [bv] } = await pool.query<{ id: string; chat_id: string | null; status: string; created_at: Date }>(
    `select id, chat_id, status, created_at from channel_welcomes where organization_id = $1 and phone_key = $2`,
    [ctx.organization_id, ctx.phone_key]);
  if (bv.status !== 'waiting' || bv.chat_id !== ctx.chat_id) return { status: 'ignored', reason: 'ja_enviado' };

  // O negócio aberto mais novo do contato no funil da conexão, com o segmento
  // da empresa. em_entrada: ainda na primeira etapa (negócio que já anda não
  // recebe boas-vindas).
  let { rows: [neg] }: { rows: (Negocio | undefined)[] } = await pool.query<Negocio>(
    `select ${NEGOCIO_COLS}
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
  // Ninguém com esse telefone: o lead pode ter digitado outro número no
  // formulário. Liga a conversa ao negócio do formulário recente, se for o único.
  if (!neg) neg = await negocioDoFormularioRecente(ctx, bv.created_at);
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
  // O negócio já recebeu a boas-vindas por outro número (ex.: envio depois do
  // formulário para o telefone digitado, e o lead chamou de outro).
  const { rows: [jaRecebeu] } = await pool.query(
    `select 1 from channel_welcomes where lead_id = $1 and id <> $2 and status in ('waiting','sent')`, [neg.lead_id, bv.id]);
  if (jaRecebeu) {
    await fechar(bv.id, 'skipped', { reason: 'negocio_ja_recebeu', lead_id: neg.lead_id, segment: neg.segment });
    return { status: 'skipped', reason: 'negocio_ja_recebeu' };
  }

  return chamarWebhook(ctx.welcome_webhook_url, ctx.welcome_secret, bv.id, neg, {
    origin: 'phrase',
    organization_id: ctx.organization_id,
    instance: ctx.instance_name,
    // O JID da própria conversa, não o telefone: quem escreve por @lid e
    // recebe no número vira uma segunda conversa no CRM.
    number: ctx.remote_jid,
    phone: ctx.phone_digits,
    chat_id: ctx.chat_id,
    text: null,
    lead_id: neg.lead_id,
    segment: neg.segment,
    segment_id: neg.segment_id,
    company: neg.trade_name,
    contact_name: neg.contact_name,
    contact_email: neg.contact_email,
  });
}

// ---------------------------------------------------------------------------
// Envio depois do formulário (sem a frase). O webhook do formulário agenda
// este job para FORMULARIO_ESPERA_MIN depois; se até lá o lead não escreveu,
// o CRM manda o texto da conexão (welcome_form_text) e o áudio do segmento
// para o telefone do formulário. Mesma trava por telefone da frase.

/** Quanto esperar a frase antes de mandar sozinho. */
export const FORMULARIO_ESPERA_MIN = Number(process.env.WELCOME_FORM_DELAY_MINUTES ?? 10);

/** Telefone do formulário em dígitos com DDI ("(11) 98765-4321" → "5511987654321"). Nulo se não parece telefone. */
export function telefoneParaEnvio(phone: string | null | undefined): string | null {
  const v = (phone ?? '').replace(/\D/g, '');
  if (v.length < 10) return null;
  if ((phone ?? '').trim().startsWith('+')) return v;
  if (v.length === 10 || v.length === 11) return `55${v}`;
  return (v.length === 12 || v.length === 13) && v.startsWith('55') ? v : null;
}

/** Primeiro nome do contato para o texto; nulo se o nome não parece nome de gente. */
export function primeiroNome(nome: string | null | undefined): string | null {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  if (p.length < 2 || /[@\d_]/.test(p) || !/^\p{L}/u.test(p)) return null;
  return p[0].toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR');
}

/** "Oi, {nome}! …" → com o nome, ou "Oi! …" sem ele. */
export function textoDeBoasVindas(modelo: string, nome: string | null): string {
  return (nome ? modelo.replace(/\{nome\}/g, nome) : modelo.replace(/,?\s*\{nome\}/g, '')).trim();
}

interface LeadFormulario extends Negocio {
  organization_id: string;
  connection_id: string;
  instance_name: string;
  welcome_webhook_url: string;
  welcome_secret: string | null;
  welcome_form_text: string;
  contact_phone: string | null;
  phone_key: string | null;
}

export async function boasVindasFormulario(leadId: string): Promise<ResultadoBoasVindas> {
  const pool = servicePool();
  const { rows: [lf] } = await pool.query<LeadFormulario>(
    `select ${NEGOCIO_COLS}, l.organization_id, cn.id as connection_id, cn.instance_name, cn.welcome_webhook_url, cn.welcome_secret,
            cn.welcome_form_text, c.phone as contact_phone, c.phone_key
     from leads l
     join lateral (
       select * from channel_connections cn
       where cn.organization_id = l.organization_id and cn.is_active
         and cn.welcome_webhook_url is not null and cn.welcome_form_text is not null
         and (cn.funnel_id is null or cn.funnel_id = l.funnel_id)
       order by (cn.funnel_id = l.funnel_id) desc nulls last limit 1
     ) cn on true
     left join companies co on co.id = l.company_id
     left join company_segments sg on sg.id = co.segment_id
     left join lateral (
       select c.* from lead_contacts lc join contacts c on c.id = lc.contact_id
       where lc.lead_id = l.id and c.phone_key is not null order by lc.is_primary desc, lc.created_at limit 1
     ) c on true
     where l.id = $1 and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null`, [leadId]);
  // Sem lock nestes casos: nada foi enviado e o telefone continua livre para a frase.
  if (!lf) return { status: 'ignored', reason: 'sem_configuracao' };
  if (!lf.em_entrada) return { status: 'ignored', reason: 'negocio_em_andamento' };
  if (!lf.segment) return { status: 'ignored', reason: 'sem_segmento' };
  const numero = telefoneParaEnvio(lf.contact_phone);
  if (!numero || !lf.phone_key) return { status: 'ignored', reason: 'sem_telefone' };

  // Já recebeu (pela frase, de qualquer número) ou já está conversando → nada.
  const { rows: [ja] } = await pool.query<{ motivo: string }>(
    `select case when exists (select 1 from channel_welcomes w where w.lead_id = $1) then 'ja_enviado'
                 when ${LEAD_CONVERSOU('$1::uuid')} then 'ja_conversou'
                 when exists (select 1 from channel_chats ch where ch.organization_id = $2 and ch.phone_key = $3
                              and exists (select 1 from channel_messages m where m.chat_id = ch.id and not m.from_me)) then 'ja_conversou'
            end as motivo`, [leadId, lf.organization_id, lf.phone_key]);
  if (ja?.motivo) return { status: 'ignored', reason: ja.motivo };

  const { rows: [bv] } = await pool.query<{ id: string }>(
    `insert into channel_welcomes (organization_id, connection_id, chat_id, phone_key, lead_id, segment, origin)
     values ($1, $2, null, $3, $4, $5, 'form')
     on conflict (organization_id, phone_key) do nothing returning id`,
    [lf.organization_id, lf.connection_id, lf.phone_key, leadId, lf.segment]);
  if (!bv) return { status: 'ignored', reason: 'ja_enviado' };

  return chamarWebhook(lf.welcome_webhook_url, lf.welcome_secret, bv.id, lf, {
    origin: 'form',
    organization_id: lf.organization_id,
    instance: lf.instance_name,
    number: numero,
    phone: numero,
    chat_id: null,
    text: textoDeBoasVindas(lf.welcome_form_text, primeiroNome(lf.contact_name)),
    lead_id: leadId,
    segment: lf.segment,
    segment_id: lf.segment_id,
    company: lf.trade_name,
    contact_name: lf.contact_name,
    contact_email: lf.contact_email,
  });
}
