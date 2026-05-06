
-- Enable pg_net for HTTP calls from Postgres
create extension if not exists pg_net with schema extensions;

-- Function to dispatch pending webhook logs to fire-webhook edge function
create or replace function public.dispatch_pending_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text := 'https://albaevfzwmoiiwzlkdyd.supabase.co/functions/v1/fire-webhook';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsYmFldmZ6d21vaWl3emxrZHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MzcxODUsImV4cCI6MjA4NzIxMzE4NX0.hTg1K4N2gA0vIzQsTOeCm1GjPD31PrtEqoBvyjJ7r_U';
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
  end if;
  return null;
end;
$$;

drop trigger if exists webhook_logs_dispatch_after_insert on public.webhook_logs;
create trigger webhook_logs_dispatch_after_insert
  after insert on public.webhook_logs
  for each row execute function public.dispatch_pending_webhook();
