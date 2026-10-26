-- Drift: objetos que existem no banco de produção do Lovable e que nenhuma
-- migração do repo cria. Extraídos do export de 2026-10-26 (pg_dump do
-- Lovable Cloud), iguais aos de lá. A tabela estava vazia no export.
-- O replay cria um stub de execute_automations() antes da 0003 (que só
-- revoga permissões nela); aqui ela ganha o corpo de verdade.

create table if not exists public.automations (
  id uuid default gen_random_uuid() not null primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_active boolean default true not null,
  trigger_funnel_id uuid not null references public.funnels(id) on delete cascade,
  trigger_stage_id uuid not null references public.stages(id) on delete cascade,
  action_funnel_id uuid not null references public.funnels(id) on delete cascade,
  action_stage_id uuid references public.stages(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.automations enable row level security;

drop policy if exists "Members can view automations" on public.automations;
create policy "Members can view automations" on public.automations for select
  using (organization_id in (select public.get_user_org_ids()));
drop policy if exists "Owner/admin can insert automations" on public.automations;
create policy "Owner/admin can insert automations" on public.automations for insert
  with check (public.get_user_org_role(organization_id) = any (array['owner', 'admin']));
drop policy if exists "Owner/admin can update automations" on public.automations;
create policy "Owner/admin can update automations" on public.automations for update
  using (public.get_user_org_role(organization_id) = any (array['owner', 'admin']));
drop policy if exists "Owner/admin can delete automations" on public.automations;
create policy "Owner/admin can delete automations" on public.automations for delete
  using (public.get_user_org_role(organization_id) = any (array['owner', 'admin']));

drop trigger if exists set_automations_updated_at on public.automations;
create trigger set_automations_updated_at before update on public.automations
  for each row execute function public.update_updated_at_column();

create or replace function public.execute_automations()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_automation RECORD;
  v_target_stage_id uuid;
BEGIN
  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  FOR v_automation IN
    SELECT * FROM automations
    WHERE trigger_stage_id = NEW.stage_id
      AND organization_id = NEW.organization_id
      AND is_active = true
  LOOP
    v_target_stage_id := v_automation.action_stage_id;
    IF v_target_stage_id IS NULL THEN
      SELECT id INTO v_target_stage_id FROM stages
      WHERE funnel_id = v_automation.action_funnel_id
      ORDER BY position ASC LIMIT 1;
    END IF;

    IF v_target_stage_id IS NOT NULL THEN
      NEW.funnel_id := v_automation.action_funnel_id;
      NEW.stage_id := v_target_stage_id;
      NEW.stage_entered_at := now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
revoke all on function public.execute_automations() from public, anon, authenticated;

drop trigger if exists trg_execute_automations on public.leads;
create trigger trg_execute_automations before update on public.leads
  for each row execute function public.execute_automations();
