import { servicePool } from '../../db.js';

// Liga uma conversa a um contato e ao negócio aberto dele (docs/WHATSAPP.md §5).
// 1. telefone (phone_key, indexado); 2. nome do perfil, só com um candidato e
// nome completo. Sem match: 'unmatched' — na Fase 3 a IA decide se vira negócio.
// Não cria nada aqui: empresa/contato/negócio novos só pelo resolve_company_contact.

/** Mais que isso com o mesmo telefone é placeholder ("9999999999"), não pessoa. */
const MAX_CONTATOS_MESMO_TELEFONE = 3;

interface Chat {
  id: string;
  organization_id: string;
  phone_key: string | null;
  phone_digits: string | null;
  push_name: string | null;
  status: string;
}

interface Candidato {
  contact_id: string;
  lead_id: string | null;
  phone: string | null;
}

// Para cada contato, o negócio aberto com atividade mais recente (pelo vínculo
// lead_contacts; contacts.lead_id é o legado). Contato com negócio aberto vem antes.
const CANDIDATOS_SQL = (filtro: string) => `
  select c.id as contact_id, l.id as lead_id, c.phone
  from contacts c
  left join lateral (
    select l.id, l.last_activity_at from leads l
    where l.organization_id = c.organization_id
      and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
      and (l.id in (select lc.lead_id from lead_contacts lc where lc.contact_id = c.id) or l.id = c.lead_id)
    order by l.last_activity_at desc nulls last limit 1
  ) l on true
  where c.organization_id = $1 and ${filtro}
  order by l.last_activity_at desc nulls last, c.updated_at desc
  limit ${MAX_CONTATOS_MESMO_TELEFONE + 1}`;

const nomeCompleto = (n: string) => n.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2;

export async function vincularConversa(chatId: string): Promise<{ status: string; matchedBy: string | null }> {
  const pool = servicePool();
  const { rows } = await pool.query<Chat>(
    `select id, organization_id, phone_key, phone_digits, push_name, status from channel_chats where id = $1`, [chatId]);
  const chat = rows[0];
  if (!chat) return { status: 'missing', matchedBy: null };
  if (chat.status === 'linked' || chat.status === 'ignored') return { status: chat.status, matchedBy: null };

  let escolhido: Candidato | null = null;
  let matchedBy: string | null = null;

  if (chat.phone_key) {
    const r = await pool.query<Candidato>(CANDIDATOS_SQL('c.phone_key = $2'), [chat.organization_id, chat.phone_key]);
    if (r.rows.length && r.rows.length <= MAX_CONTATOS_MESMO_TELEFONE) {
      escolhido = r.rows[0];
      matchedBy = r.rows.length > 1 ? 'phone_multiple' : 'phone';
    }
  }

  if (!escolhido && chat.push_name && nomeCompleto(chat.push_name)) {
    const r = await pool.query<Candidato>(
      CANDIDATOS_SQL(`lower(extensions.unaccent(btrim(c.name))) = lower(extensions.unaccent(btrim($2)))`),
      [chat.organization_id, chat.push_name]);
    if (r.rows.length === 1) {
      escolhido = r.rows[0];
      matchedBy = 'name';
    }
  }

  if (!escolhido) {
    await pool.query(`update channel_chats set status = 'unmatched', updated_at = now() where id = $1`, [chat.id]);
    return { status: 'unmatched', matchedBy: null };
  }

  await pool.query(
    `update channel_chats set status = 'linked', contact_id = $2, lead_id = $3, matched_by = $4, updated_at = now() where id = $1`,
    [chat.id, escolhido.contact_id, escolhido.lead_id, matchedBy]);
  // Achou pelo nome e o contato não tinha telefone: grava o do WhatsApp.
  if (matchedBy === 'name' && !escolhido.phone && chat.phone_digits) {
    await pool.query(`update contacts set phone = $2, updated_at = now() where id = $1 and coalesce(btrim(phone), '') = ''`,
      [escolhido.contact_id, `+${chat.phone_digits}`]);
  }
  return { status: 'linked', matchedBy };
}
