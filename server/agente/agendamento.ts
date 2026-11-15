import { servicePool } from '../db.js';
import { chamarEntradaDoOrbi, credencial, type Credencial } from '../orbi-cliente.js';

// Agendamento de demo pela Bia (docs/ORBI.md, "Agendamento pela Bia"). O CRM
// lê os horários livres de UM tipo de reunião do Orbi (o link salvo em
// Configurações → Orbi) e reserva o que o lead aceitou; a reserva já nasce
// confirmada lá. As rotas da Bia ficam em chatvolt.ts; aqui, o Orbi e as
// regras puras de escolher e escrever os horários.

export const FUSO = 'America/Sao_Paulo';
export type Horario = { start: string; end: string };
export type Opcao = { inicio: string; texto: string };
export type Periodo = 'manha' | 'tarde' | 'noite';

/** `https://orbi…/agendar/<pessoa>/<tipo>` → as duas partes do link. */
export function partesDoLink(link: string | null | undefined): { host: string; type: string } | null {
  const m = /\/agendar\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/i.exec(link?.trim() ?? '');
  return m ? { host: m[1].toLowerCase(), type: m[2].toLowerCase() } : null;
}

const PARTES = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const SEMANA: Record<string, string> = { Sun: 'domingo', Mon: 'segunda', Tue: 'terça', Wed: 'quarta', Thu: 'quinta', Fri: 'sexta', Sat: 'sábado' };

/** Dia (YYYY-MM-DD), minutos do dia e dia da semana em São Paulo. */
export function local(iso: string | number | Date) {
  const p = Object.fromEntries(PARTES.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute), semana: SEMANA[p.weekday] ?? '', dia: p.day, mes: p.month };
}

const somarDias = (data: string, n: number) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "hoje às 14h", "amanhã (sexta, 21/11) às 9h30", "quinta, 20/11, às 14h". */
export function rotuloDoHorario(iso: string, agora: Date = new Date()): string {
  const h = local(iso);
  const hoje = local(agora).data;
  const hora = `${Math.floor(h.minutos / 60)}h${h.minutos % 60 ? String(h.minutos % 60).padStart(2, '0') : ''}`;
  const dia = `${h.semana}, ${h.dia}/${h.mes}`;
  if (h.data === hoje) return `hoje (${dia}) às ${hora}`;
  if (h.data === somarDias(hoje, 1)) return `amanhã (${dia}) às ${hora}`;
  return `${dia}, às ${hora}`;
}

export function periodoDe(v: unknown): Periodo | null {
  const t = String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/manha|cedo/.test(t)) return 'manha';
  if (/tarde|almoco/.test(t)) return 'tarde';
  if (/noite/.test(t)) return 'noite';
  return null;
}

const noPeriodo = (minutos: number, p: Periodo) => (p === 'manha' ? minutos < 12 * 60 : p === 'tarde' ? minutos >= 12 * 60 && minutos < 18 * 60 : minutos >= 18 * 60);

/**
 * Até `max` horários para a Bia oferecer. Com dia pedido, espalhados nesse dia
 * (sem horário nele, cai para os próximos dias e `atendeuPedido` = false). Sem
 * dia, o primeiro de cada um dos três próximos dias com horário e, sobrando
 * vaga, uma opção em outro período dos mesmos dias.
 */
export function escolherOpcoes(slots: Horario[], pedido: { data?: string | null; periodo?: Periodo | null }, max = 4): { horarios: Horario[]; atendeuPedido: boolean } {
  const todos = slots.map((s) => ({ s, ...local(s.start) })).sort((a, b) => Date.parse(a.s.start) - Date.parse(b.s.start));
  const doPeriodo = pedido.periodo ? todos.filter((x) => noPeriodo(x.minutos, pedido.periodo!)) : todos;
  if (pedido.data) {
    const noDia = doPeriodo.filter((x) => x.data === pedido.data);
    if (noDia.length) {
      const n = Math.min(max, noDia.length);
      const idx = n === 1 ? [0] : Array.from({ length: n }, (_, i) => Math.round((i * (noDia.length - 1)) / (n - 1)));
      return { horarios: [...new Set(idx)].map((i) => noDia[i].s), atendeuPedido: true };
    }
  }
  const base = doPeriodo.length ? doPeriodo : todos;
  const atendeu = !pedido.data && (!pedido.periodo || doPeriodo.length > 0);
  const dias = [...new Set(base.map((x) => x.data))].slice(0, 3);
  const escolhidos = dias.map((d) => base.find((x) => x.data === d)!);
  for (const d of dias) {
    if (escolhidos.length >= max) break;
    const primeiro = escolhidos.find((x) => x.data === d)!;
    const outro = base.find((x) => x.data === d && x.minutos >= primeiro.minutos + 180);
    if (outro) escolhidos.push(outro);
  }
  return {
    horarios: escolhidos.slice(0, max).sort((a, b) => Date.parse(a.s.start) - Date.parse(b.s.start)).map((x) => x.s),
    atendeuPedido: atendeu,
  };
}

export const paraOpcoes = (hs: Horario[], agora = new Date()): Opcao[] => hs.map((h) => ({ inicio: h.start, texto: rotuloDoHorario(h.start, agora) }));

// ── Orbi ──────────────────────────────────────────────────────────────────

type Configuracao = { cred: Credencial; host: string; type: string };

/** Credencial e tipo de reunião da organização; nulo se não houver link salvo ou integração ligada. */
export async function configuracaoDoAgendamento(orgId: string): Promise<Configuracao | null> {
  const { rows } = await servicePool().query<{ booking_link: string | null }>(
    `select booking_link from org_orbi_integrations where organization_id = $1 and enabled`, [orgId]);
  const partes = partesDoLink(rows[0]?.booking_link);
  if (!partes) return null;
  const cred = await credencial(orgId).catch(() => null);
  return cred ? { cred, ...partes } : null;
}

export type ResultadoHorarios =
  | { ok: true; titulo: string; duracao: number; slots: Horario[] }
  | { ok: false; motivo: string };

/** Horários livres do tipo em [de, ate) (até 31 dias, limite do Orbi). */
export async function horariosDoOrbi(c: Configuracao, de: Date, ate: Date): Promise<ResultadoHorarios> {
  const q = new URLSearchParams({ host: c.host, type: c.type, from: de.toISOString(), to: ate.toISOString() });
  try {
    const r = await chamarEntradaDoOrbi(c.cred, 'GET', `/booking-slots?${q}`);
    const j = (await r.json().catch(() => ({}))) as { title?: string; durationMinutes?: number; slots?: Horario[]; error?: string };
    if (!r.ok) return { ok: false, motivo: j.error || `HTTP ${r.status}` };
    return { ok: true, titulo: j.title ?? 'Reunião', duracao: j.durationMinutes ?? 0, slots: j.slots ?? [] };
  } catch (e) {
    return { ok: false, motivo: `Orbi fora do ar (${(e as Error).message})` };
  }
}

export type Reserva = { id: string; status: string; start: string; end: string; seriesId: string | null; meetingUrl: string | null; warning?: string };
export type ResultadoReserva =
  | { ok: true; reserva: Reserva }
  | { ok: false; ocupado: true; alternativas: Horario[] }
  | { ok: false; ocupado: false; motivo: string };

export async function reservarNoOrbi(
  c: Configuracao,
  corpo: { externalId: string; start: string; name: string; email?: string; phone?: string; notes?: string },
): Promise<ResultadoReserva> {
  try {
    const r = await chamarEntradaDoOrbi(c.cred, 'POST', '/bookings', { ...corpo, host: c.host, type: c.type, timezone: FUSO });
    const j = (await r.json().catch(() => ({}))) as Reserva & { error?: string; code?: string; alternatives?: Horario[] };
    if (r.ok) return { ok: true, reserva: j };
    if (r.status === 409 && j.code === 'slot_taken') return { ok: false, ocupado: true, alternativas: j.alternatives ?? [] };
    return { ok: false, ocupado: false, motivo: j.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, ocupado: false, motivo: `Orbi fora do ar (${(e as Error).message})` };
  }
}
