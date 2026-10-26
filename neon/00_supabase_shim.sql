-- O que as migrações do Supabase supõem existir antes da primeira linha.
-- No Neon, o schema auth é da Data API (pg_session_jwt: auth.uid(),
-- auth.jwt()) e não aceita objetos nossos: o que o Supabase tinha lá e o
-- Neon não tem mora em app_auth, e neon/traduzir.sed troca as referências.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anonymous') then create role anonymous nologin; end if;
  -- anon é o nome do Supabase nos GRANT/REVOKE das migrações; anonymous (o da
  -- Data API) herda o que for dado a ele.
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant anon to anonymous;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Identidade: tabela de usuários do Better Auth (search_path=app_auth na
-- conexão dele). Mesmo id do auth.users do Supabase; raw_user_meta_data
-- mantém o handle_new_user como está.
create schema if not exists app_auth;
create table if not exists app_auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  email_verified boolean not null default false,
  image text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Substitui auth.role(): só importa reconhecer a conexão de serviço (as
-- Functions da Vercel entram com o dono do banco, que ignora RLS).
create or replace function app_auth.request_role() returns text
language sql stable security definer set search_path = pg_catalog as $$
  select case
    when (select rolbypassrls from pg_roles where rolname = session_user) then 'service_role'
    when auth.uid() is not null then 'authenticated'
    else 'anon'
  end
$$;
revoke all on function app_auth.request_role() from public;
grant usage on schema app_auth to anon, authenticated, service_role;
grant execute on function app_auth.request_role() to anon, authenticated, service_role;

-- O Supabase dá privilégio de tabela a anon/authenticated/service_role em
-- tudo que nasce no public, e o RLS é quem filtra. Sem isto, toda leitura é
-- "permission denied".
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
