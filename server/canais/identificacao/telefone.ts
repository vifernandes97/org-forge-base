// Telefone na forma de comparação. Mesmo cálculo de public.phone_match_key
// (db/60_canais.sql), que gera contacts.phone_key e channel_chats.phone_key:
// mudar um exige mudar o outro (o teste compara os dois).
//   Brasil: sem o 55 e sem o 9º dígito do celular → DDD + 8 dígitos, porque o
//   CRM guarda "(11) 98765-4321", "5511987654321", "+55 11 8765-4321"…
//   Fora disso: só os dígitos. Menos de 10 dígitos: nulo (não casa).
export function phoneMatchKey(phone: string | null | undefined): string | null {
  let v = (phone ?? '').replace(/\D/g, '');
  if ((v.length === 12 || v.length === 13) && v.startsWith('55')) v = v.slice(2);
  if (v.length === 11 && v[2] === '9') return v.slice(0, 2) + v.slice(3);
  return v.length >= 10 ? v : null;
}

const JID_TELEFONE = /^(\d+)(?::\d+)?@s\.whatsapp\.net$/;

/** Dígitos do JID de pessoa ("5511987654321@s.whatsapp.net"); nulo para @lid, grupo etc. */
export function jidToPhone(jid: string | null | undefined): string | null {
  return jid?.match(JID_TELEFONE)?.[1] ?? null;
}

export type TipoJid = 'person' | 'lid' | 'group' | 'broadcast' | 'other';

export function tipoJid(jid: string): TipoJid {
  if (jid.endsWith('@s.whatsapp.net')) return 'person';
  if (jid.endsWith('@lid')) return 'lid';
  if (jid.endsWith('@g.us')) return 'group';
  if (jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return 'broadcast';
  return 'other';
}
