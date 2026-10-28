-- Tipos e subtipos de tarefa por organização (substitui a lista fixa de cinco
-- valores validada por trigger).
--
-- task_types: cadastro por organização. `code` é a chave estável que o servidor
--   e os modelos de etapa usam ('follow_up', 'meeting'...); `label` é o nome
--   que a pessoa vê e pode renomear. `action` diz que integração o tipo dispara
--   (orbi_meeting / orbi_ticket); por ora só fica gravada — o despacho é a
--   etapa seguinte.
-- task_subtypes: subtipos de um tipo (Reunião de implantação, Bug...), geridos
--   em Configurações.
-- tasks.task_type segue sendo o code (os INSERTs do servidor não mudam); o
--   trigger resolve task_type_id e confere que o subtipo é do tipo.

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  icon text not null default 'circle',
  action text not null default 'none' check (action in ('none','orbi_meeting','orbi_ticket')),
  position integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create unique index if not exists task_types_label_uidx on public.task_types (organization_id, lower(label));

create table if not exists public.task_subtypes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_type_id uuid not null references public.task_types(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists task_subtypes_label_uidx on public.task_subtypes (task_type_id, lower(label));

alter table public.tasks
  add column if not exists task_type_id uuid references public.task_types(id) on delete restrict,
  add column if not exists task_subtype_id uuid references public.task_subtypes(id) on delete restrict;
create index if not exists tasks_type_idx on public.tasks (task_type_id);

-- Tipos de fábrica de uma organização (idempotente).
create or replace function public.seed_task_types(p_org_id uuid)
returns void language plpgsql set search_path = public as $$
declare v_meeting uuid; v_ticket uuid;
begin
  insert into task_types (organization_id, code, label, icon, action, position, is_system) values
    (p_org_id, 'meeting',   'Reunião',   'calendar',       'orbi_meeting', 1, true),
    (p_org_id, 'ticket',    'Ticket',    'ticket',         'orbi_ticket',  2, true),
    (p_org_id, 'message',   'Mensagem',  'message-square', 'none',         3, true),
    (p_org_id, 'email',     'E-mail',    'mail',           'none',         4, true),
    (p_org_id, 'call',      'Ligação',   'phone',          'none',         5, true),
    (p_org_id, 'follow_up', 'Follow-up', 'refresh-cw',     'none',         6, true),
    (p_org_id, 'other',     'Outro',     'circle',         'none',         7, true)
  on conflict (organization_id, code) do nothing;
  select id into v_meeting from task_types where organization_id = p_org_id and code = 'meeting';
  select id into v_ticket from task_types where organization_id = p_org_id and code = 'ticket';
  insert into task_subtypes (organization_id, task_type_id, label, position) values
    (p_org_id, v_meeting, 'Reunião de implantação', 1),
    (p_org_id, v_meeting, 'Reunião de demonstração', 2),
    (p_org_id, v_ticket, 'Bug', 1),
    (p_org_id, v_ticket, 'Feature', 2)
  on conflict do nothing;
end;
$$;
revoke all on function public.seed_task_types(uuid) from public, anon, authenticated;

create or replace function public.seed_task_types_on_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_task_types(new.id);
  return new;
end;
$$;
drop trigger if exists seed_task_types_on_org on public.organizations;
create trigger seed_task_types_on_org after insert on public.organizations
  for each row execute function public.seed_task_types_on_org();

do $$ declare o record; begin
  for o in select id from public.organizations loop perform public.seed_task_types(o.id); end loop;
end $$;

update public.tasks t set task_type_id = tt.id
  from public.task_types tt
  where tt.organization_id = t.organization_id and tt.code = t.task_type and t.task_type_id is null;

-- Substitui a validação fixa: aceita o code (ou o id) de um tipo da organização.
drop trigger if exists validate_task_type_trigger on public.tasks;
create or replace function public.resolve_task_type()
returns trigger language plpgsql set search_path = public as $$
declare v_code text; v_id uuid;
begin
  if new.task_type_id is not null
     and (tg_op = 'INSERT' or new.task_type_id is distinct from old.task_type_id) then
    select code into v_code from task_types where id = new.task_type_id and organization_id = new.organization_id;
    if v_code is null then raise exception 'Tipo de tarefa inválido'; end if;
    new.task_type := v_code;
  else
    select id into v_id from task_types where organization_id = new.organization_id and code = new.task_type;
    if v_id is null then raise exception 'Invalid task_type: %', new.task_type; end if;
    new.task_type_id := v_id;
  end if;
  if new.task_subtype_id is not null and not exists (
    select 1 from task_subtypes where id = new.task_subtype_id and task_type_id = new.task_type_id) then
    raise exception 'Subtipo não pertence ao tipo da tarefa';
  end if;
  return new;
end;
$$;
drop trigger if exists resolve_task_type_trigger on public.tasks;
create trigger resolve_task_type_trigger before insert or update on public.tasks
  for each row execute function public.resolve_task_type();

-- Modelos de etapa continuam guardando o code.
drop trigger if exists validate_stage_task_template_type_trigger on public.stage_task_templates;
create or replace function public.validate_stage_task_template_type()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from task_types where organization_id = new.organization_id and code = new.task_type) then
    raise exception 'Invalid task_type: %', new.task_type;
  end if;
  return new;
end;
$$;
create trigger validate_stage_task_template_type_trigger
  before insert or update on public.stage_task_templates
  for each row execute function public.validate_stage_task_template_type();

alter table public.task_types enable row level security;
alter table public.task_subtypes enable row level security;
revoke all on public.task_types, public.task_subtypes from anon, authenticated;
grant all on public.task_types, public.task_subtypes to service_role;
grant select, insert, update, delete on public.task_types, public.task_subtypes to authenticated;

drop policy if exists task_types_select on public.task_types;
create policy task_types_select on public.task_types
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));
drop policy if exists task_types_write on public.task_types;
create policy task_types_write on public.task_types
  for all to authenticated
  using (public.get_user_org_role(organization_id) in ('owner','admin'))
  with check (public.get_user_org_role(organization_id) in ('owner','admin'));

drop policy if exists task_subtypes_select on public.task_subtypes;
create policy task_subtypes_select on public.task_subtypes
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));
drop policy if exists task_subtypes_write on public.task_subtypes;
create policy task_subtypes_write on public.task_subtypes
  for all to authenticated
  using (public.get_user_org_role(organization_id) in ('owner','admin'))
  with check (public.get_user_org_role(organization_id) in ('owner','admin'));

notify pgrst, 'reload schema';
