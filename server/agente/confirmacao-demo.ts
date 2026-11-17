import { servicePool } from '../db.js';
import { primeiroNome, telefoneParaEnvio } from '../canais/boas-vindas.js';
import { credencialChatvolt, postarTemplate, type CredencialChatvolt, type Envio } from '../canais/chatvolt-template.js';

// Confirmação da demo 3 h antes (docs/ORBI.md, "Confirmação 3 h antes").
// A cada 5 min o worker procura demos marcadas no Orbi (tarefa Reunião
// 'accepted') que começam em até ANTECEDENCIA_H horas e manda ao lead o
// template do WhatsApp (API oficial, número 0573) pelo Chatvolt:
//   POST /whatsapp/<phoneNumberId>/template-message  (docs.chatvolt.ai)
// O template tem {{1}} = primeiro nome, {{2}} = hora (HH:mm) e um botão de URL
// cujo sufixo é o código do Meet (https://meet.google.com/{{1}}).
// Uma vez por tarefa (demo_confirmations) e sem nova tentativa automática.

/** Quanto antes da demo a confirmação sai. */
export const ANTECEDENCIA_H = 3;
/** Demo que começa em menos que isso não recebe (a mensagem chegaria em cima da hora). */
export const MINIMO_MIN = 15;
const FUSO = 'America/Sao_Paulo';

export interface ConfirmacaoConfig extends CredencialChatvolt {
  org: string;
  template: string;
}

/** Desligada (null) até CONFIRMACAO_DEMO_ATIVA=1 e as variáveis do Chatvolt estarem no ambiente. */
export function configuracao(env: NodeJS.ProcessEnv = process.env): ConfirmacaoConfig | null {
  if (env.CONFIRMACAO_DEMO_ATIVA !== '1') return null;
  const cred = credencialChatvolt(env);
  const org = env.CHATVOLT_AGENTE_ORG ?? '';
  if (!cred || !org) return null;
  return { ...cred, org, template: env.CONFIRMACAO_DEMO_TEMPLATE || 'oni_confirmacao_demo_v3' };
}

/** Código do Meet de `https://meet.google.com/abc-defg-hij` (o sufixo que o botão do template recebe). */
export function codigoDoMeet(url: string | null | undefined): string | null {
  const m = /^https:\/\/meet\.google\.com\/([a-z0-9-]{3,40})(?:[/?#].*)?$/i.exec((url ?? '').trim());
  return m ? m[1] : null;
}

/** "14:00", no fuso de São Paulo. */
export function horaDaDemo(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });
}

/** O texto do template já preenchido: o Chatvolt guarda na conversa (campo `text`). */
export function textoDaConfirmacao(nome: string, hora: string): string {
  return `Olá, ${nome}!\n\nAqui é o Vinicius da Oniplataforma!\nPassando para confirmar a demonstração às ${hora}.\n\nO link da reunião está no botão abaixo!`;
}

export interface DadosDoEnvio {
  telefone: string;
  nome: string | null;
  hora: string;
  codigoMeet: string;
  contato?: string | null;
}

/** Corpo do POST do Chatvolt: `var_1`/`var_2` viram {{1}}/{{2}}; o botão (índice 0) recebe o código do Meet. */
export function corpoDoTemplate(cfg: ConfirmacaoConfig, d: DadosDoEnvio) {
  // {{1}} não pode ficar vazio: sem nome que pareça nome de gente, "Olá, tudo bem!".
  const nome = d.nome ?? 'tudo bem';
  return {
    to: d.telefone,
    text: textoDaConfirmacao(nome, d.hora),
    agentId: cfg.agentId,
    templateName: cfg.template,
    templateLangCode: 'pt_BR',
    var_1: nome,
    var_2: d.hora,
    buttons: [{ type: 'url', value: d.codigoMeet, index: '0' }],
    ...(d.contato ? { contactName: d.contato } : {}),
  };
}

export function enviarTemplate(cfg: ConfirmacaoConfig, d: DadosDoEnvio, fetchImpl: typeof fetch = fetch): Promise<Envio> {
  return postarTemplate(cfg, corpoDoTemplate(cfg, d), fetchImpl);
}

interface Candidata {
  id: string;
  organization_id: string;
  lead_id: string;
  assigned_to: string;
  due_date: Date;
  meeting_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}

/** Demos aceitas no Orbi que começam em até ANTECEDENCIA_H h, sem linha em demo_confirmations. */
async function candidatas(org: string): Promise<Candidata[]> {
  const { rows } = await servicePool().query<Candidata>(
    `select t.id, t.organization_id, t.lead_id, t.assigned_to, t.due_date, t.meeting_url, c.name as contact_name, c.phone as contact_phone
       from tasks t
       join leads l on l.id = t.lead_id
       left join task_subtypes st on st.id = t.task_subtype_id
       left join lateral (
         select c.* from lead_contacts lc join contacts c on c.id = lc.contact_id
          where lc.lead_id = l.id and c.phone_key is not null order by lc.is_primary desc, lc.created_at limit 1
       ) c on true
      where t.organization_id = $1 and t.task_type = 'meeting' and t.external_status = 'accepted'
        and (st.label ilike '%demonstra%' or t.title ilike '%demo%')
        and t.due_date > now() and t.due_date <= now() + make_interval(hours => $2)
        and l.status = 'open' and l.archived_at is null and l.merged_into_lead_id is null
        and not exists (select 1 from demo_confirmations d where d.task_id = t.id)
      order by t.due_date limit 20`, [org, ANTECEDENCIA_H]);
  return rows;
}

/** Reserva a tarefa (a trava) e devolve false se outro worker já a pegou. */
async function reservar(t: Candidata, status: 'sending' | 'skipped', template: string, reason?: string): Promise<boolean> {
  const { rowCount } = await servicePool().query(
    `insert into demo_confirmations (task_id, organization_id, lead_id, status, reason, template) values ($1, $2, $3, $4, $5, $6)
     on conflict (task_id) do nothing`, [t.id, t.organization_id, t.lead_id, status, reason ?? null, template]);
  return !!rowCount;
}

async function fechar(t: Candidata, envio: Envio, d: DadosDoEnvio, template: string) {
  const pool = servicePool();
  await pool.query(
    `update demo_confirmations set status = $2, reason = $3, provider_message_id = $4, provider_conversation_id = $5, updated_at = now()
      where task_id = $1`,
    [t.id, envio.ok ? 'sent' : 'failed', envio.ok ? null : envio.motivo, envio.ok ? envio.messageId : null, envio.ok ? envio.conversationId : null]);
  if (!envio.ok) {
    console.error(`[agente] confirmação da demo ${t.id}: ${envio.motivo}`);
    return;
  }
  await pool.query(
    `insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
     values ($1, $2, $3, 'note', 'Confirmação da demo enviada no WhatsApp', $4, $5)`,
    [t.organization_id, t.lead_id, t.assigned_to,
      `Mensagem automática (${template}) para ${d.nome ?? 'o lead'} confirmando a demo às ${d.hora}, com o link da chamada.`,
      { origem: 'confirmacao_demo', task_id: t.id, template, provider_message_id: envio.messageId }]);
}

/** Um ciclo do job: devolve quantas confirmações foram enviadas. */
export async function confirmarDemos(fetchImpl: typeof fetch = fetch, agora: () => number = Date.now): Promise<number> {
  const cfg = configuracao();
  if (!cfg) return 0;
  let enviadas = 0;
  for (const t of await candidatas(cfg.org)) {
    const telefone = telefoneParaEnvio(t.contact_phone);
    const codigoMeet = codigoDoMeet(t.meeting_url);
    const faltam = (new Date(t.due_date).getTime() - agora()) / 60_000;
    const motivo = !telefone ? 'sem_telefone' : !codigoMeet ? 'sem_link' : faltam < MINIMO_MIN ? 'tarde_demais' : null;
    if (motivo || !telefone || !codigoMeet) {
      await reservar(t, 'skipped', cfg.template, motivo ?? 'sem_dados');
      continue;
    }
    if (!(await reservar(t, 'sending', cfg.template))) continue;
    const dados: DadosDoEnvio = {
      telefone, codigoMeet, nome: primeiroNome(t.contact_name), hora: horaDaDemo(new Date(t.due_date)), contato: t.contact_name,
    };
    const envio = await enviarTemplate(cfg, dados, fetchImpl);
    await fechar(t, envio, dados, cfg.template);
    if (envio.ok) enviadas++;
  }
  return enviadas;
}
