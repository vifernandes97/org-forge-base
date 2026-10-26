-- Tabelas do Better Auth 1.7 no schema app_auth, com
-- colunas em snake_case (o mapeamento está em server/auth.ts). app_auth.users
-- nasce no 01_supabase_shim.sql, porque o FK de profiles depende dela.
-- Quem acessa é o papel app_auth_svc (db/criar-papeis.sh), com
-- search_path = app_auth no próprio papel e acesso só a este schema.

-- generateId 'uuid': quem gera o id é o banco (bases criadas antes deste default).
alter table app_auth.users alter column id set default gen_random_uuid();

create table if not exists app_auth.session (
  id uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id uuid not null references app_auth.users(id) on delete cascade
);
create index if not exists session_user_id_idx on app_auth.session (user_id);

create table if not exists app_auth.account (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  provider_id text not null,
  user_id uuid not null references app_auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists account_user_id_idx on app_auth.account (user_id);

create table if not exists app_auth.verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists verification_identifier_idx on app_auth.verification (identifier);

-- O nome do profile vinha do raw_user_meta_data do Supabase; conta nova do
-- Better Auth traz em users.name. Mesmo trigger, as duas origens.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.name, ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

-- Na primeira passada (aplicar-schema.sh) o papel ainda não existe;
-- criar-papeis.sh roda este arquivo de novo depois de criá-lo.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'app_auth_svc') then
    grant usage on schema app_auth to app_auth_svc;
    grant select, insert, update, delete on all tables in schema app_auth to app_auth_svc;
    alter role app_auth_svc set search_path = app_auth;
  end if;
end $$;
