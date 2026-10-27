import { servicePool } from '../../db.js';
import { armazenamento } from '../../canais/midia/armazenamento.js';
import { provedor } from '../../canais/provedores/index.js';
import { servidor } from '../../canais/servidores.js';
import { credencial, type Credencial } from '../credenciais.js';
import { provedorLlm } from '../llm/index.js';
import { RecusaDoModelo, type Imagem } from '../llm/tipos.js';
import { aplicarDecisao, type Acao, type Politica } from './aplicar.js';
import { conversa, mensagens, negociosCandidatos, type ConversaCtx, type MensagemCtx } from './contexto.js';
import { Decisao } from './decisao.js';
import { promptDeSistema, promptDoUsuario } from './prompt.js';

// Job canais.chat.analisar: um lote de mensagens de uma conversa → uma chamada
// de IA → ações. Um por conversa de cada vez (fila "stately" por chat).

const MAX_NOVAS = 80;
const MAX_ANTERIORES = 15;
const MAX_IMAGENS = 4;
const MAX_BYTES_IMAGEM = 5 * 1024 * 1024;
/** Áudio do lote ainda sem transcrição: espera até isso antes de analisar sem ele. */
const ESPERA_TRANSCRICAO_MS = 10 * 60_000;

interface Ajustes extends Politica {
  analysis_enabled: boolean;
  analysis_credential_id: string | null;
  analysis_model: string | null;
  analysis_fallback_credential_id: string | null;
  analysis_fallback_model: string | null;
  instructions: string | null;
}

export type ResultadoAnalise =
  | { status: 'skipped'; motivo: string; reagendarEm?: number }
  | { status: 'error'; erro: string; analysisId: string | null }
  | { status: 'done'; analysisId: string | null; decisao: Decisao; acoes: Acao[]; modelo: string; provedor: string; tokensEntrada: number | null; tokensSaida: number | null; mensagens: number };

async function ajustes(orgId: string): Promise<Ajustes | null> {
  const { rows } = await servicePool().query<Ajustes>(`select * from org_ai_settings where organization_id = $1`, [orgId]);
  const a = rows[0];
  return a ? { ...a, stage_min_confidence: Number(a.stage_min_confidence), stage_back_min_confidence: Number(a.stage_back_min_confidence) } : null;
}

async function imagensDoLote(chat: ConversaCtx, novas: MensagemCtx[]): Promise<{ imagens: Imagem[]; numeros: Map<string, number> }> {
  const imagens: Imagem[] = [];
  const numeros = new Map<string, number>();
  for (const m of novas.filter((x) => x.message_type === 'image').slice(-MAX_IMAGENS)) {
    try {
      const key = typeof m.media?.key === 'string' ? m.media.key : null;
      const guardada = key ? await armazenamento()?.get(key) : null;
      const midia = guardada
        ? { data: guardada, mimetype: String(m.media?.stored_mimetype ?? 'image/jpeg') }
        : await provedor(chat.provider).fetchMedia(await servidor(chat.server_id), chat.instance_name, m.raw);
      if (midia.data.length > MAX_BYTES_IMAGEM || !/^image\/(jpeg|png|webp|gif)/.test(midia.mimetype)) continue;
      imagens.push({ mimetype: midia.mimetype.split(';')[0], base64: midia.data.toString('base64') });
      numeros.set(m.id, imagens.length);
    } catch (e) {
      // Sem a imagem, a IA ainda vê a legenda; não vale travar a análise.
      console.warn('[ia] imagem não baixada', m.id, (e as Error).message);
    }
  }
  return { imagens, numeros };
}

/**
 * Pede com as imagens; se o provedor recusar com 4xx (fora chave, permissão e
 * limite), quase sempre é modelo que não lê imagem (ex.: gpt-oss na Groq):
 * tenta de novo só com o texto, onde a legenda da imagem continua.
 */
export async function comOuSemImagens<R>(pedir: (comImagens: boolean) => Promise<R>, temImagens: boolean, rotulo: string): Promise<R> {
  try {
    return await pedir(temImagens);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (!temImagens || status === undefined || status < 400 || status >= 500 || [401, 403, 429].includes(status)) throw e;
    console.warn('[ia] modelo recusou imagem; analisando só o texto', rotulo);
    return pedir(false);
  }
}

const erroTemporario = (e: unknown) => {
  const status = (e as { status?: number }).status;
  return status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
};

export async function analisarConversa(chatId: string, opts: { dryRun?: boolean } = {}): Promise<ResultadoAnalise> {
  const dryRun = !!opts.dryRun;
  const chat = await conversa(chatId);
  if (!chat) return { status: 'skipped', motivo: 'Conversa não existe' };
  const aj = await ajustes(chat.organization_id);
  if (!aj?.analysis_enabled && !dryRun) return { status: 'skipped', motivo: 'Análise desligada' };
  const opcoes = [
    [aj?.analysis_credential_id, aj?.analysis_model],
    [aj?.analysis_fallback_credential_id, aj?.analysis_fallback_model],
  ].filter((o): o is [string, string] => !!o[0] && !!o[1]);
  if (!aj || !opcoes.length) return { status: 'skipped', motivo: 'Nenhum modelo de análise escolhido' };

  const { novas, anteriores } = await mensagens(chat, { maxNovas: MAX_NOVAS, maxAnteriores: MAX_ANTERIORES, tudo: dryRun });
  if (!novas.length) {
    if (!dryRun) await servicePool().query(`update channel_chats set pending_since = null where id = $1`, [chat.id]);
    return { status: 'skipped', motivo: 'Nenhuma mensagem nova' };
  }
  // Espera os áudios do lote virarem texto (com prazo).
  const audioPendente = novas.some((m) => m.message_type === 'audio' && !m.transcript && !m.media?.transcript_status
    && Date.now() - new Date(m.created_at).getTime() < ESPERA_TRANSCRICAO_MS);
  if (audioPendente && !dryRun) return { status: 'skipped', motivo: 'Aguardando transcrição', reagendarEm: 30 };

  const candidatos = await negociosCandidatos(chat);
  const { imagens, numeros } = await imagensDoLote(chat, novas);
  const sistema = promptDeSistema(chat.org_name, aj.instructions);
  const usuario = promptDoUsuario(chat, candidatos, anteriores, novas, numeros);
  // Para modelo que não lê imagem (ex.: gpt-oss na Groq): só a legenda.
  const usuarioSemImagem = imagens.length ? promptDoUsuario(chat, candidatos, anteriores, novas, new Map()) : usuario;
  const entrada = {
    mensagens: novas.length, de: novas[0].sent_at, ate: novas[novas.length - 1].sent_at,
    candidatos: candidatos.map((c) => c.id), imagens: imagens.length, prompt_chars: sistema.length + usuario.length,
  };

  const inicio = Date.now();
  const pool = servicePool();
  let ultimoErro: unknown = null;
  for (const [credId, modelo] of opcoes) {
    let cred: Credencial;
    try {
      cred = await credencial(credId);
    } catch (e) {
      ultimoErro = e;
      continue;
    }
    try {
      const pedir = (comImagens: boolean) => provedorLlm(cred.provider).analisar(cred, modelo, {
        sistema, usuario: comImagens ? usuario : usuarioSemImagem, imagens: comImagens ? imagens : [], schema: Decisao, nomeSchema: 'decisao_crm',
      });
      const r = await comOuSemImagens(pedir, imagens.length > 0, `${cred.provider} ${modelo}`);
      const { rows } = dryRun ? { rows: [] as { id: string }[] } : await pool.query<{ id: string }>(
        `insert into ai_analyses (organization_id, chat_id, lead_id, provider, model, status, input, output, input_tokens, output_tokens, duration_ms)
         values ($1, $2, $3, $4, $5, 'done', $6, $7, $8, $9, $10) returning id`,
        [chat.organization_id, chat.id, r.objeto.lead_id ?? candidatos[0]?.id ?? null, cred.provider, r.modelo, entrada, r.objeto,
          r.tokensEntrada, r.tokensSaida, Date.now() - inicio]);
      const analysisId = rows[0]?.id ?? null;

      const acoes = await aplicarDecisao({ decisao: r.objeto, politica: aj, chat, candidatos, analysisId, mensagens: novas.length, dryRun });

      if (!dryRun) {
        for (const a of acoes) {
          await pool.query(
            `insert into ai_actions (organization_id, analysis_id, lead_id, type, payload, confidence, state, reason, before, after, applied_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, case when $7 = 'applied' then now() end)`,
            [chat.organization_id, analysisId, a.lead_id, a.type, a.payload, a.confidence, a.state, a.reason,
              a.before === undefined ? null : JSON.stringify(a.before), a.after === undefined ? null : JSON.stringify(a.after)]);
        }
        const ate = novas[novas.length - 1].sent_at;
        // Chegou mensagem durante a análise: pending_since fica e o agendamento continua.
        await pool.query(
          `update channel_chats set analyzed_until = $2, last_analysis_at = now(),
             pending_since = case when exists (select 1 from channel_messages where chat_id = $1 and sent_at > $2) then pending_since end
           where id = $1`, [chat.id, ate]);
        await pool.query(
          `insert into usage_events (organization_id, kind, quantity, provider, model, ref_id)
           select $1, k, q, $3, $4, $5 from (values ('llm_input_tokens', $2::numeric), ('llm_output_tokens', $6::numeric)) v(k, q) where q > 0`,
          [chat.organization_id, r.tokensEntrada ?? 0, cred.provider, r.modelo, analysisId, r.tokensSaida ?? 0]);
      }
      return { status: 'done', analysisId, decisao: r.objeto, acoes, modelo: r.modelo, provedor: cred.provider, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, mensagens: novas.length };
    } catch (e) {
      ultimoErro = e;
      // Limite/instabilidade do provedor: tenta a reserva. Recusa ou erro de
      // configuração (modelo inexistente, chave): também tenta a reserva.
      console.warn('[ia] análise falhou', cred.provider, modelo, (e as Error).message);
    }
  }

  const msg = (ultimoErro as Error)?.message ?? 'Falha na análise';
  let analysisId: string | null = null;
  if (!dryRun) {
    const { rows } = await pool.query<{ id: string }>(
      `insert into ai_analyses (organization_id, chat_id, lead_id, status, input, error, duration_ms)
       values ($1, $2, $3, 'error', $4, $5, $6) returning id`,
      [chat.organization_id, chat.id, candidatos[0]?.id ?? null, entrada, msg.slice(0, 1000), Date.now() - inicio]);
    analysisId = rows[0].id;
  }
  // Temporário: o job volta para a fila. Recusa/configuração: o lote fica
  // pendente e é reavaliado na próxima mensagem (sem loop de tentativas).
  if (!dryRun && erroTemporario(ultimoErro) && !(ultimoErro instanceof RecusaDoModelo)) throw ultimoErro;
  return { status: 'error', erro: msg, analysisId };
}
