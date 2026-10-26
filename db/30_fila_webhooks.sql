-- Fila dos webhooks de saída sem pg_net. As automações seguem gravando a
-- linha 'pending_dispatch' em webhook_logs (é a fila); o cron do app
-- (server/webhooks.ts) pega as que não têm dispatched_at, marca e envia,
-- gravando o resultado numa linha nova — como a edge function fire-webhook
-- fazia. A linha da fila nunca era atualizada, por isso a coluna nova.
-- Na importação, as pendentes antigas entram já despachadas (importar.sh),
-- para nada velho ser reenviado.

alter table public.webhook_logs add column if not exists dispatched_at timestamptz;

create index if not exists webhook_logs_fila_idx on public.webhook_logs (created_at)
  where error_message = 'pending_dispatch' and dispatched_at is null;
