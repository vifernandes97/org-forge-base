import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { servicePool } from '../db.js';
import { notificar, notificarNovoLead } from '../notificacoes.js';
import { moverEtapa, type Etapa } from '../negocios/etapa.js';
import { phoneMatchKey } from '../canais/identificacao/telefone.js';

// Ferramentas HTTP do agente Lara (Chatvolt, número 0573 da Oniplataforma).
// Piloto: a Lara chama o CRM durante a conversa para registrar a qualificação e
// para passar o lead a uma pessoa. A etapa muda só pelo moverEtapa (SLA e
// webhook da etapa), só para a frente e nunca para Engajamento.
//
//   POST /api/agente/chatvolt/qualificacao   Authorization: Bearer <CHATVOLT_AGENTE_TOKEN>
//   POST /api/agente/chatvolt/humano         idem
//
// Configuração (secrets.env): CHATVOLT_AGENTE_TOKEN (≥ 32 caracteres) e
// CHATVOLT_AGENTE_ORG (id da organização). Sem as duas, as rotas respondem 503.
// Lead não achado responde 200 com ok:false: a Lara segue a conversa.
//
// Lead que não veio do formulário: as duas rotas criam o negócio (Novo Lead do
// funil que tem a etapa Atendimento IA, origem whatsapp_0573) quando o telefone
// não tem negócio aberto. Telefone usado por mais de 3 negócios é placeholder:
// nada é criado.
//
// /qualificacao também grava a nota 1 a 5 (leads.qualification, calculada por
// notaDoLead com os critérios da Oni, não a nota que a Bia manda), os campos
// personalizados (tipo de negócio, média de festas, cidade, dor principal) e,
// o valor do negócio: com plano_escolhido sempre; com o plano indicado em
// planos_informados, só se o card está sem valor. Demo aceita vira Reunião de demonstração, que o
// trigger de db/66 manda ao Orbi como pedido de reunião.
//
// Handoff: com CHATVOLT_API_KEY e o campo conversa_id ({conversation-id} do
// Chatvolt), /humano põe a conversa em "Humano Solicitado" pela API do Chatvolt
// (a IA para de responder), mesmo que o lead não esteja no CRM. Isso substitui a
// ferramenta nativa "Solicitar Humano", que transfere sem seguir o prompt.

export const ETAPA_IA = 'Atendimento IA';
export const ETAPA_HUMANO = 'Atendimento Humano';
const PROIBIDA = 'engajamento';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const texto = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');

export const MOTIVOS = ['demo', 'vendedor', 'preco', 'pessoa', 'cliente', 'reclamacao', 'duvida', 'outro'] as const;
export type Motivo = (typeof MOTIVOS)[number];

/** Etapa de destino se o negócio ainda está antes dela; nulo para não mexer (nunca volta, nunca Engajamento). */
export function etapaParaFrente(etapas: Etapa[], atualId: string, nome: string): Etapa | null {
  const atual = etapas.find((e) => e.id === atualId);
  const alvo = etapas.find((e) => normalizar(e.name) === normalizar(nome));
  if (!atual || !alvo || normalizar(alvo.name) === PROIBIDA) return null;
  return alvo.position > atual.position ? alvo : null;
}

const QUALIFICACAO: [string, string][] = [
  ['tipo_negocio', 'Tipo de negócio'],
  ['eventos_mes', 'Eventos por mês'],
  ['cidade', 'Cidade'],
  ['controle_atual', 'Como controla hoje'],
  ['maior_dor', 'Maior dor'],
  ['pessoas', 'Pessoas que usariam'],
  ['email', 'E-mail'],
  ['planos_informados', 'Planos e preços informados'],
  ['plano_escolhido', 'Plano escolhido pelo lead'],
];

/** Campo da Bia → campo personalizado do CRM (field_name). */
export const CAMPOS_CRM: [string, string][] = [
  ['tipo_negocio', 'tipo_de_negocio'],
  ['eventos_mes', 'media_de_festas'],
  ['cidade', 'cidade'],
  ['maior_dor', 'dor_principal'],
];

const GENERICO = new Set(['outro', 'outros', 'nao informado', 'nao sei', 'desconhecido', 'n/a', '-']);

/** Valor vazio ou genérico ("outro") não sobrescreve o que a Bia já descobriu. */
export function camposPersonalizados(c: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(CAMPOS_CRM.map(([k, f]) => [f, texto(c[k], 200)] as const)
    .filter(([, v]) => v && !GENERICO.has(normalizar(v))));
}

/** Telefone com DDI: número brasileiro sem o 55 (10 ou 11 dígitos) ganha o 55. */
export function telefoneComDdi(telefone: string): string {
  const d = telefone.replace(/\D/g, '');
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Nota de 1 a 5 da Bia; fora disso, nada. */
export function notaValida(v: unknown): number | null {
  const n = Math.round(Number(typeof v === 'string' ? v.replace(',', '.') : v));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

export const PRECOS: Record<string, number> = { starter: 199, pro: 399, enterprise: 549 };

/** Plano que o lead escolheu e a mensalidade; valor informado (ex.: Black Friday) vale se for plausível. */
export function valorDoPlano(plano: unknown, valor: unknown): { plano: string; valor: number } | null {
  const chave = normalizar(texto(plano, 40)).split(/\s+/).find((p) => p in PRECOS);
  if (!chave) return null;
  const n = Number(typeof valor === 'string' ? valor.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.') : valor);
  const nome = chave[0].toUpperCase() + chave.slice(1);
  return { plano: nome, valor: Number.isFinite(n) && n >= 50 && n <= 20000 ? n : PRECOS[chave] };
}

/** Plano que a Bia indicou em planos_informados ("Starter R$ 199; indicado Starter"); vale para o valor do negócio. */
export function planoIndicado(planos: unknown): { plano: string; valor: number } | null {
  const t = normalizar(texto(planos, 300));
  if (!t) return null;
  const nomes = Object.keys(PRECOS);
  const marcado = t.match(new RegExp(`indicad[oa]s?\\s*:?\\s*(?:o\\s+|plano\\s+)?(${nomes.join('|')})\\b`))?.[1];
  // "pro" também é "para o": só conta como plano com "plano pro" ou preço/pontuação logo depois.
  const citados = nomes.filter((k) => new RegExp(k === 'pro' ? `plano\\s+pro\\b|\\bpro\\b\\s*(?:[:(-]\\s*)?(?:r\\$|por r\\$|;|,|$)` : `\\b${k}\\b`).test(t));
  const chave = marcado ?? (citados.length === 1 ? citados[0] : null);
  if (!chave) return null;
  const preco = t.match(new RegExp(`\\b${chave}\\b[^;\\d]{0,20}r\\$\\s*([\\d.,]+)`))?.[1];
  return valorDoPlano(chave, preco ?? null);
}

/** E-mail que o lead passou na conversa; inválido vira vazio. */
export function emailValido(v: unknown): string {
  const e = texto(v, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : '';
}

const DIAS_SEMANA: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

/** Data e hora da demo a partir do que o lead disse ("quinta", "14/11", "amanhã" + "manhã"/"15h"); sem dia, próximo dia útil. */
export function horarioDaDemo(dia: string, periodo: string, agora = new Date()): { data: string; hora: string } {
  const sp = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = new Date(sp.getFullYear(), sp.getMonth(), sp.getDate());
  const d = normalizar(dia);
  const tudo = `${d} ${normalizar(periodo)}`;
  const h = tudo.match(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  const hora = h && Number(h[1]) >= 7 && Number(h[1]) <= 21
    ? `${h[1].padStart(2, '0')}:${h[2] ?? '00'}`
    : /noite/.test(tudo) ? '19:00' : /tarde/.test(tudo) ? '14:00' : '10:00';
  const util = (x: Date) => { while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return x; };
  const mais = (n: number) => { const x = new Date(hoje); x.setDate(x.getDate() + n); return x; };

  let alvo: Date | null = null;
  const dm = d.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dm) {
    const ano = dm[3] ? Number(dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : hoje.getFullYear();
    alvo = new Date(ano, Number(dm[2]) - 1, Number(dm[1]));
    if (!dm[3] && alvo < hoje) alvo.setFullYear(ano + 1);
  } else if (/depois de amanha/.test(d)) alvo = mais(2);
  else if (/amanha/.test(d)) alvo = mais(1);
  else if (/\bhoje\b/.test(d)) alvo = mais(0);
  else {
    const w = Object.entries(DIAS_SEMANA).find(([nome]) => d.includes(nome))?.[1];
    if (w !== undefined) alvo = mais((w - hoje.getDay() + 7) % 7 || 7);
  }
  const [hh, mm] = hora.split(':').map(Number);
  if (!alvo || alvo < hoje || (alvo.getTime() === hoje.getTime() && hh * 60 + mm <= sp.getHours() * 60 + sp.getMinutes())) {
    alvo = util(mais(1));
  }
  const data = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(alvo.getDate()).padStart(2, '0')}`;
  return { data, hora };
}

export function textoQualificacao(c: Record<string, unknown>): string {
  const linhas = QUALIFICACAO.map(([k, rotulo]) => [rotulo, texto(c[k])] as const).filter(([, v]) => v).map(([r, v]) => `${r}: ${v}`);
  const resumo = texto(c.resumo, 1500);
  const nota = notaValida(c.nota);
  return [resumo, ...linhas, nota ? `Nota da Bia: ${nota} de 5` : ''].filter(Boolean).join('\n');
}

/**
 * PCI da Oni: buffet infantil e espaço de eventos. true = no PCI, false = fora
 * (itinerante, casamento, corporativo, decoração, fotografia, produtora…),
 * null = não dá para saber (ex.: só "buffet").
 */
export function noPerfilIdeal(tipo: string): boolean | null {
  const t = normalizar(tipo);
  if (!t) return null;
  if (/infantil|kids|crianca|espaco|salao|casa de festa/.test(t)) return true;
  if (/itinerante|casamento|corporativ|decora|fotograf|produtor|cerimonial|assessoria|dj|som|bolo|doce|confeit/.test(t)) return false;
  return null;
}

const NUMEROS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };

/** Quantas pessoas usariam o sistema; null se não der para saber. */
export function quantasPessoas(v: unknown): number | null {
  const t = normalizar(texto(v, 200));
  if (!t) return null;
  const d = t.match(/\d+/);
  if (d) return Number(d[0]);
  const palavra = t.split(/[^a-z]+/).find((w) => w in NUMEROS);
  if (palavra) return NUMEROS[palavra];
  if (/\b(so|somente|apenas)\s+eu\b|sozinh/.test(t)) return 1;
  if (/\beu e\b|\bnos dois\b|\bsocio|\besposa|\bmarido|\bequipe|\bfuncionari/.test(t)) return 2;
  return null;
}

/** Usa ou já usou algum sistema (não planilha, caderno ou WhatsApp). */
export function usaSistema(v: unknown): boolean {
  const t = normalizar(texto(v, 300));
  if (!/sistema|software|aplicativo|\bapp\b|programa|plataforma/.test(t)) return false;
  return !/(nenhum|sem|nunca usou|nunca usei|nao usa|nao uso|nao tem|nao tenho)\s+(\w+\s+)?(sistema|software|aplicativo|app|programa|plataforma)/.test(t);
}

// Financeiro, estoque e precificação são os recursos mais fracos da Oni: o lead converte, mas não fica.
const DOR_FRACA = /financ|pagamento|cobranc|inadimpl|estoque|precific|custo|fluxo de caixa|\bcaixa\b/;
const DOR_FORTE = /orcamento|agenda|data|atendimento|contrato|cliente|whatsapp|organiza|resposta|demora|festa|convite|equipe|vend/;

/** A dor principal (a citada primeiro) não é financeiro, estoque ou precificação. null = dor não informada. */
export function dorForte(v: unknown): boolean | null {
  const t = normalizar(texto(v, 300));
  if (!t) return null;
  const fraca = t.search(DOR_FRACA);
  const forte = t.search(DOR_FORTE);
  if (fraca < 0) return true;
  return forte >= 0 && forte < fraca;
}

/**
 * Nota de 1 a 5 do lead, pelos critérios da Oni (não pela opinião da Bia):
 * buffet infantil ou espaço de eventos começa em 3; fora do PCI, 1; segmento
 * desconhecido, 2. Soma 1 para cada: mais de uma pessoa usaria o sistema, usa
 * ou já usou sistema, dor principal fora de financeiro/estoque/precificação.
 */
export function notaDoLead(c: { tipo?: unknown; pessoas?: unknown; controle?: unknown; dor?: unknown }): number {
  const pci = noPerfilIdeal(texto(c.tipo, 120));
  let nota = pci === true ? 3 : pci === false ? 1 : 2;
  if ((quantasPessoas(c.pessoas) ?? 0) > 1) nota++;
  if (usaSistema(c.controle)) nota++;
  if (dorForte(c.dor)) nota++;
  return Math.min(nota, 5);
}

export function motivoValido(v: unknown): Motivo {
  const m = normalizar(texto(v)) as Motivo;
  return MOTIVOS.includes(m) ? m : 'outro';
}

/** Título da tarefa do handoff; nulo quando é cliente (vai para o suporte, sem mexer no funil comercial). */
export function tarefaDoHandoff(motivo: Motivo, detalhe: string, demoDia: string, demoPeriodo: string): string {
  if (motivo === 'demo') {
    const quando = [demoDia, demoPeriodo].filter(Boolean).join(', ');
    return `Confirmar horário da demo${quando ? `: ${quando}` : ''}`;
  }
  if (motivo === 'cliente') return 'Cliente da Oni no 0573: encaminhar ao suporte';
  if (motivo === 'vendedor') return `Lead fora do PCI: vendedor qualifica antes da demo${detalhe ? `: ${detalhe}` : ''}`.slice(0, 200);
  return `Assumir conversa no Chatvolt${detalhe ? `: ${detalhe}` : ''}`.slice(0, 200);
}

const CHATVOLT_API = 'https://api.chatvolt.ai';

/** Põe a conversa em "Humano Solicitado" no Chatvolt. Falha não derruba o handoff. */
export async function pausarIaChatvolt(conversaId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const chave = process.env.CHATVOLT_API_KEY ?? '';
  if (!chave || !/^[a-z0-9]{10,40}$/i.test(conversaId)) return false;
  try {
    const r = await fetchImpl(`${CHATVOLT_API}/conversations/${conversaId}/set-status`, {
      method: 'POST',
      headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'HUMAN_REQUESTED' }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.error('[agente] chatvolt set-status', r.status, (await r.text().catch(() => '')).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error('[agente] chatvolt set-status', e);
    return false;
  }
}

// O que já foi mandado por conversa: só vai ao Chatvolt o que mudou (a Bia chama o CRM a cada mensagem).
const enviadas = new Map<string, Record<string, string>>();

/** Grava no contato da conversa do Chatvolt as variáveis que mudaram. Falha não derruba a rota. */
export async function enviarVariaveisChatvolt(conversaId: string, vars: Record<string, string>, fetchImpl: typeof fetch = fetch): Promise<number> {
  const chave = process.env.CHATVOLT_API_KEY ?? '';
  if (!chave || !/^[a-z0-9]{10,40}$/i.test(conversaId)) return 0;
  const antes = enviadas.get(conversaId) ?? {};
  const mudou = Object.entries(vars).filter(([k, v]) => v && antes[k] !== v);
  let ok = 0;
  for (const [key, value] of mudou) {
    try {
      const r = await fetchImpl(`${CHATVOLT_API}/contacts/variables`, {
        method: 'POST',
        headers: { authorization: `Bearer ${chave}`, 'content-type': 'application/json' },
        body: JSON.stringify({ id: conversaId, key, value, source: 'human' }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { console.error('[agente] chatvolt variável', key, r.status, (await r.text().catch(() => '')).slice(0, 200)); break; }
      antes[key] = value;
      ok++;
    } catch (e) {
      console.error('[agente] chatvolt variável', key, e);
      break;
    }
  }
  enviadas.set(conversaId, antes);
  return ok;
}

/** Dados do formulário e do negócio que o vendedor quer ver no Chatvolt sem abrir o CRM. */
async function variaveisDoNegocio(n: Negocio): Promise<Record<string, string>> {
  const { rows: [l] } = await servicePool().query<{ qualification: number | null; value: string | null; etapa: string | null; empresa: string | null; segmento: string | null }>(
    `select l.qualification, l.value, s.name as etapa, co.trade_name as empresa, sg.label as segmento
       from leads l left join stages s on s.id = l.stage_id left join companies co on co.id = l.company_id
       left join company_segments sg on sg.id = co.segment_id where l.id = $1`, [n.id]);
  const { rows: cf } = await servicePool().query<{ field_name: string; value: string | null }>(
    `select d.field_name, v.value from custom_field_values v join custom_field_definitions d on d.id = v.field_definition_id
      where v.lead_id = $1 and d.organization_id = $2`, [n.id, n.organization_id]);
  const c = Object.fromEntries(cf.map((r) => [r.field_name, (r.value ?? '').trim()]));
  const crm = (process.env.BETTER_AUTH_URL || 'https://crm.neosoluti.com.br').replace(/\/+$/, '');
  const valor = Number(l?.value ?? 0);
  return {
    segmento: l?.segmento || c.tipo_de_negocio || '',
    empresa: l?.empresa || '',
    cidade: c.cidade || '',
    festas_por_mes: c.media_de_festas || '',
    dor: c.dor_principal || '',
    origem: [c.utm_source, c.utm_campaign, c.utm_content].filter(Boolean).join(' / '),
    nota_crm: l?.qualification ? `${l.qualification} de 5` : '',
    valor_crm: valor > 0 ? `R$ ${valor.toLocaleString('pt-BR')}` : '',
    etapa_crm: l?.etapa || '',
    link_crm: `${crm}/?lead=${n.id}`,
  };
}

/** Atualiza o painel do Chatvolt sem segurar a resposta da Bia. */
function atualizarPainelChatvolt(n: Negocio, conversaId: string) {
  if (!conversaId) return;
  void variaveisDoNegocio(n).then((v) => enviarVariaveisChatvolt(conversaId, v)).catch((e) => console.error('[agente] painel chatvolt', e));
}

/** Telefone do lead pela conversa no Chatvolt. Na 1ª resposta a variável {user-phone-number} ainda não vem preenchida. */
export async function telefoneDaConversa(conversaId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const chave = process.env.CHATVOLT_API_KEY ?? '';
  if (!chave || !/^[a-z0-9]{10,40}$/i.test(conversaId)) return '';
  try {
    const r = await fetchImpl(`${CHATVOLT_API}/conversations/${conversaId}`, {
      headers: { authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return '';
    const j = (await r.json()) as { participantsContacts?: { phoneNumber?: string | null }[] };
    const tel = (j.participantsContacts ?? []).map((x) => (x.phoneNumber ?? '').replace(/\D/g, '')).find((x) => x.length >= 10);
    return tel ?? '';
  } catch (e) {
    console.error('[agente] chatvolt conversa', e);
    return '';
  }
}

/** Telefone do corpo; se veio vazio ou como placeholder, busca pela conversa. */
export async function telefoneDoLead(corpo: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<string> {
  const t = texto(corpo.telefone, 40);
  if (t.replace(/\D/g, '').length >= 10) return t;
  return (await telefoneDaConversa(texto(corpo.conversa_id, 60), fetchImpl)) || t;
}

function autorizado(header: string | undefined): boolean {
  const esperado = process.env.CHATVOLT_AGENTE_TOKEN ?? '';
  const recebido = (header ?? '').replace(/^Bearer\s+/i, '');
  if (esperado.length < 32 || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

interface Negocio {
  id: string;
  organization_id: string;
  name: string;
  stage_id: string;
  funnel_id: string;
  assigned_to: string | null;
}

/** Negócio aberto mais recente do contato com esse telefone (mesma regra de vincular.ts). */
async function negocioPorTelefone(orgId: string, telefone: string): Promise<{ negocio: Negocio | null; ambiguo: boolean }> {
  const chave = phoneMatchKey(telefone);
  if (!chave) return { negocio: null, ambiguo: true };
  const { rows } = await servicePool().query<Negocio>(
    `select l.id, l.organization_id, l.name, l.stage_id, l.funnel_id, l.assigned_to
     from contacts c
     join leads l on l.organization_id = c.organization_id
       and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
       and (l.id in (select lc.lead_id from lead_contacts lc where lc.contact_id = c.id) or l.id = c.lead_id)
     where c.organization_id = $1 and c.phone_key = $2
     order by l.last_activity_at desc nulls last
     limit 4`, [orgId, chave]);
  // Mais de 3 contatos/negócios com o mesmo telefone é placeholder, não pessoa.
  return { negocio: rows.length && rows.length <= 3 ? rows[0] : null, ambiguo: rows.length > 3 };
}

/** Negócio do telefone; se não houver, cria em Novo Lead (lead que chegou direto no 0573). */
async function garantirNegocio(orgId: string, telefone: string, nome: string, segmento: string): Promise<{ negocio: Negocio | null; novo: boolean }> {
  const achado = await negocioPorTelefone(orgId, telefone);
  if (achado.negocio || achado.ambiguo) return { negocio: achado.negocio, novo: false };
  const chave = phoneMatchKey(telefone)!;
  const digitos = telefoneComDdi(telefone);
  const client = await servicePool().connect();
  let criado: { negocio: Negocio; companyId: string } | null = null;
  try {
    await client.query('begin');
    // Duas chamadas da Bia ao mesmo tempo não criam dois negócios.
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`chatvolt:${orgId}:${chave}`]);
    const outra = await negocioPorTelefone(orgId, telefone);
    if (outra.negocio || outra.ambiguo) {
      await client.query('rollback');
      return { negocio: outra.negocio, novo: false };
    }
    // Lead do formulário que digitou outro telefone: o formulário entrou há pouco e ninguém falou com ele ainda.
    const { rows: recentes } = await client.query<Negocio & { company_id: string }>(
      `select l.id, l.organization_id, l.name, l.stage_id, l.funnel_id, l.assigned_to, l.company_id
       from leads l join stages s on s.id = l.stage_id
       where l.organization_id = $1 and l.source = 'formulário' and l.status = 'open' and l.archived_at is null
         and l.merged_into_lead_id is null and l.created_at > now() - interval '10 minutes'
         and s.position = (select min(position) from stages where funnel_id = l.funnel_id)
         and not exists (select 1 from lead_activities a where a.lead_id = l.id and a.title like '%Bia (IA)%')
       limit 2`, [orgId]);
    if (recentes.length === 1) {
      const f = recentes[0];
      const { rows: [ct] } = await client.query<{ id: string }>(
        `insert into contacts (organization_id, lead_id, name, phone, phone_key, company_id) values ($1, $2, $3, $4, $5, $6) returning id`,
        [orgId, f.id, nome || 'WhatsApp', `+${digitos}`, chave, f.company_id]);
      await client.query(`insert into lead_contacts (organization_id, lead_id, contact_id, is_primary) values ($1, $2, $3, false)`,
        [orgId, f.id, ct.id]);
      const { rows: [m0] } = await client.query<{ user_id: string }>(
        `select user_id from organization_members where organization_id = $1 order by (role = 'owner') desc, created_at limit 1`, [orgId]);
      await client.query(
        `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
         values ($1, $2, $3, 'note', 'WhatsApp vinculado pela Bia (IA)', $4, $5)`,
        [orgId, f.id, f.assigned_to ?? m0?.user_id,
         `O lead chamou no 0573 com um telefone diferente do formulário: +${digitos}. Contato adicionado a este negócio.`,
         { origem: 'chatvolt_lara' }]);
      await client.query('commit');
      const { company_id: _c, ...negocio } = f;
      return { negocio, novo: false };
    }
    const { rows: [etapa] } = await client.query<Etapa>(
      `select s.id, s.name, s.position, s.funnel_id, s.sla_hours, s.webhook_url from stages s
       where s.funnel_id = (select funnel_id from stages x join funnels f on f.id = x.funnel_id
                            where f.organization_id = $1 and x.name = $2 limit 1)
       order by s.position limit 1`, [orgId, ETAPA_IA]);
    if (!etapa) throw new Error(`funil com a etapa ${ETAPA_IA} não encontrado`);
    const { rows: [res] } = await client.query<{ r: { company_id: string; contact_id: string | null } }>(
      `select resolve_company_contact(p_org => $1, p_contact_name => $2, p_phone => $3, p_segment_hint => $4) as r`,
      [orgId, nome || null, `+${digitos}`, segmento || null]);
    if (!res?.r?.company_id) throw new Error('resolve_company_contact sem empresa');
    const { rows: [m] } = await client.query<{ user_id: string }>(
      `select user_id from organization_members where organization_id = $1 order by (role = 'owner') desc, created_at limit 1`, [orgId]);
    const { rows: [lead] } = await client.query<Negocio>(
      `insert into leads (organization_id, funnel_id, stage_id, company_id, value, source, tags, priority, stage_entered_at)
       values ($1, $2, $3, $4, 0, 'whatsapp_0573', '{}', 'medium', now())
       returning id, organization_id, name, stage_id, funnel_id, assigned_to`,
      [orgId, etapa.funnel_id, etapa.id, res.r.company_id]);
    if (res.r.contact_id) {
      await client.query(`insert into lead_contacts (organization_id, lead_id, contact_id, is_primary) values ($1, $2, $3, true)`,
        [orgId, lead.id, res.r.contact_id]);
    }
    await client.query(
      `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
       values ($1, $2, $3, 'note', 'Lead criado pela Bia (IA)', $4, $5)`,
      [orgId, lead.id, m?.user_id, `Chegou direto no WhatsApp 0573, sem formulário. Telefone +${digitos}.`, { origem: 'chatvolt_lara' }]);
    await client.query('commit');
    criado = { negocio: lead, companyId: res.r.company_id };
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    console.error('[agente] criar negócio', e);
    return { negocio: null, novo: false };
  } finally {
    client.release();
  }
  notificarNovoLead({ organizationId: orgId, leadId: criado.negocio.id, companyId: criado.companyId, contactName: nome || null })
    .catch((e) => console.error('[agente] notificarNovoLead', e));
  return { negocio: criado.negocio, novo: true };
}

/** Grava os campos personalizados que a Bia descobriu (sobrescreve o valor anterior). */
async function gravarCampos(n: Negocio, campos: Record<string, string>): Promise<string[]> {
  const nomes = Object.keys(campos);
  if (!nomes.length) return [];
  const pool = servicePool();
  const { rows: defs } = await pool.query<{ id: string; field_name: string }>(
    `select id, field_name from custom_field_definitions where organization_id = $1 and is_active and field_name = any($2)`,
    [n.organization_id, nomes]);
  for (const d of defs) {
    const { rowCount } = await pool.query(
      // O segmento do formulário é a fonte do PCI: a Bia só preenche se estiver vazio.
      d.field_name === 'tipo_de_negocio'
        ? `update custom_field_values set value = case when coalesce(value, '') = '' then $3 else value end where lead_id = $1 and field_definition_id = $2`
        : `update custom_field_values set value = $3 where lead_id = $1 and field_definition_id = $2`,
      [n.id, d.id, campos[d.field_name]]);
    if (!rowCount) {
      await pool.query(`insert into custom_field_values (lead_id, field_definition_id, value) values ($1, $2, $3)`,
        [n.id, d.id, campos[d.field_name]]);
    }
  }
  return defs.map((d) => d.field_name);
}

/** Recalcula a nota com tudo o que a Bia já registrou do lead mais o que chegou agora. */
async function recalcularNota(n: Negocio, corpo: Record<string, unknown>): Promise<number> {
  const { rows } = await servicePool().query<{ campos: Record<string, unknown> | null }>(
    `select metadata->'campos' as campos from lead_activities where lead_id = $1 and title = 'Atendimento da Bia (IA)' order by created_at`, [n.id]);
  const juntos: Record<string, unknown> = {};
  for (const r of [...rows.map((x) => x.campos ?? {}), corpo]) {
    for (const [k, v] of Object.entries(r)) if (texto(v, 300) && !GENERICO.has(normalizar(texto(v, 300)))) juntos[k] = v;
  }
  const nota5 = notaDoLead({ tipo: (await tipoDoNegocio(n)) || juntos.tipo_negocio, pessoas: juntos.pessoas, controle: juntos.controle_atual, dor: juntos.maior_dor });
  await servicePool().query(`update leads set qualification = $2 where id = $1`, [n.id, nota5]);
  return nota5;
}

/** Segmento do negócio (campo tipo_de_negocio), vazio se não houver. */
async function tipoDoNegocio(n: Negocio): Promise<string> {
  const { rows } = await servicePool().query<{ value: string | null }>(
    `select v.value from custom_field_values v join custom_field_definitions d on d.id = v.field_definition_id
      where v.lead_id = $1 and d.organization_id = $2 and d.field_name = 'tipo_de_negocio' limit 1`, [n.id, n.organization_id]);
  return rows[0]?.value ?? '';
}

async function autor(n: Negocio): Promise<string> {
  if (n.assigned_to) return n.assigned_to;
  const pool = servicePool();
  const { rows } = await pool.query<{ user_id: string }>(
    `select actor_user_id as user_id from channel_connections where organization_id = $1 and actor_user_id is not null and is_active order by created_at limit 1`,
    [n.organization_id]);
  if (rows[0]) return rows[0].user_id;
  const { rows: m } = await pool.query<{ user_id: string }>(
    `select user_id from organization_members where organization_id = $1 order by (role = 'owner') desc, created_at limit 1`, [n.organization_id]);
  return m[0]?.user_id;
}

async function etapas(funnelId: string): Promise<Etapa[]> {
  const { rows } = await servicePool().query<Etapa>(
    `select id, name, position, funnel_id, sla_hours, webhook_url from stages where funnel_id = $1 order by position`, [funnelId]);
  return rows;
}

async function nota(n: Negocio, userId: string, titulo: string, descricao: string, metadata: object) {
  await servicePool().query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, $3, 'note', $4, $5, $6)`,
    [n.organization_id, n.id, userId, titulo, descricao || null, { origem: 'chatvolt_lara', ...metadata }]);
}

async function mover(n: Negocio, userId: string, nomeEtapa: string, motivo: string): Promise<string | null> {
  const lista = await etapas(n.funnel_id);
  const para = etapaParaFrente(lista, n.stage_id, nomeEtapa);
  const de = lista.find((e) => e.id === n.stage_id);
  if (!para || !de) return null;
  const ok = await moverEtapa({ leadId: n.id, de, para, userId, quem: 'Bia (IA, Chatvolt)', motivo, metadata: { origem: 'chatvolt_lara' } });
  return ok ? para.name : null;
}

/**
 * Grava o e-mail do lead no contato principal (o pedido ao Orbi leva o e-mail
 * dele, que vira convidado da demo). Não troca e-mail que já existe. Se a demo
 * já foi pedida ao Orbi sem e-mail, mexe na descrição para o pedido ser reenviado.
 */
async function gravarEmail(n: Negocio, email: string) {
  if (!email) return;
  const pool = servicePool();
  const { rowCount } = await pool.query(
    `update contacts set email = $2, updated_at = now()
      where id = (select lc.contact_id from lead_contacts lc where lc.lead_id = $1 order by lc.is_primary desc limit 1)
        and coalesce(email, '') = ''`, [n.id, email]);
  if (!rowCount) return;
  await pool.query(
    `update tasks set description = concat_ws(E'\n', description, $2::text), updated_at = now()
      where lead_id = $1 and task_type = 'meeting' and completed_at is null and external_status in ('queued', 'pending')`,
    [n.id, `E-mail do lead: ${email}`]);
}

/**
 * Demo aceita: uma tarefa Reunião > Reunião de demonstração por negócio. O tipo
 * Reunião tem action orbi_meeting, então o trigger de db/66 manda o pedido ao
 * Orbi (server/orbi.ts). A Bia chama /humano mais de uma vez: a tarefa aberta só
 * muda se o horário mudar (o que reenvia o mesmo pedido no Orbi).
 */
async function agendarDemo(n: Negocio, userId: string, dia: string, periodo: string, descricao: string) {
  const pool = servicePool();
  const { data, hora } = horarioDaDemo(dia, periodo);
  const pedido = [dia, periodo].filter(Boolean).join(', ') || 'sem dia definido';
  const obs = [`Horário sugerido pela Bia (o lead pediu: ${pedido}). Confirme com o lead pelo 0573 e ajuste aqui.`, descricao].join('\n');
  const { rows: [sub] } = await pool.query<{ id: string }>(
    `select st.id from task_subtypes st join task_types t on t.id = st.task_type_id
      where st.organization_id = $1 and t.code = 'meeting' and st.is_active and st.label ilike '%demonstra%'
      order by st.position limit 1`, [n.organization_id]);
  const { rows: [aberta] } = await pool.query<{ id: string; quando: string }>(
    `select id, to_char(due_date at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI') as quando from tasks
      where lead_id = $1 and task_type = 'meeting' and completed_at is null
        and (task_subtype_id is not distinct from $2 or title like 'Demo Oniplataforma%')
      order by created_at desc limit 1`, [n.id, sub?.id ?? null]);
  if (aberta) {
    if (aberta.quando !== `${data} ${hora}`) {
      await pool.query(
        `update tasks set due_date = ($2 || ' ' || $3)::timestamp at time zone 'America/Sao_Paulo', description = $4, updated_at = now() where id = $1`,
        [aberta.id, data, hora, obs]);
    }
    return;
  }
  await pool.query(
    `insert into tasks (organization_id, lead_id, assigned_to, title, description, task_type, task_subtype_id, due_date, priority)
     values ($1, $2, $3, $4, $5, 'meeting', $6, ($7 || ' ' || $8)::timestamp at time zone 'America/Sao_Paulo', 'high')`,
    [n.organization_id, n.id, userId, `Demo Oniplataforma: ${n.name}`.slice(0, 200), obs, sub?.id ?? null, data, hora]);
}

type Resposta = { ok: boolean; mensagem: string; etapa?: string | null };

async function preparar(req: Request): Promise<{ orgId: string; corpo: Record<string, unknown> } | Response> {
  const orgId = process.env.CHATVOLT_AGENTE_ORG;
  if (!orgId || !process.env.CHATVOLT_AGENTE_TOKEN) return Response.json({ ok: false, mensagem: 'Integração não configurada' }, { status: 503 });
  if (!autorizado(req.headers.get('authorization') ?? undefined)) return Response.json({ ok: false, mensagem: 'Não autorizado' }, { status: 401 });
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return { orgId, corpo: corpo && typeof corpo === 'object' ? corpo : {} };
}

const naoAchado: Resposta = { ok: false, mensagem: 'Não foi possível registrar no CRM. Continue a conversa normalmente.' };

export const agenteChatvolt = new Hono();

agenteChatvolt.post('/qualificacao', async (c) => {
  const p = await preparar(c.req.raw);
  if (p instanceof Response) return p;
  const { negocio: n, novo } = await garantirNegocio(p.orgId, await telefoneDoLead(p.corpo), texto(p.corpo.nome, 120), texto(p.corpo.tipo_negocio, 120));
  if (!n) return c.json(naoAchado);
  const userId = await autor(n);
  const pool = servicePool();
  const linhas = [textoQualificacao(p.corpo)];

  const campos = await gravarCampos(n, camposPersonalizados(p.corpo));
  // A nota sai dos critérios da Oni, não da opinião da Bia (a dela fica só no histórico).
  const nota5 = await recalcularNota(n, p.corpo);
  linhas.push(`Nota pelos critérios da Oni: ${nota5} de 5`);
  await gravarEmail(n, emailValido(p.corpo.email));
  const escolhido = valorDoPlano(p.corpo.plano_escolhido, p.corpo.valor);
  const indicado = escolhido ? null : planoIndicado(p.corpo.planos_informados);
  if (escolhido) {
    await pool.query(`update leads set value = $2 where id = $1`, [n.id, escolhido.valor]);
    linhas.push(`Valor do negócio: R$ ${escolhido.valor} por mês (plano ${escolhido.plano}, escolhido pelo lead).`);
  } else if (indicado) {
    // Plano só indicado: preenche o valor se o card ainda está sem valor (não passa por cima do que a equipe pôs).
    const { rowCount } = await pool.query(`update leads set value = $2 where id = $1 and coalesce(value, 0) = 0`, [n.id, indicado.valor]);
    if (rowCount) linhas.push(`Valor do negócio: R$ ${indicado.valor} por mês (plano ${indicado.plano}, indicado pela Bia).`);
  }

  // A Bia às vezes chama várias vezes na mesma resposta: nota vazia ou igual à última não é gravada.
  const descricao = linhas.filter(Boolean).join('\n');
  const { rows: [ultima] } = await pool.query<{ description: string | null }>(
    `select description from lead_activities where lead_id = $1 and title = 'Atendimento da Bia (IA)' order by created_at desc limit 1`, [n.id]);
  if (descricao && descricao !== ultima?.description) {
    await nota(n, userId, 'Atendimento da Bia (IA)', descricao,
      { campos: p.corpo, nota: nota5, campos_crm: campos, valor: escolhido?.valor ?? indicado?.valor ?? null, conversa_id: texto(p.corpo.conversa_id, 60) || null });
  }
  const etapa = await mover(n, userId, ETAPA_IA, 'Lead conversando com a Bia (IA) no 0573');
  atualizarPainelChatvolt(n, texto(p.corpo.conversa_id, 60));
  return c.json({ ok: true, mensagem: novo ? 'Lead cadastrado e registrado no CRM.' : 'Registrado no CRM.', etapa } satisfies Resposta);
});

agenteChatvolt.post('/humano', async (c) => {
  const p = await preparar(c.req.raw);
  if (p instanceof Response) return p;
  const pausada = await pausarIaChatvolt(texto(p.corpo.conversa_id, 60));
  const fim = pausada ? ' A conversa já está com a equipe: avise o lead em uma frase e pare de responder.' : '';
  const { negocio: n } = await garantirNegocio(p.orgId, await telefoneDoLead(p.corpo), texto(p.corpo.nome, 120), texto(p.corpo.tipo_negocio, 120));
  if (!n) return c.json({ ok: pausada, mensagem: `Não foi possível registrar no CRM.${fim || ' Continue a conversa normalmente.'}` } satisfies Resposta);
  const userId = await autor(n);
  let motivo = motivoValido(p.corpo.motivo);
  // Fora do PCI não tem demo marcada pela Bia: vai para o vendedor qualificar antes.
  const tipo = (await tipoDoNegocio(n)) || texto(p.corpo.tipo_negocio, 120);
  const foraDoPci = noPerfilIdeal(tipo) === false;
  if (motivo === 'demo' && foraDoPci) motivo = 'vendedor';
  const detalhe = texto(p.corpo.detalhe, 300);
  const demoDia = texto(p.corpo.demo_dia, 60);
  const demoPeriodo = texto(p.corpo.demo_periodo, 30);
  const resumo = texto(p.corpo.resumo, 1500);
  const titulo = tarefaDoHandoff(motivo, detalhe, demoDia, demoPeriodo);
  const descricao = [resumo, detalhe && `Motivo: ${detalhe}`, motivo === 'vendedor' && `Fora do PCI (segmento: ${tipo || 'não informado'}): qualificar antes de marcar demo.`, 'Responder pelo Chatvolt (número 0573).'].filter(Boolean).join('\n');
  const pool = servicePool();

  await nota(n, userId, 'Bia (IA) passou para humano', descricao, { motivo, demo_dia: demoDia || null, demo_periodo: demoPeriodo || null, ia_pausada: pausada });
  await recalcularNota(n, {});
  if (motivo === 'demo' || motivo === 'preco' || motivo === 'vendedor') {
    // Valor pelo plano que a Bia indicou, caso ela não tenha mandado planos_informados antes (card sem valor).
    const indicado = planoIndicado(p.corpo.planos_informados) ?? planoIndicado(resumo) ?? planoIndicado(detalhe);
    if (indicado) await pool.query(`update leads set value = $2 where id = $1 and coalesce(value, 0) = 0`, [n.id, indicado.valor]);
  }
  const etapa = motivo === 'cliente' ? null : await mover(n, userId, ETAPA_HUMANO, `Bia (IA) passou para humano: ${motivo}${detalhe ? `, ${detalhe}` : ''}`);
  atualizarPainelChatvolt(n, texto(p.corpo.conversa_id, 60));

  await gravarEmail(n, emailValido(p.corpo.email));
  if (motivo === 'demo') {
    await agendarDemo(n, userId, demoDia, demoPeriodo, descricao);
  } else {
    // Tarefa para hoje, sem repetir uma aberta com o mesmo título.
    const { rows: abertas } = await pool.query(
      `select 1 from tasks where lead_id = $1 and title = $2 and completed_at is null limit 1`, [n.id, titulo]);
    if (!abertas.length) {
      await pool.query(
        `insert into tasks (organization_id, lead_id, assigned_to, title, description, task_type, due_date, priority)
         values ($1, $2, $3, $4, $5, 'follow_up', ((now() at time zone 'America/Sao_Paulo')::date + time '23:59') at time zone 'America/Sao_Paulo', 'high')`,
        [n.organization_id, n.id, userId, titulo, descricao]);
    }
  }

  let userIds = n.assigned_to ? [n.assigned_to] : [];
  if (!userIds.length) {
    const { rows } = await pool.query<{ user_id: string }>(
      `select user_id from organization_members where organization_id = $1 and role in ('owner','admin')`, [n.organization_id]);
    userIds = rows.map((r) => r.user_id);
  }
  await notificar({ organizationId: n.organization_id, userIds, type: 'ai_update', title: `Bia passou ${n.name} para humano`, body: titulo, leadId: n.id })
    .catch((e) => console.error('[agente] notificar', e));

  const aviso = motivo === 'vendedor' ? ' Não marque demonstração: diga que o consultor vai chamar para entender a operação.' : '';
  return c.json({ ok: true, mensagem: `Equipe avisada no CRM.${aviso}${fim}`, etapa } satisfies Resposta);
});
