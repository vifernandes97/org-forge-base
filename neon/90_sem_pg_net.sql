-- Sem pg_net no Neon. O trigger de AFTER INSERT em webhook_logs chamava a
-- edge function pela internet com a anon key (pública). A linha
-- 'pending_dispatch' continua sendo gravada pelas automações; quem despacha
-- é o cron da Vercel (api/cron/dispatch-webhooks).
drop trigger if exists webhook_logs_dispatch_after_insert on public.webhook_logs;
drop function if exists public.dispatch_pending_webhook();
