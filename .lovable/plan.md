# Corrigir disparo de webhooks de saída em automações

## Diagnóstico

A automação que você criou (ação **"Enviar webhook"** ao entrar em uma stage) está implementada na trigger SQL `execute_stage_task_automations`, mas ela só **insere uma linha em `webhook_logs` com `error_message = 'pending_dispatch'`** — nenhum processo lê essa fila e chama a edge function `fire-webhook`. Por isso o destino nunca recebe o POST.

A edge function `fire-webhook` em si funciona (já é usada quando você arrasta cards no Kanban). Falta apenas conectá-la ao trigger SQL.

## Solução

Conectar a trigger SQL diretamente à edge function via `pg_net.http_post`, sem depender de cron/fila. Cada vez que uma linha "pendente" é inserida em `webhook_logs`, um trigger AFTER INSERT dispara a chamada HTTP imediatamente.

Vantagens:
- Zero latência (dispara no mesmo instante da mudança de stage/status).
- Reaproveita 100% do `fire-webhook` existente (HMAC, retries, timeout, log de resposta).
- Não exige cron job nem alteração da função `execute_stage_task_automations`.
- Pega também webhooks pendentes inseridos por outras vias futuras.

## Implementação

### 1. Migração SQL

```sql
-- Habilitar pg_net (se ainda não estiver)
create extension if not exists pg_net with schema extensions;

-- Função que dispara fire-webhook para a linha recém-inserida
create or replace function public.dispatch_pending_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text := '<SUPABASE_URL>/functions/v1/fire-webhook';
  v_anon text := '<SUPABASE_ANON_KEY>';
begin
  if NEW.error_message = 'pending_dispatch' and NEW.success = false then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||v_anon
      ),
      body := jsonb_build_object(
        'webhook_url', NEW.webhook_url,
        'payload', NEW.payload,
        'organization_id', NEW.organization_id,
        'stage_id', NEW.stage_id,
        'lead_id', NEW.lead_id
      )
    );
    -- Marca como "dispatched" para o fire-webhook gravar a resposta real em outra linha
    update webhook_logs
      set error_message = 'dispatched', attempt_number = 1
      where id = NEW.id;
  end if;
  return null;
end;
$$;

create trigger webhook_logs_dispatch_after_insert
  after insert on public.webhook_logs
  for each row execute function public.dispatch_pending_webhook();
```

A URL e a anon key precisam ser **literais** na função (pg_net não acessa secrets), por isso vou usar a tool de **insert** (não migration) — assim não vaza para remixes.

### 2. Backfill (opcional)

Disparar manualmente os logs `pending_dispatch` que ficaram parados desde quando você testou, para você receber os eventos atrasados. Uma única chamada `net.http_post` por linha pendente.

### 3. Validação

- Criar/usar a automação existente.
- Mover um lead para a stage trigger.
- Conferir em **Settings → Webhooks** (logs) se aparece uma nova linha com status 200 e a resposta do destino.
- Conferir nos logs da edge function `fire-webhook`.

## Arquivos / mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<novo>.sql` | Habilitar `pg_net`, criar função `dispatch_pending_webhook` e trigger (sem URL/key — placeholder) |
| **insert tool** (não migration) | Substituir a função pela versão com URL real + anon key reais deste projeto |
| `supabase/functions/fire-webhook/index.ts` | Pequeno ajuste: aceitar invocação sem JWT de usuário (já roda com service role; só garantir CORS/headers) |

## Resultado esperado

Mover um lead para a stage configurada na automação → POST chega no seu endpoint em <2s, com header `X-CRM-Signature` (HMAC-SHA256) e payload completo do lead. Logs visíveis em `/webhooks`.