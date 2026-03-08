

# Expandir Automações: Ação de Webhook de Saída

## Objetivo
Adicionar um select de "tipo de ação" no dialog de automação, permitindo escolher entre **Criar Tarefa** e **Disparar Webhook**. Isso unifica a configuração de webhooks de saída (atualmente feita no campo `webhook_url` da etapa) no painel de automações.

## Mudanças no Banco de Dados

### Adicionar colunas na tabela `stage_task_templates`
Renomear conceitualmente para "automações genéricas" adicionando campos de webhook:
```sql
ALTER TABLE stage_task_templates
  ADD COLUMN action_type text NOT NULL DEFAULT 'create_task',
  ADD COLUMN webhook_url text,
  ADD COLUMN webhook_secret text;
```
- `action_type`: `'create_task'` ou `'send_webhook'`
- `webhook_url` e `webhook_secret`: usados quando `action_type = 'send_webhook'`
- Trigger de validação para `action_type`

### Atualizar trigger `execute_stage_task_automations()`
- Adicionar bloco que, quando `action_type = 'send_webhook'`, invoca a edge function `fire-webhook` via `net.http_post` ou insere dados em `webhook_logs` (reutilizar o fluxo existente de disparo de webhook, chamando a edge function via `pg_net`).

Alternativa mais simples: manter o disparo no frontend/edge function existente. O trigger já roda no DB para criar tarefas. Para webhooks, o trigger pode inserir um registro na `webhook_logs` como "pendente" e a edge function `fire-webhook` já existente processa.

**Abordagem escolhida**: O trigger no DB tratará apenas `create_task`. Para `send_webhook`, o frontend detectará templates de webhook ativos ao mover o lead e chamará a edge function `fire-webhook` existente. Isso é mais simples e reutiliza a infraestrutura existente de webhooks com retry e HMAC.

**Revisão**: Na verdade, o trigger `execute_stage_task_automations` roda no DB. É mais confiável disparar tudo no DB. Vamos usar `pg_net` para chamar a edge function de webhook a partir do trigger.

**Abordagem final simplificada**: Manter o disparo de webhook igual ao que já existe — via o campo `webhook_url` na stage. A diferença é que agora a configuração será feita pelo painel de automações, e ao salvar um automation de tipo `send_webhook`, vamos atualizar o campo `webhook_url` da stage correspondente. Isso reutiliza toda a infra existente (edge function `fire-webhook`, triggers, etc.) sem mudanças no backend.

**Espera** — isso acopla demais. Melhor: adicionar `action_type`, `webhook_url`, `webhook_secret` na tabela `stage_task_templates`, e atualizar o trigger para chamar a edge function via `pg_net`.

Vou simplificar: **não mexer no trigger do DB para webhooks**. O trigger atual de webhook já é disparado via edge function chamada pelo frontend quando o lead muda de etapa. Vamos apenas:

1. Adicionar colunas `action_type`, `webhook_url` na tabela
2. No frontend, ao mover lead de etapa, verificar templates de webhook ativos e disparar a edge function existente
3. Atualizar UI para suportar os dois tipos de ação

Na verdade, olhando o fire-webhook edge function, ele é chamado de onde?

Let me check.
