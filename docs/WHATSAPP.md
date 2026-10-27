# Orquestrador WhatsApp → CRM

> Proposta aberta em 2026-10-27, revista no mesmo dia para **escala**.
> **Fase 1 (fundação) implementada em 2026-10-27** e testada no dev local com
> uma Evolution simulada; ainda não aplicada em produção (seção 11).
>
> Decisões do dono (2026-10-27): **fase muda sozinha** quando a IA tiver
> confiança alta; transcrição **no menor custo possível, fora da máquina
> local**; número desconhecido → **a IA decide se é lead**; ler conversas
> **privadas, enviadas e recebidas** (sem grupos nem status); **construir
> para escalar**; **a organização escolhe no front a LLM e o modelo**.
>
> "Escalar" aqui significa: várias organizações, cada uma com vários
> números; volume de milhares de mensagens/hora sem perder nenhuma; trocar
> de provedor (Evolution → API oficial da Meta, Groq → outro) sem reescrever
> o resto; saber quanto cada organização consome.

## 1. Princípios

1. **Receber ≠ processar.** O webhook só valida, grava e responde (< 100 ms).
   Todo o resto é job em fila. A Evolution nunca espera IA nem transcrição.
2. **Fila durável no Postgres** (`pg-boss`): retentativa com backoff, fila
   morta, agendamento, job único por chave. Sem infraestrutura nova — o plano
   do Easypanel já está no limite de projetos. A fila fica atrás de uma
   interface; se um dia o Postgres virar gargalo, troca-se por Redis/BullMQ
   sem mexer nos jobs.
3. **API e worker separados, mesma imagem.** `ROLE=api` (HTTP) e
   `ROLE=worker` (jobs). Escala-se o worker aumentando réplicas; os jobs são
   idempotentes e pegam trabalho com `SKIP LOCKED`.
4. **Provedores atrás de interfaces** (adapters): canal, transcrição, IA,
   armazenamento. O núcleo nunca importa "Evolution" ou "Groq".
5. **A organização escolhe a LLM e o modelo no front** (seção 6.1), com a
   própria chave. Nada de modelo fixo no código.
6. **A IA propõe, a política decide.** A saída da IA vira `proposed_actions`;
   uma política por organização decide o que aplica sozinho. Hoje: tudo
   automático acima do limiar. Amanhã, outro cliente pode querer "só
   sugerir" — é configuração, não código.
7. **Tudo auditável e reversível.** Cada ação aplicada guarda o antes, o
   depois, a análise e as mensagens de origem; dá para desfazer.
8. **Idempotência em cada passo.** Mensagem única por
   `(connection_id, provider_message_id)`; análise única por
   `(chat_id, até_mensagem)`; aplicar duas vezes não duplica nada.

## 2. Arquitetura

```
             ┌──────────── Evolution A ───┐  ┌── Evolution B (futuro) ──┐  ┌─ Meta Cloud API (futuro) ─┐
             │ instâncias = números       │  │                          │  │                           │
             └──────────────┬─────────────┘  └────────────┬─────────────┘  └─────────────┬─────────────┘
                            │ webhook por conexão (token próprio)                        │
                            ▼                                                            ▼
 crm-app (ROLE=api)   POST /api/channels/:provider/:connectionToken
   ├─ valida token/assinatura → normaliza (adapter) → INSERT messages ON CONFLICT DO NOTHING
   └─ enfileira: media.fetch (se mídia) + chat.touch
                            │
                            ▼                       Postgres (pg-boss: schema pgboss)
 crm-worker (ROLE=worker, N réplicas)
   media.fetch     baixa mídia pelo adapter → storage → enfileira media.transcribe / media.describe
   media.transcribe  Transcriber (Groq → fallback) → grava transcrição
   chat.touch      (re)agenda chat.analyze com singletonKey = chat_id, startAfter = 3 min
   chat.analyze    lock por conversa → identifica lead → monta contexto → IA → proposed_actions
   actions.apply   política da organização → aplica → atividade/notificação/webhook da etapa
   connection.health (cron) status das instâncias; alerta quando cai
   maintenance     (cron) retenção de mídia/payload bruto, partições novas
```

**Debounce por conversa:** cada mensagem nova empurra o `chat.analyze`
daquela conversa para 3 min à frente (job único por `chat_id`). Um lote de
20 mensagens vira **uma** chamada de IA. Teto: se a conversa não para, analisa
no máximo a cada 15 min.

**Serialização por conversa:** duas análises da mesma conversa nunca rodam
juntas (advisory lock por `chat_id`), mesmo com vários workers. Conversas
diferentes rodam em paralelo.

**Backpressure:** cada provedor tem limite de taxa próprio (Groq grátis:
20 req/min). O job que bate no limite volta para a fila com atraso, em vez
de falhar. Áudio espera; texto segue — a análise espera as transcrições do
lote (com prazo: após 10 min, analisa sem o áudio e marca isso).

## 3. Interfaces (adapters)

```ts
interface ChannelProvider {            // evolution.ts hoje; meta-cloud.ts depois
  parseWebhook(req): NormalizedEvent[];          // mensagens, status, conexão
  fetchMedia(conn, msg): Promise<MediaBlob>;
  connect(conn): Promise<{ qrCode?: string }>;   // QR / pareamento
  status(conn): Promise<ConnectionStatus>;
  registerWebhook(conn, url): Promise<void>;
}
interface Transcriber { transcribe(audio, lang): Promise<{ text; seconds; cost }> }
interface LlmProvider {                 // anthropic, openai, google, openai-compatible
  listModels(cred): Promise<ModelInfo[]>;      // id, nome, visão?, saída estruturada?, contexto, preço
  analyze(cred, model, ctx): Promise<{ decision; usage }>;
}
interface MediaStore  { put; getSignedUrl; delete }   // disco local → S3/R2/MinIO
```

LLM: **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`, `@ai-sdk/openai`,
`@ai-sdk/google`, `@ai-sdk/openai-compatible`). Uma chamada só
(`generateObject` com o schema zod) funciona em todos, com imagem e saída
estruturada. O `openai-compatible` cobre OpenRouter, Groq, DeepSeek e um
Ollama na VPS só com URL base + chave.

Transcrição em cadeia, por custo: **Groq `whisper-large-v3-turbo` grátis**
(~8 h de áudio/dia, segundo fontes de terceiros — conferir no console) →
Groq pago (~US$0,04/h) ou Whisper na VPS, quando o grátis estourar. A ordem é
configuração.

## 4. Banco (`db/60_canais.sql` na Fase 1; as demais tabelas vêm nas fases seguintes)

| Tabela | Para quê |
| --- | --- |
| `channel_servers` | Servidores de provedor (URL, chave cifrada). Permite várias Evolution. |
| `channel_connections` | Um número de uma organização: servidor, instância, token do webhook, usuário ator, funil de entrada, status, ativo. N por organização. |
| `ai_credentials` | Chaves de LLM/transcrição da organização: provedor, URL base (compatível com OpenAI), chave **cifrada**, apelido, últimos 4 dígitos, status do último teste. N por organização. |
| `ai_model_catalog` | Cache da lista de modelos de cada credencial (`listModels`) com capacidades (visão, saída estruturada, contexto) e preço por milhão de tokens — preço editável quando o provedor não informa. Atualizado ao salvar a chave e 1×/dia. |
| `org_ai_settings` | Modelo escolhido por tarefa (`analysis`, `vision` opcional, `fallback` opcional) e transcrição (`credential_id` + modelo), cada um apontando para uma credencial. Política por organização: autonomia (`auto`/`suggest`), limiares de fase, criar lead de desconhecido, funil padrão, transcrição ligada, cota mensal. |
| `channel_chats` | Conversa: conexão, `remote_jid`, telefone normalizado, `push_name`, `lead_id`, `contact_id`, `status` (`pending`/`linked`/`unmatched`/`ignored`), `last_message_at`, `analyzed_until`. |
| `channel_messages` | **Particionada por mês** (`sent_at`). Direção, tipo, texto, `media_key`, transcrição, `raw` (retido 30 dias). |
| `analyses` | Entrada resumida, saída da IA, modelo, tokens, custo, duração, erro. |
| `proposed_actions` | Tipo (`note`/`stage_change`/`task`/`field_update`/`create_lead`), payload, confiança, estado (`applied`/`pending`/`rejected`/`reverted`), antes/depois. |
| `usage_events` | Medição por organização: áudio-segundos, tokens, mensagens. Base para cota e cobrança. |

- Segredos (chaves da Evolution) cifrados pelo app com AES-256-GCM
  (`server/canais/cifra.ts`); a chave mestra (`CHANNEL_SECRET_KEY`) só no
  `secrets.env` — o banco sozinho não abre nada. Nunca expostos ao PostgREST.
- RLS no padrão do projeto (membro da organização lê; escrita só pelo
  `service_role`). Tudo com `organization_id`.
- `validate_activity_type` passa a aceitar `whatsapp`.
- Retenção: mídia 90 dias, `raw` 30 dias, transcrição e texto enquanto o
  negócio existir (configurável — LGPD).

## 5. Identificação do lead

1. **Telefone**: dígitos do JID com as variantes brasileiras (com/sem `55`,
   com/sem 9º dígito) contra `contacts.phone_digits` — coluna gerada nova,
   indexada (hoje o CRM compara com `regexp_replace` linha a linha, o que não
   escala). `@lid`: usa `remoteJidAlt`/`senderPn` (Evolution v2.3+).
2. **Nome**: `push_name` contra contatos (sem acento); só com um candidato.
3. **Contato → negócios abertos**: o de atividade mais recente; a IA pode
   escolher outro se a conversa citar.
4. **Sem match**: a IA classifica. Comercial → `create_lead` pelo caminho do
   AGENTS.md (`resolve_company_contact`, `company_id` + `lead_contacts`, nome
   fantasia `placeholder`). Não comercial → `ignored` (não reavalia sempre;
   reavalia se a conversa mudar de tom, no máximo 1×/dia).
5. Vínculo gravado em `chats`: as próximas mensagens não refazem a busca.

## 6. Decisão da IA

Modelo escolhido pela organização (6.1), por lote, saída estruturada
validada com zod. Prompt de sistema por organização (etapas do funil com
descrição, regras), com cache de prompt onde o provedor tiver. Imagens entram
como visão só quando o lote tem imagem; se o modelo de análise não tiver
visão, usa o modelo de `vision` para descrever a imagem antes.

```jsonc
{
  "is_commercial": true,
  "lead_id": "…",
  "summary": "Pediu orçamento de 3 licenças; mandou print do sistema atual.",
  "actions": [
    { "type": "stage_change", "to_stage_id": "…", "confidence": 0.86, "reason": "Aceitou a proposta" },
    { "type": "task", "title": "Enviar contrato", "due_in_days": 1 },
    { "type": "field_update", "field": "value", "value": 4500, "confidence": 0.9 }
  ]
}
```

Política padrão (decisão do dono: automático): fase ≥ 0,8 só no mesmo funil,
voltar etapa ≥ 0,9, nunca arquivar sozinho. A mudança de fase segue o mesmo
caminho do Kanban — **dispara o webhook da etapa** (Softeo etc. passam a ser
acionados pela IA).

### 6.1 Escolha de LLM e modelo (front)

Configurações → **Inteligência artificial** (só owner/admin):

1. **Conectar provedor**: Anthropic, OpenAI, Google Gemini ou "compatível
   com OpenAI" (URL base: OpenRouter, Groq, DeepSeek, Ollama na VPS…) +
   chave. O servidor testa (lista os modelos) antes de salvar.
2. **Escolher o modelo** de cada tarefa num seletor com os modelos que a
   chave enxerga, mostrando: visão sim/não, contexto, preço estimado por
   1.000 mensagens. Modelos sem saída estruturada ficam desabilitados para
   análise.
3. **Fallback** opcional: outro modelo (até de outro provedor) quando o
   principal falha ou estoura limite.
4. **Transcrição**: mesmo esquema (Groq grátis como padrão sugerido; OpenAI;
   compatível com OpenAI).
5. **Testar**: botão que roda a análise numa conversa de exemplo e mostra a
   decisão, os tokens e o custo — antes de ligar.

Regras:
- A chave **nunca volta ao front**: depois de salva, aparece só o apelido e
  os últimos 4 dígitos. Trocar = colar outra. Cifrada no banco
  (AES-256-GCM no app, chave mestra no `secrets.env`), lida só pelo worker.
- Trocar de modelo vale para as próximas análises; cada análise grava o
  provedor e o modelo usados (comparar qualidade e custo depois).
- Sem credencial configurada, o orquestrador grava as mensagens mas não
  analisa, e o painel avisa.
- Cada organização paga a própria IA (chave própria). Chave da plataforma com
  repasse fica para depois, se for virar produto.

## 7. Operação e observabilidade

- Painel por organização: conexões e status, fila (pendentes/falhas),
  últimas análises, consumo do mês vs. cota.
- Alertas (central + push): número desconectado, fila morta crescendo, cota
  perto do fim.
- Logs estruturados com `organization_id`, `connection_id`, `chat_id`,
  `job_id`.
- Backfill opcional: importar o histórico de uma conversa ao vincular
  (`findMessages` da Evolution), em fila de baixa prioridade.

## 8. Código

```
server/
  index.ts            ROLE=api → HTTP; ROLE=worker → server/worker.ts
  worker.ts           registra os handlers do pg-boss
  canais/
    nucleo/           tipos normalizados, fila, política, aplicação de ações
    provedores/       evolution.ts (meta-cloud.ts depois)
    transcricao/      groq.ts, cadeia.ts
    ia/               provedores (AI SDK), catalogo-modelos.ts, prompt.ts, schema.ts, cifra.ts
    identificacao/    telefone.ts (variantes BR), lead.ts
    jobs/             media-fetch, media-transcribe, chat-touch, chat-analyze, actions-apply, health, maintenance
```

## 9. Fases

1. **Fundação** — schema, pg-boss, `ROLE=worker`, adapter Evolution,
   webhook de entrada, `phone_digits`, tela de conexão (QR). *Pronto quando*:
   mensagens de 2 números chegam, sem duplicar, e aparecem vinculadas.
2. **Mídia** — download, storage, transcrição em cadeia, limites de taxa.
3. **Inteligência** — credenciais e escolha de LLM/modelo no front (6.1),
   análise, ações propostas, política, aplicação, desfazer, notificações.
4. **Telas** — aba WhatsApp no negócio, painel de operação e consumo.
5. **Escala** — partições automáticas, storage externo (R2/S3), segunda
   Evolution, cotas por organização, teste de carga (ex.: 10 mil msgs/h).

## 10. O dono fornece

- URL interna e chave global da Evolution; nome da instância do número.
- Uma chave de LLM para testar (qualquer provedor da 6.1) e a da Groq
  (gratuita) — cadastradas por você mesmo na tela, não por mim.
- Organização e funil onde os negócios novos entram.
- Storage de mídia: disco da VPS no começo, ou já um bucket (R2 é o mais
  barato para isso).

## 11. Fase 1 — o que existe e como pôr no ar

Feito:
- `db/60_canais.sql`: `channel_servers`, `channel_connections`,
  `channel_chats`, `channel_messages` (partições mensais + `default`),
  `phone_match_key()` e `contacts.phone_key` (indexado), tipo de atividade
  `whatsapp`, RLS (membros leem; token do webhook e chave nunca legíveis pelo
  navegador; escrita pelo servidor).
- Fila `pg-boss` (`server/canais/fila.ts`) e `ROLE=all|api|worker`
  (`server/index.ts`, `server/worker.ts`; dev: `bun run dev:worker`).
- Adapter Evolution (`server/canais/provedores/evolution.ts`), webhook
  `POST /api/channels/evolution/:token` (grava sem duplicar, ignora grupos e
  status) e vínculo por telefone (com/sem 55 e 9º dígito, `@lid` pelo
  telefone alternativo) ou por nome completo único.
- Configurações → WhatsApp: conectar número (QR) ou usar instância que já
  existe, status, pausar, atualizar, remover; conversas recentes com o vínculo.
- Testes: unitários (`server/canais/canais.test.ts`), chave de telefone
  TS × SQL igual em 689 telefones reais, e ponta a ponta com Evolution falsa
  (duplicata, grupo, sem 9º dígito, `@lid` por nome, desconhecido, conexão
  aberta pelo evento, instância existente, RLS entre organizações).

Para ir à produção (nesta ordem):
1. Aplicar `db/60_canais.sql` no banco de produção (`scripts/tunel-db.sh`).
2. No `secrets.env` do `crm-app`: `CHANNEL_SECRET_KEY` (openssl rand -hex 32),
   `EVOLUTION_URL` (interna, ex.: `http://evolution-api:8080`),
   `EVOLUTION_API_KEY` (global), `CHANNEL_WEBHOOK_BASE_URL=http://crm-app:3000`.
3. Deploy (`scripts/deploy.sh`). Um container (`ROLE=all`) basta para começar;
   escalar = um serviço `crm-worker` com a mesma imagem e `ROLE=worker`, e o
   `crm-app` com `ROLE=api`.
4. Configurações → WhatsApp → "Usar instância que já existe" com o nome da
   instância do seu número.
