# Orquestrador WhatsApp → CRM

> Proposta aberta em 2026-10-27, revista no mesmo dia para **escala**.
> **Fase 1 (fundação) em produção desde 2026-10-27** (instância Oniplataforma,
> organização Oniplataforma). **Fase 2 (mídia e transcrição) implementada em
> 2026-10-27** — seção 12. **Fase 3 (inteligência) implementada em
> 2026-10-27** — seção 13. Fases 2 e 3 no ar em produção no mesmo dia
> (commits `1873d4d`, `68f3400`, `b783472`, `78eabf3`).
>
> **Suporte:** o que está rodando e onde — seção 14; como diagnosticar —
> seção 15; mudanças de dados feitas na Oniplataforma — seção 16.
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

LLM (`server/ia/llm/`): um adaptador por API — Anthropic pelo SDK oficial
(`@anthropic-ai/sdk`, saída estruturada + cache do prompt de sistema),
OpenAI/Groq/compatíveis por `/chat/completions` com `json_schema` (cai para
`json_object` quando o modelo não aceita), Google por `generateContent` com
`responseJsonSchema`. Todos devolvem o mesmo objeto, validado pelo mesmo
schema zod (`server/ia/analise/decisao.ts`).

Transcrição em cadeia, por custo: **Groq `whisper-large-v3-turbo` grátis**
(~8 h de áudio/dia, segundo fontes de terceiros — conferir no console) →
Groq pago (~US$0,04/h) ou Whisper na VPS, quando o grátis estourar. A ordem é
configuração.

## 4. Banco (`db/60_canais.sql`, `db/61_ia.sql`, `db/62_ia_analise.sql`)

Como ficou implementado (a proposta original tinha `analyses`,
`proposed_actions` e `ai_model_catalog`; viraram `ai_analyses`,
`ai_actions`, e o catálogo ficou para a Fase 4 — a lista de modelos vem ao
vivo da chave).

| Tabela | Arquivo | Para quê |
| --- | --- | --- |
| `channel_servers` | 60 | Servidores de provedor (URL, chave cifrada). A Evolution da plataforma vem das variáveis de ambiente, sem linha aqui (`server/canais/servidores.ts`). |
| `channel_connections` | 60 | Um número de uma organização: instância, `webhook_token` (nunca legível pelo navegador), usuário ator (`actor_user_id`), funil de entrada (`funnel_id`), `status` (`pending`/`qr`/`connected`/`disconnected`/`error`), `status_detail`, `last_event_at`, `is_active`. |
| `channel_chats` | 60 | Conversa: `remote_jid`, `phone_digits`, `phone_key` (gerada), `push_name`, `contact_id`, `lead_id`, `status` (`pending`/`linked`/`unmatched`/`ignored`), `matched_by`, `analyzed_until`, `pending_since`, `last_analysis_at` (62). |
| `channel_messages` | 60 | **Particionada por mês** (`sent_at`) + partição `default`. `provider_message_id` (único por conexão), `from_me`, `message_type`, `body`, `media` (jsonb: chave no disco, `transcript_status`, segundos…), `transcript`, `raw` (30 dias). |
| `ai_credentials` | 61 | Chaves de IA/transcrição: provedor, URL base, chave **cifrada** (`api_key_enc`), `key_last4`. Só owner/admin leem, e sem a chave. |
| `org_ai_settings` | 61/62 | Transcrição (ligada, credencial+modelo, reserva, idioma) e análise (ligada, credencial+modelo, reserva, `autonomy`, `stage_min_confidence`, `stage_back_min_confidence`, `create_leads`, `instructions`). Uma linha por organização. |
| `usage_events` | 61 | Consumo: `audio_seconds`, `llm_input_tokens`, `llm_output_tokens`, com provedor e modelo. |
| `ai_analyses` | 62 | Cada chamada de IA: entrada resumida, decisão (`output`), modelo, tokens, duração, `status` (`done`/`error`/`skipped`), `error`. |
| `ai_actions` | 62 | Cada ação decidida: `type` (`note`/`stage_change`/`task`/`field_update`/`create_lead`/`classify`), `payload`, `confidence`, `state` (`applied`/`pending`/`skipped`/`rejected`/`reverted`), `reason`, `before`/`after`. |

Funções: `phone_match_key(text)` (chave do telefone: sem 55 e sem o 9º
dígito → DDD + 8 dígitos; usada em `contacts.phone_key` e
`channel_chats.phone_key`, indexadas) e `ensure_channel_message_partitions(n)`
(cria as partições dos próximos n meses; roda no job diário).

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

Como ficou:

```
server/
  index.ts              ROLE=all|api|worker (padrão all: HTTP + jobs no mesmo container)
  app.ts                rotas /api/channels (canais/api.ts) e /api/ai (ia/api.ts)
  worker.ts             handlers do pg-boss + crons (manutenção 03:15, saúde das conexões a cada 5 min)
  acesso.ts             exigirAdmin(req, orgId) — owner/admin da organização
  notificacoes.ts       notificar() / notificarNovoLead() (central + push)
  negocios/etapa.ts     moverEtapa(): mesmo efeito do Kanban (atividade, SLA, webhook da etapa)
  canais/
    api.ts              webhook POST /:provider/:token; conexões (criar, conectar, atualizar, remover)
    ingestao.ts         grava conversa/mensagem sem duplicar e enfileira vínculo, mídia e análise
    fila.ts             pg-boss: nomes das filas, políticas, papel do processo
    cifra.ts            AES-256-GCM com CHANNEL_SECRET_KEY
    servidores.ts       Evolution da plataforma (EVOLUTION_URL/EVOLUTION_API_KEY) e URL do webhook
    provedores/         evolution.ts (parse do webhook, instância, QR, status, mídia) + index.ts
    nucleo/tipos.ts     eventos normalizados (o núcleo não conhece a Evolution)
    identificacao/      telefone.ts (variantes BR, JID, @lid) e vincular.ts (telefone → nome)
    midia/              armazenamento.ts (disco em MEDIA_DIR) e jobs.ts (baixar, transcrever)
    transcricao/        whisper.ts (/audio/transcriptions, formato OpenAI: Groq, OpenAI…)
  ia/
    api.ts              /api/ai: credenciais (testa e cifra), modelos da chave, teste a seco
    credenciais.ts      provedores, URLs padrão, listagem de modelos
    llm/                anthropic.ts (SDK oficial), openai.ts (compatíveis), google.ts, index.ts
    analise/            agendar (debounce), contexto, prompt, decisao (zod), analisar, aplicar (política)

src/pages/WhatsAppPage.tsx, src/pages/AiSettingsPage.tsx   (Configurações → WhatsApp / Inteligência Artificial)
src/services/channels.ts, src/services/ai.ts, src/hooks/useChannels.ts
```

Filas (`server/canais/fila.ts`):

| Fila | Política | O que faz |
| --- | --- | --- |
| `canais.chat.vincular` | singleton, 5 tentativas | Liga a conversa a contato/negócio (telefone → nome). |
| `canais.midia.baixar` | 5 tentativas | Baixa áudio/imagem para `MEDIA_DIR` (se configurado). |
| `canais.audio.transcrever` | 10 tentativas, backoff até 30 min | Transcreve; 429 → reserva ou volta para a fila. |
| `canais.chat.analisar` | stately (1 na fila + 1 rodando por conversa), 6 tentativas | Análise da IA e aplicação da política. |
| `canais.manutencao` | cron 03:15 (São Paulo) | Partições novas, retenção de mídia e `raw`. |
| `canais.conexoes.saude` | cron a cada 5 min | Consulta o status das instâncias na Evolution. |

Testes: `server/canais/canais.test.ts` e `server/ia/llm/llm.test.ts`
(`bunx vitest run server`; o `fetch` é bloqueado nos testes de LLM, nenhum
teste chama provedor de verdade).

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

## 12. Fase 2 — mídia e transcrição

Feito:
- `db/61_ia.sql`: `ai_credentials` (chave cifrada; o navegador vê apelido e
  4 últimos dígitos; só owner/admin), `org_ai_settings` (transcrição:
  ligada, credencial + modelo principal, reserva, idioma) e `usage_events`.
- Configurações → Inteligência Artificial: conectar Groq, OpenAI ou
  compatível com OpenAI (a chave é testada listando os modelos antes de
  salvar), escolher modelo principal e reserva da transcrição (a lista vem da
  própria chave, filtrada para modelos de áudio), consumo do mês.
  Anthropic/Google e os modelos de análise entram na Fase 3, na mesma tela.
- Jobs `canais.midia.baixar` (áudio/imagem → `MEDIA_DIR`) e
  `canais.audio.transcrever` (`/audio/transcriptions`, formato OpenAI).
  429 na principal → tenta a reserva; sem reserva, volta para a fila com
  backoff (30 s → 30 min, 10 tentativas). Erro 4xx, arquivo > 25 MB: marca
  `failed` e não insiste. Sem credencial: `no_credential`.
- Estado em `channel_messages.media.transcript_status`
  (`done`/`failed`/`no_credential`/`disabled`), texto em `transcript`;
  segundos de áudio em `usage_events`.
- Retenção no job diário: mídia por 3 meses, `raw` por 30 dias.
- "Último evento" da conexão passa a contar mensagens (1 escrita/min).

Testado no dev com Evolution e provedor falsos: chave errada recusada,
modelos filtrados, áudio recebido e enviado transcritos, 429 → reserva,
429 sem reserva → fila com espera, sem credencial, áudio repetido baixado
uma vez só, retenção do disco, RLS (outra organização não vê; a chave não
é legível nem pelo owner).

Produção:
- `MEDIA_DIR` é opcional. Sem ele, funciona (a transcrição baixa o áudio
  da Evolution), mas imagens e áudios não ficam guardados para a Fase 3/4.
  Para guardar: Volume no `crm-app` montado em `/app/data` e
  `MEDIA_DIR=/app/data/midia` no `secrets.env`.
- Cadastrar a chave da Groq em Configurações → Inteligência Artificial e
  escolher `whisper-large-v3-turbo` como principal.

## 13. Fase 3 — inteligência

Feito:
- `db/62_ia_analise.sql`: modelo de análise (principal + reserva) e política
  em `org_ai_settings`; `ai_analyses` (cada chamada: entrada resumida,
  decisão, modelo, tokens, erro) e `ai_actions` (o que foi proposto, o
  estado — `applied`/`pending`/`skipped` com motivo — e antes/depois);
  `channel_chats.pending_since`/`last_analysis_at`.
- Debounce por conversa (`server/ia/analise/agendar.ts`): cada mensagem
  reagenda a análise para 3 min depois; teto de 15 min; fila `stately`
  (no máximo uma análise na fila e uma rodando por conversa). Espera os
  áudios do lote virarem texto (até 10 min). Conversa marcada como não
  comercial: reavaliada no máximo 1×/dia.
- Análise (`server/ia/analise/`): contexto com o negócio vinculado (ou os
  negócios abertos do contato), etapas do funil, últimas atividades,
  tarefas abertas, 15 mensagens anteriores e até 80 novas; imagens do lote
  (até 4) vão para a IA quando o modelo lê imagem. Saída validada pelo zod.
  Principal falhou → reserva. Recusa ou erro de configuração não entram
  em loop: ficam registrados e o lote é reavaliado na próxima mensagem.
- Política (`aplicar.ts`): resumo na linha do tempo (atividade `whatsapp`);
  mudança de etapa só no mesmo funil, com confiança mínima configurável
  (80% para avançar, 90% para voltar), pelo mesmo caminho do Kanban
  (`server/negocios/etapa.ts`: atividade, SLA, webhook da etapa; gatilhos
  do banco fazem tarefas/automações da etapa); até 3 tarefas sem repetir as
  abertas; valor quando cotado explicitamente; número desconhecido →
  negócio novo por `resolve_company_contact` (regra do AGENTS.md) ou conversa
  ignorada se não comercial. Notificação (central + push) quando a IA muda
  a etapa ou cria negócio.
- Configurações → Inteligência Artificial: Anthropic e Google entram como
  provedores; card "Análise das conversas" com modelo principal/reserva
  (lista da própria chave, indicando quais leem imagem), confiança mínima,
  criar negócio de desconhecido, instruções da empresa para a IA, e
  **Testar com a conversa mais recente** (roda a IA e mostra o que faria,
  sem gravar).
- Anthropic: `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`)
  nos modelos que aceitam (Claude Fable 5.1, Opus 5.5, Opus 5, Sonnet 5.5):
  numa recusa de segurança o próprio servidor tenta outro modelo. Chave e
  host sempre os da credencial (o SDK leria `ANTHROPIC_BASE_URL` e
  `ANTHROPIC_AUTH_TOKEN` do ambiente).

Ajustes depois da primeira versão (em produção):
- `b783472`: modelo que não lê imagem (ex.: `openai/gpt-oss-120b` na Groq)
  responde 4xx quando o lote tem imagem; a análise repete só com o texto
  (a legenda continua). 401/403/429 não repetem (`comOuSemImagens`).
- `78eabf3`: quem **já é cliente** (suporte, dúvida de uso, financeiro) não
  vira negócio comercial — `comercial` só é true para potencial cliente. Os
  negócios candidatos podem ser de funis diferentes (Comercial e Sucesso do
  Cliente); a IA escolhe pelo assunto e só usa etapas do funil do negócio
  escolhido.
- **Valor em jogo** (2026-10-27): o valor do negócio é o último valor
  cotado, proposto ou combinado na conversa, mesmo sem aceite, e é
  sobrescrito quando muda. Não é valor fechado em contrato.
- **Sem negócio duplicado quando o WhatsApp vem antes do formulário**
  (`db/63_resolve_por_telefone.sql`, 2026-10-27): `resolve_company_contact`
  procura a empresa pelo telefone de um contato existente (`phone_key`)
  depois de CNPJ e e-mail e antes do nome — só se o telefone aponta para uma
  única empresa — e reaproveita o contato com o mesmo telefone e sem outro
  e-mail. O formulário cai na empresa criada pela IA, renomeia o nome
  provisório e, pela deduplicação empresa + funil, atualiza o negócio em vez
  de criar outro.
- **Formulário não volta negócio aberto** (`server/webhook-entrada.ts`,
  2026-10-27): a reentrada (voltar para a primeira etapa) só vale para
  negócio ganho, inativo ou arquivado. Aberto fica na etapa em que está e
  ganha a nota "Formulário preenchido de novo" — senão um lead que já fala
  com o vendedor voltaria para Novo Lead e acionaria a Softeo.

Ficou para a Fase 4: autonomia "só sugerir" (a política já grava `pending`,
falta a tela de aprovar e o desfazer), aba WhatsApp no negócio, catálogo de
modelos com preço estimado (hoje a lista vem ao vivo da chave, sem preço).

Testado no dev com provedor falso: teste a seco pela tela (com imagem),
fechamento → resumo + etapa (93%) + valor + tarefa + automação da etapa +
notificação; "talvez" → só resumo (55% < 80%); número desconhecido pedindo
orçamento → negócio novo com empresa e contato; conversa pessoal →
ignorada. Adaptadores Anthropic/Google/OpenAI com `fetch` interceptado
(schema, cache, imagem, fallback, recusa, queda para `json_object`).

## 14. Produção hoje (2026-10-27)

Onde cada peça roda (VPS, Easypanel, projeto `evolution`, rede interna
`easypanel-evolution`):

| Serviço | Endereço interno | Papel |
| --- | --- | --- |
| `crm-app` | `http://crm-app:3000` | API + front + worker (`ROLE` vazio = `all`). Público em `https://crm.neosoluti.com.br`. |
| `crm-db` | `crm-db:5432`, banco `crm` | Postgres; a fila do pg-boss mora no schema `pgboss` do mesmo banco. |
| `crm-rest` | `crm-rest` | PostgREST (o servidor fala com ele com JWT de `service_role`). |
| `evolution-api` | `http://evolution-api:8080` | Evolution API v2.3.0 (Baileys). Instância **Oniplataforma**, número +55 19 99596-3535. |

Configuração em uso:
- `secrets.env` do `crm-app` (File mount em `/app/secrets.env`):
  `CHANNEL_SECRET_KEY`, `EVOLUTION_URL=http://evolution-api:8080`,
  `EVOLUTION_API_KEY` (chave global da Evolution),
  `CHANNEL_WEBHOOK_BASE_URL=http://crm-app:3000` (**só a base, sem caminho**:
  o código acrescenta `/api/channels/evolution/<token>`). Opcionais em
  `.env.example` (retenção, paralelismo, debounce).
- **O File mount só é gravado no deploy.** Mudou um segredo → salvar no
  Easypanel **e** fazer deploy. `scripts/deploy.sh` sai sem fazer nada se o
  commit no ar já é o último; para reaplicar só segredos, dispare o webhook
  de deploy do Easypanel (`CRM_DEPLOY_WEBHOOK` no `.env.local`) direto.
- Webhook da instância na Evolution:
  `http://crm-app:3000/api/channels/evolution/<webhook_token>`, eventos
  `MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`. Se a URL estiver
  errada (ex.: depois de mudar `CHANNEL_WEBHOOK_BASE_URL`), Configurações →
  WhatsApp → **Atualizar** reaplica o webhook com a URL atual.
- Organização **Oniplataforma**: transcrição ligada com Groq
  `whisper-large-v3-turbo`; análise ligada com Anthropic `claude-haiku-5-5`
  e reserva Groq `openai/gpt-oss-120b`, autonomia automática, cria negócio
  de desconhecido, instruções abaixo. Testada ponta a ponta em 2026-10-27
  (formulário → conversa → resumo, etapas, tarefa, valor). Sem `MEDIA_DIR`: mídias não ficam
  guardadas (a transcrição baixa o áudio da Evolution na hora).
- Funis: **Comercial** (Novo Lead → Engajamento → Atendimento Humano →
  Demonstração → FWP → Fechamento; as etapas mandam webhook para a Softeo,
  e Engajamento dispara o robô) e **Sucesso do Cliente** (Onboarding → Ativo,
  sem webhook nem automação). Negócio criado pela IA entra na primeira etapa
  do funil da conexão (ou do primeiro funil) — hoje, Novo Lead.

Quem faz o quê no fluxo:
- **Groq (Whisper)**: só transforma áudio em texto.
- **Modelo de análise (Claude ou reserva)**: lê o lote de mensagens + o
  negócio (etapas, atividades, tarefas) e devolve uma decisão estruturada
  (resumo, etapa, tarefas, valor, se é comercial). Não grava nada.
- **Política (`aplicar.ts`)**: decide o que aplicar (limiares, mesmo funil,
  sem tarefas repetidas) e grava pelo mesmo caminho do Kanban.

Instruções da empresa em uso (Configurações → Inteligência Artificial),
versão de 2026-10-27:

```
Este é o WhatsApp comercial da Oniplataforma, sistema de gestão para buffets
infantis e casas de festa. "Equipe" é o nosso vendedor falando pessoalmente
com o cliente. O robô de nutrição usa outro número: as mensagens da Equipe
aqui são sempre de uma pessoa.

Funil Comercial (quem ainda não é cliente):
- Novo Lead: chegou e ainda não houve conversa.
- Engajamento: o robô está nutrindo o lead. NUNCA mova um negócio para
  Engajamento: entrar nessa etapa liga o robô no WhatsApp do cliente.
- Atendimento Humano: o vendedor está conversando pessoalmente com o
  cliente. Se a Equipe respondeu e o cliente engajou, o negócio é pelo
  menos Atendimento Humano.
- Demonstração: a data e o horário da demonstração foram combinados, ou a
  demonstração já aconteceu.
- FWP: a proposta foi enviada ao cliente, ou o cliente começou um teste
  grátis (trial) do sistema.
- Fechamento: o cliente aceitou a proposta e está assinando o contrato ou
  fazendo o pagamento.

Regras:
- Nunca volte um negócio para uma etapa anterior.
- Pode pular etapas quando a conversa mostrar: proposta já enviada vai
  direto para FWP, mesmo sem demonstração.
- Valor é o valor em jogo, não o fechado: o último valor do plano que a
  Equipe passou ou que foi combinado, mesmo sem aceite (mensal; se a
  negociação for de plano anual, o valor anual). Se mudar (desconto, outro
  plano), use o novo. Ignore valores de exemplo ou de concorrentes.
- Tarefas: só quando alguém prometeu algo com prazo (enviar proposta,
  enviar link da demo, ligar, mandar contrato). Ex.: "Enviar proposta do
  plano Pro", "Enviar link da demo de quinta 15h".
- Conversa com fornecedor, parceiro ou cobrança nossa não é comercial.
- Resumo: registre objeções (preço, concorrente, momento), o sistema ou
  controle que o cliente usa hoje (planilha, caderno, outro sistema), a
  cidade e o tamanho da operação (eventos por mês, unidades) quando
  aparecerem.

Funil Sucesso do Cliente (quem já é cliente):
- Onboarding: cliente novo em implantação (configuração, treinamento,
  migração de dados).
- Ativo: implantação concluída e o cliente usando o sistema no dia a dia.
Dúvidas de uso, suporte e financeiro de quem já é cliente vão para o
negócio do funil Sucesso do Cliente, nunca para o Comercial.
```

Na mesma tela: confiança para avançar 80%, para **voltar 100%** (a IA
nunca volta etapa; casa com a regra acima).

## 15. Suporte: como diagnosticar

Acesso ao banco: `scripts/tunel-db.sh abrir` (imprime o arquivo com a URL),
`psql "$(cat <arquivo>)"`, e **sempre** `scripts/tunel-db.sh fechar` no fim.
Logs: Easypanel → `crm-app` → Logs (prefixos `[canais]`, `[ia]`, `[worker]`).

O caminho de uma mensagem, e onde olhar se parar em cada ponto:

1. **Chegou no CRM?**
   ```sql
   select c.display_name, c.status, c.status_detail, c.last_event_at
   from channel_connections c;
   select ch.push_name, ch.phone_digits, ch.status, ch.matched_by, ch.last_message_at
   from channel_chats ch order by ch.last_message_at desc nulls last limit 20;
   ```
   `last_event_at` parado com mensagens chegando no celular → o webhook não
   chega: conferir a URL do webhook na Evolution (Atualizar na tela), se o
   `crm-app` está no ar (`/health`) e se a instância está `connected` (senão,
   ler o QR de novo na tela). Grupos e status são ignorados de propósito.
2. **Ligou ao negócio certo?** `channel_chats.status`:
   `linked` (tem `lead_id`), `unmatched` (nenhum contato com esse telefone
   nem nome completo único — a IA decide quando analisar), `ignored` (a IA
   achou que não é comercial; reavalia no máximo 1×/dia), `pending` (ainda
   na fila). O vínculo é por `contacts.phone_key` (sem 55 e sem 9º dígito)
   → negócio **aberto** do contato via `lead_contacts`, o de atividade mais
   recente. Contato sem telefone, ou sem `lead_contacts` no negócio, não é
   encontrado. Para religar uma conversa depois de corrigir o contato:
   `update channel_chats set status = 'pending', lead_id = null, contact_id = null where id = '<chat>'`
   — a próxima mensagem refaz o vínculo.
3. **Áudio transcrito?**
   ```sql
   select sent_at, media->>'transcript_status' st, left(transcript, 80)
   from channel_messages where message_type = 'audio' order by sent_at desc limit 10;
   ```
   `no_credential`/`disabled` → configurar na tela; `failed` → erro
   permanente (arquivo > 25 MB, 4xx do provedor); vazio → ainda na fila
   (limite da Groq grátis: volta para a fila com espera).
4. **A IA analisou?**
   ```sql
   select a.created_at, a.status, a.model, a.error, a.output->>'resumo' resumo
   from ai_analyses a order by a.created_at desc limit 10;
   select x.type, x.state, x.confidence, x.reason, x.payload
   from ai_actions x order by x.created_at desc limit 20;
   ```
   Nada em `ai_analyses` → análise desligada ou sem modelo (o job registra
   `skipped` só no log), ou dentro do debounce (3 min depois da última
   mensagem, teto 15 min; `channel_chats.pending_since` preenchido = está
   esperando). `state = 'skipped'` traz o motivo (confiança abaixo do
   limiar, etapa de outro funil, tarefa repetida…).
5. **Fila travada?**
   ```sql
   select name, state, count(*) from pgboss.job
   where name like 'canais.%' group by 1, 2 order by 1, 2;
   ```
   Muitos `retry`/`failed` → ver o erro em `pgboss.job.output` e o log.

Teste sem efeito: Configurações → Inteligência Artificial → **Testar com a
conversa mais recente** roda a IA e mostra a decisão, sem gravar.

Erros já vistos e a causa:
- Tabela nova dá 404 no PostgREST → faltou `notify pgrst, 'reload schema'`
  (as migrações já têm).
- Segredo novo não aparece no container → File mount só é gravado no deploy.
- Webhook com caminho duplicado → `CHANNEL_WEBHOOK_BASE_URL` deve ser só
  `http://crm-app:3000`.
- Anthropic 401 com chave certa → o SDK leria `ANTHROPIC_BASE_URL` /
  `ANTHROPIC_AUTH_TOKEN` do ambiente; o adaptador já força os da credencial.
- Modelo reserva sem visão → repete só com texto (seção 13).

Escalar: criar o serviço `crm-worker` (mesma imagem, `ROLE=worker`, mesmo
`secrets.env`) e mudar o `crm-app` para `ROLE=api`. Os jobs são
idempotentes; várias réplicas do worker podem rodar juntas.

## 16. Dados da Oniplataforma alterados em 2026-10-27

Feito direto no banco de produção, em transação, com ensaio (rollback) antes.

**Funil Sucesso do Cliente reestruturado** — antes: FASE 0, FASE 1, FASE 2,
Acompanhamento, Recorrente. Agora: **Onboarding** (antiga FASE 0, recebeu os
negócios das FASES 1 e 2) e **Ativo** (antigo Acompanhamento). FASE 1, FASE 2
e Recorrente (vazia) apagadas. Nenhuma automação ou webhook dependia delas.

**Clientes ativos importados** — fonte: planilha
`orgs-oni-ativas-2026-10-27.csv` (exportação das organizações ativas da
Oniplataforma, com até 6 contatos por cliente; o contato 1 é o gestor). O
script está em `scripts/importacoes/2026-10-27-clientes-sucesso.sql` (os
dados da planilha não vão para o repositório). Regras aplicadas:
- Empresas e contatos novos só por `resolve_company_contact` (regra do
  AGENTS.md), com CNPJ; contato já existente na empresa (mesmo `phone_key`
  ou e-mail) só é completado; o contato principal sem telefone/e-mail do
  negócio recebe os dados do contato 1.
- Negócio no Sucesso do Cliente: o existente é atualizado (valor = mensalidade,
  status `open`); o novo entra em **Ativo**, `source = 'planilha'`, com nota
  "Cliente da Oniplataforma (ID org …, plano, status, desde …)". Contato 1 =
  principal; os outros vinculados em `lead_contacts`.
- Negócio aberto do cliente no Comercial seria marcado `won` (nenhum havia).
- Resultado: 35 empresas novas, 94 contatos novos e 9 completados, 36
  negócios novos e 5 atualizados → 41 abertos no Sucesso do Cliente (38
  Ativo, 3 Onboarding), R$ 14.907/mês.

Decisões do dono nessa importação:
- **Oni Buffet** (conta de teste) não importada.
- **Trials** (Arena Kids, Bosque Kids, Le Desiree) continuam no Comercial;
  só receberam CNPJ e contatos.
- **Arena P7** era a mesma empresa que a **Amabê Eventos**: contato e
  conversas passados para a Amabê, Arena P7 apagada; o negócio da Amabê,
  que estava `won`, voltou a `open` em Onboarding.
- **Buffet Hullabaloo**: valor R$ 2.931 (plano anual, como na planilha).
- A empresa "Will" (nome provisório) virou **Alego Festas**; o contato 1 da
  planilha, (11) 9870-8402, era o mesmo Will de (11) 98870-8402 e ficou um só.
- "Slink Kids" (Ana Paula) é o **Espaço Slink Festas**, diferente do SLINK
  KIDS JARAGUÁ (Sabrina) — não são duplicados.
- Contatos chamados só "Comercial"/"Financeiro" ganharam o nome da empresa
  entre parênteses. "Admin mais antigo" não foi cadastrado quando diferente
  do contato 1 (sem telefone na planilha).
- Ficaram no funil, como estavam: Fabrika dos Sonhos e Labibi (`won` em
  Onboarding, fora da lista de ativas).
