-- Análise das conversas pela IA — Fase 3 do orquestrador (docs/WHATSAPP.md §6).
-- org_ai_settings ganha o modelo de análise (principal + reserva) e a
--   política: autonomia, confiança mínima para mudar de fase, criar negócio
--   de número desconhecido, instruções da organização para a IA.
-- channel_chats.pending_since: primeira mensagem ainda não analisada (o
--   debounce analisa 3 min depois da última, e no máximo 15 min depois desta).
-- ai_analyses: cada chamada à IA (entrada resumida, saída, modelo, tokens, erro).
-- ai_actions: o que a IA propôs e o que foi feito (antes/depois) — auditoria
--   e base para desfazer.

alter table public.org_ai_settings
  add column if not exists analysis_enabled boolean not null default true,
  add column if not exists analysis_credential_id uuid references public.ai_credentials(id) on delete set null,
  add column if not exists analysis_model text,
  add column if not exists analysis_fallback_credential_id uuid references public.ai_credentials(id) on delete set null,
  add column if not exists analysis_fallback_model text,
  add column if not exists autonomy text not null default 'auto',
  add column if not exists stage_min_confidence numeric not null default 0.8,
  add column if not exists stage_back_min_confidence numeric not null default 0.9,
  add column if not exists create_leads boolean not null default true,
  add column if not exists instructions text;

do $$ begin
  alter table public.org_ai_settings add constraint org_ai_settings_autonomy_check check (autonomy in ('auto','suggest'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.org_ai_settings add constraint org_ai_settings_confidence_check
    check (stage_min_confidence between 0 and 1 and stage_back_min_confidence between 0 and 1);
exception when duplicate_object then null; end $$;

-- Toda credencial escolhida tem que ser da mesma organização.
create or replace function public.check_org_ai_settings()
returns trigger language plpgsql set search_path = public as $$
declare
  c uuid;
begin
  foreach c in array array[new.transcription_credential_id, new.transcription_fallback_credential_id,
                           new.analysis_credential_id, new.analysis_fallback_credential_id] loop
    if c is not null and not exists (select 1 from ai_credentials where id = c and organization_id = new.organization_id) then
      raise exception 'Credencial de outra organização';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;

alter table public.channel_chats
  add column if not exists pending_since timestamptz,
  add column if not exists last_analysis_at timestamptz;

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chat_id uuid references public.channel_chats(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  provider text,
  model text,
  status text not null check (status in ('done','error','skipped')),
  dry_run boolean not null default false,
  input jsonb,
  output jsonb,
  error text,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_analyses_org_idx on public.ai_analyses (organization_id, created_at desc);
create index if not exists ai_analyses_chat_idx on public.ai_analyses (chat_id, created_at desc);
create index if not exists ai_analyses_lead_idx on public.ai_analyses (lead_id, created_at desc) where lead_id is not null;

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_id uuid not null references public.ai_analyses(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  type text not null check (type in ('note','stage_change','task','field_update','create_lead','classify')),
  payload jsonb not null,
  confidence numeric,
  -- applied: feito; pending: aguarda aprovação (autonomia "suggest");
  -- skipped: a política barrou (motivo em reason); reverted: desfeito.
  state text not null check (state in ('applied','pending','skipped','rejected','reverted')),
  reason text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists ai_actions_analysis_idx on public.ai_actions (analysis_id);
create index if not exists ai_actions_lead_idx on public.ai_actions (lead_id, created_at desc) where lead_id is not null;

alter table public.ai_analyses enable row level security;
alter table public.ai_actions enable row level security;
revoke all on public.ai_analyses, public.ai_actions from anon, authenticated;
grant all on public.ai_analyses, public.ai_actions to service_role;

-- Membros veem o que a IA fez nos negócios da organização; só o servidor escreve.
grant select on public.ai_analyses, public.ai_actions to authenticated;
drop policy if exists ai_analyses_select on public.ai_analyses;
create policy ai_analyses_select on public.ai_analyses
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));
drop policy if exists ai_actions_select on public.ai_actions;
create policy ai_actions_select on public.ai_actions
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));

notify pgrst, 'reload schema';
