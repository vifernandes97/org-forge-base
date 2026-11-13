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
// /qualificacao também grava a nota 1 a 5 (leads.qualification), os campos
// personalizados (tipo de negócio, média de festas, cidade, dor principal) e,
// só com plano_escolhido, o valor do negócio (mensalidade do plano). No handoff
// por demo ou preço, a nota sobe para pelo menos 4.
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

export const MOTIVOS = ['demo', 'preco', 'pessoa', 'cliente', 'reclamacao', 'duvida', 'outro'] as const;
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

export function textoQualificacao(c: Record<string, unknown>): string {
  const linhas = QUALIFICACAO.map(([k, rotulo]) => [rotulo, texto(c[k])] as const).filter(([, v]) => v).map(([r, v]) => `${r}: ${v}`);
  const resumo = texto(c.resumo, 1500);
  const nota = notaValida(c.nota);
  return [resumo, ...linhas, nota ? `Nota da Bia: ${nota} de 5` : ''].filter(Boolean).join('\n');
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
      `update custom_field_values set value = $3 where lead_id = $1 and field_definition_id = $2`, [n.id, d.id, campos[d.field_name]]);
    if (!rowCount) {
      await pool.query(`insert into custom_field_values (lead_id, field_definition_id, value) values ($1, $2, $3)`,
        [n.id, d.id, campos[d.field_name]]);
    }
  }
  return defs.map((d) => d.field_name);
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

  const nota5 = notaValida(p.corpo.nota);
  if (nota5) await pool.query(`update leads set qualification = $2 where id = $1`, [n.id, nota5]);
  const campos = await gravarCampos(n, camposPersonalizados(p.corpo));
  const escolhido = valorDoPlano(p.corpo.plano_escolhido, p.corpo.valor);
  if (escolhido) {
    await pool.query(`update leads set value = $2 where id = $1`, [n.id, escolhido.valor]);
    linhas.push(`Valor do negócio: R$ ${escolhido.valor} por mês (plano ${escolhido.plano}, escolhido pelo lead).`);
  }

  // A Bia às vezes chama várias vezes na mesma resposta: nota vazia ou igual à última não é gravada.
  const descricao = linhas.filter(Boolean).join('\n');
  const { rows: [ultima] } = await pool.query<{ description: string | null }>(
    `select description from lead_activities where lead_id = $1 and title = 'Atendimento da Bia (IA)' order by created_at desc limit 1`, [n.id]);
  if (descricao && descricao !== ultima?.description) {
    await nota(n, userId, 'Atendimento da Bia (IA)', descricao,
      { campos: p.corpo, nota: nota5, campos_crm: campos, valor: escolhido?.valor ?? null, conversa_id: texto(p.corpo.conversa_id, 60) || null });
  }
  const etapa = await mover(n, userId, ETAPA_IA, 'Lead conversando com a Bia (IA) no 0573');
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
  const motivo = motivoValido(p.corpo.motivo);
  const detalhe = texto(p.corpo.detalhe, 300);
  const demoDia = texto(p.corpo.demo_dia, 60);
  const demoPeriodo = texto(p.corpo.demo_periodo, 30);
  const resumo = texto(p.corpo.resumo, 1500);
  const titulo = tarefaDoHandoff(motivo, detalhe, demoDia, demoPeriodo);
  const descricao = [resumo, detalhe && `Motivo: ${detalhe}`, 'Responder pelo Chatvolt (número 0573).'].filter(Boolean).join('\n');
  const pool = servicePool();

  await nota(n, userId, 'Bia (IA) passou para humano', descricao, { motivo, demo_dia: demoDia || null, demo_periodo: demoPeriodo || null, ia_pausada: pausada });
  // Lead que aceitou demo ou falou de preço/contratação é no mínimo quente (4), mesmo que a Bia não tenha mandado a nota.
  if (motivo === 'demo' || motivo === 'preco') {
    await pool.query(`update leads set qualification = greatest(coalesce(qualification, 0), 4) where id = $1`, [n.id]);
  }
  const etapa = motivo === 'cliente' ? null : await mover(n, userId, ETAPA_HUMANO, `Bia (IA) passou para humano: ${motivo}${detalhe ? `, ${detalhe}` : ''}`);

  // Tarefa para hoje, sem repetir uma aberta com o mesmo título.
  const { rows: abertas } = await pool.query(
    `select 1 from tasks where lead_id = $1 and title = $2 and completed_at is null limit 1`, [n.id, titulo]);
  if (!abertas.length) {
    await pool.query(
      `insert into tasks (organization_id, lead_id, assigned_to, title, description, task_type, due_date, priority)
       values ($1, $2, $3, $4, $5, 'follow_up', ((now() at time zone 'America/Sao_Paulo')::date + time '23:59') at time zone 'America/Sao_Paulo', 'high')`,
      [n.organization_id, n.id, userId, titulo, descricao]);
  }

  let userIds = n.assigned_to ? [n.assigned_to] : [];
  if (!userIds.length) {
    const { rows } = await pool.query<{ user_id: string }>(
      `select user_id from organization_members where organization_id = $1 and role in ('owner','admin')`, [n.organization_id]);
    userIds = rows.map((r) => r.user_id);
  }
  await notificar({ organizationId: n.organization_id, userIds, type: 'ai_update', title: `Bia passou ${n.name} para humano`, body: titulo, leadId: n.id })
    .catch((e) => console.error('[agente] notificar', e));

  return c.json({ ok: true, mensagem: `Equipe avisada no CRM.${fim}`, etapa } satisfies Resposta);
});
