-- Central de notificações e Web Push (app instalado no iPhone/Mac/Chrome).
-- notifications: uma linha por destinatário (cada um lê e marca a sua).
-- push_subscriptions: um aparelho/navegador inscrito por linha; o servidor
-- (server/notificacoes.ts) envia para todas as do usuário e apaga as que o
-- serviço de push recusa (404/410).
-- Hoje só o webhook de entrada cria notificação (tipo 'new_lead').

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references app_auth.users(id) on delete cascade,
  type text not null default 'new_lead',
  title text not null,
  body text,
  lead_id uuid references public.leads(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, organization_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id, organization_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
