-- IA por organização — Fase 2 do orquestrador (docs/WHATSAPP.md §6.1).
-- ai_credentials: chaves dos provedores (Groq, OpenAI, compatível com OpenAI;
--   Anthropic/Google entram na Fase 3), cifradas pelo app (server/canais/cifra.ts).
--   O navegador vê apelido e últimos 4 dígitos, nunca a chave.
-- org_ai_settings: o que a organização escolheu (hoje: transcrição; na Fase 3,
--   os modelos de análise e a política).
-- usage_events: consumo por organização (segundos de áudio, tokens) — base
--   para cota e cobrança.
-- Escrita de credenciais só pelo servidor (/api/ai); ajustes por owner/admin.

create table if not exists public.ai_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('groq','openai','openai_compatible','anthropic','google')),
  label text not null,
  base_url text,
  api_key_enc text not null,
  key_last4 text not null,
  status text not null default 'ok' check (status in ('ok','error')),
  last_error text,
  last_checked_at timestamptz,
  created_by uuid references app_auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_credentials_org_idx on public.ai_credentials (organization_id);

create table if not exists public.org_ai_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  transcription_enabled boolean not null default true,
  transcription_credential_id uuid references public.ai_credentials(id) on delete set null,
  transcription_model text,
  transcription_fallback_credential_id uuid references public.ai_credentials(id) on delete set null,
  transcription_fallback_model text,
  transcription_language text not null default 'pt',
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('transcription_seconds','llm_input_tokens','llm_output_tokens','messages')),
  quantity numeric not null,
  provider text,
  model text,
  ref_id text,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_org_idx on public.usage_events (organization_id, created_at desc);

-- ---------- acesso ----------
alter table public.ai_credentials enable row level security;
alter table public.org_ai_settings enable row level security;
alter table public.usage_events enable row level security;

revoke all on public.ai_credentials, public.org_ai_settings, public.usage_events from anon, authenticated;
grant all on public.ai_credentials, public.org_ai_settings, public.usage_events to service_role;

-- Credenciais: só owner/admin enxergam, e sem a chave.
grant select (id, organization_id, provider, label, base_url, key_last4, status, last_error, last_checked_at, created_at)
  on public.ai_credentials to authenticated;
drop policy if exists ai_credentials_select on public.ai_credentials;
create policy ai_credentials_select on public.ai_credentials
  for select to authenticated using (public.get_user_org_role(organization_id) in ('owner','admin'));

grant select, insert, update on public.org_ai_settings to authenticated;
drop policy if exists org_ai_settings_select on public.org_ai_settings;
create policy org_ai_settings_select on public.org_ai_settings
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));
drop policy if exists org_ai_settings_insert on public.org_ai_settings;
create policy org_ai_settings_insert on public.org_ai_settings
  for insert to authenticated with check (public.get_user_org_role(organization_id) in ('owner','admin'));
drop policy if exists org_ai_settings_update on public.org_ai_settings;
create policy org_ai_settings_update on public.org_ai_settings
  for update to authenticated
  using (public.get_user_org_role(organization_id) in ('owner','admin'))
  with check (public.get_user_org_role(organization_id) in ('owner','admin'));

-- Credencial escolhida tem que ser da mesma organização.
create or replace function public.check_org_ai_settings()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.transcription_credential_id is not null and not exists (
    select 1 from ai_credentials where id = new.transcription_credential_id and organization_id = new.organization_id) then
    raise exception 'Credencial de outra organização';
  end if;
  if new.transcription_fallback_credential_id is not null and not exists (
    select 1 from ai_credentials where id = new.transcription_fallback_credential_id and organization_id = new.organization_id) then
    raise exception 'Credencial de outra organização';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists check_org_ai_settings on public.org_ai_settings;
create trigger check_org_ai_settings before insert or update on public.org_ai_settings
  for each row execute function public.check_org_ai_settings();

grant select on public.usage_events to authenticated;
drop policy if exists usage_events_select on public.usage_events;
create policy usage_events_select on public.usage_events
  for select to authenticated using (public.get_user_org_role(organization_id) in ('owner','admin'));

notify pgrst, 'reload schema';
