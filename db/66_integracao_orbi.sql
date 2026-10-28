-- Integração com o Orbi (docs/ORBI.md): tarefa de tipo com action
-- 'orbi_meeting' vira um pedido de reunião no Orbi; a pessoa confirma lá e o
-- Orbi avisa de volta (retorno assinado), quando a tarefa é concluída.
--
-- org_orbi_integrations: credencial da organização no Orbi (chave e segredo
--   do retorno cifrados por server/canais/cifra.ts). O navegador vê só URL,
--   fim da chave, se está ligada e o último erro; escrita só por /api/orbi.
-- tasks.external_*: estado do envio da tarefa. 'queued' = fila do servidor
--   (server/orbi.ts); 'pending' = no Orbi, esperando a pessoa; 'accepted' /
--   'rejected' chegam pelo retorno; 'cancelled' quando a tarefa some ou é
--   concluída à mão; 'failed' = o envio desistiu (botão de reenviar na tela).
-- orbi_cancels: pedidos a cancelar no Orbi (a tarefa pode já não existir).

create table if not exists public.org_orbi_integrations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  base_url text not null default 'https://orbi.neosoluti.com.br',
  api_key_enc text not null,
  key_last4 text not null,
  callback_secret_enc text not null,
  enabled boolean not null default true,
  last_error text,
  last_ok_at timestamptz,
  created_by uuid references app_auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.org_orbi_integrations enable row level security;
revoke all on public.org_orbi_integrations from anon, authenticated;
grant all on public.org_orbi_integrations to service_role;
grant select (organization_id, base_url, key_last4, enabled, last_error, last_ok_at, created_at, updated_at)
  on public.org_orbi_integrations to authenticated;
drop policy if exists org_orbi_integrations_select on public.org_orbi_integrations;
create policy org_orbi_integrations_select on public.org_orbi_integrations
  for select to authenticated using (public.get_user_org_role(organization_id) in ('owner','admin'));

alter table public.tasks
  add column if not exists external_status text
    check (external_status in ('queued','pending','accepted','rejected','cancelled','failed')),
  add column if not exists external_request_id text,
  add column if not exists external_ref_id text,
  add column if not exists external_url text,
  add column if not exists external_error text,
  add column if not exists external_attempts integer not null default 0,
  add column if not exists external_next_at timestamptz;
create index if not exists tasks_external_fila_idx on public.tasks (external_next_at)
  where external_status = 'queued';

create table if not exists public.orbi_cancels (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null,
  attempts integer not null default 0,
  next_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.orbi_cancels enable row level security;
revoke all on public.orbi_cancels from anon, authenticated;
grant all on public.orbi_cancels to service_role;

-- Decide a fila a partir do tipo da tarefa. Triggers BEFORE rodam em ordem
-- alfabética: o "z_" garante que o resolve_task_type_trigger (65) já
-- preencheu task_type_id.
create or replace function public.tasks_orbi_fila()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_orbi boolean;
  v_retorno boolean;
begin
  if tg_op = 'DELETE' then
    if old.external_status in ('pending','queued') and old.external_request_id is not null then
      insert into orbi_cancels (organization_id, task_id) values (old.organization_id, old.id);
    end if;
    return old;
  end if;

  v_orbi := exists (
    select 1 from task_types t
    join org_orbi_integrations i on i.organization_id = t.organization_id and i.enabled
    where t.id = new.task_type_id and t.action = 'orbi_meeting');

  if tg_op = 'INSERT' then
    if v_orbi and new.completed_at is null and new.external_status is null then
      new.external_status := 'queued';
      new.external_next_at := now();
      new.external_attempts := 0;
    end if;
    return new;
  end if;

  -- O retorno do Orbi muda external_status junto: não é ação da pessoa.
  v_retorno := new.external_status is distinct from old.external_status;
  if v_retorno or old.external_status not in ('queued','pending') then
    return new;
  end if;

  if (new.completed_at is not null and old.completed_at is null) or not v_orbi then
    -- Concluída à mão (ou deixou de ser reunião do Orbi) antes da confirmação.
    if old.external_request_id is not null then
      insert into orbi_cancels (organization_id, task_id) values (old.organization_id, old.id);
    end if;
    new.external_status := 'cancelled';
    new.external_next_at := null;
  elsif row(new.title, new.description, new.due_date, new.assigned_to, new.task_subtype_id)
        is distinct from row(old.title, old.description, old.due_date, old.assigned_to, old.task_subtype_id) then
    -- Pedido ainda pendente: reenviar atualiza no Orbi (mesmo externalId).
    new.external_status := 'queued';
    new.external_next_at := now();
    new.external_attempts := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists z_tasks_orbi_fila on public.tasks;
create trigger z_tasks_orbi_fila before insert or update on public.tasks
  for each row execute function public.tasks_orbi_fila();
drop trigger if exists tasks_orbi_cancela on public.tasks;
create trigger tasks_orbi_cancela after delete on public.tasks
  for each row execute function public.tasks_orbi_fila();

notify pgrst, 'reload schema';
