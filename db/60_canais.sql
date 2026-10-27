-- Canais de mensagem (WhatsApp pela Evolution hoje; outros provedores
-- depois) — Fase 1 do orquestrador (docs/WHATSAPP.md).
-- channel_servers: servidores de provedor. organization_id nulo = da
--   plataforma (vem do secrets.env); chave cifrada pelo app (AES-GCM).
-- channel_connections: um número de uma organização.
-- channel_chats: uma conversa privada; vínculo com contato/negócio.
-- channel_messages: mensagens, particionada por mês (sent_at).
-- contacts.phone_key: telefone na forma de comparação (phone_match_key),
--   indexado — o mesmo cálculo de server/canais/identificacao/telefone.ts.
-- Escrita só pelo servidor (service_role); membros leem. A chave da
-- Evolution e o token do webhook nunca saem para o navegador.

create or replace function public.phone_match_key(p text)
returns text language sql immutable parallel safe as $$
  -- Brasil: sem o 55, sem o 9º dígito do celular → DDD + 8 dígitos.
  -- Fora disso, só os dígitos. Curto demais para casar com segurança: nulo.
  with d as (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as v),
  s as (
    select case when length(v) in (12, 13) and left(v, 2) = '55' then substr(v, 3) else v end as v from d
  )
  select case
    when length(v) = 11 and substr(v, 3, 1) = '9' then left(v, 2) || substr(v, 4)
    when length(v) >= 10 then v
    else null
  end from s
$$;

alter table public.contacts
  add column if not exists phone_key text generated always as (public.phone_match_key(phone)) stored;
create index if not exists contacts_phone_key_idx on public.contacts (organization_id, phone_key) where phone_key is not null;

-- O resumo de cada análise entra na linha do tempo do negócio como 'whatsapp'.
create or replace function public.validate_activity_type()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.activity_type not in ('note','call','email','meeting','stage_change','field_update','task_created','task_completed','webhook_sent','webhook_failed','whatsapp') then
    raise exception 'Invalid activity_type: %', new.activity_type;
  end if;
  return new;
end;
$$;

create table if not exists public.channel_servers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('evolution')),
  name text not null,
  base_url text not null,
  api_key_enc text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists channel_servers_name_idx on public.channel_servers (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  server_id uuid not null references public.channel_servers(id),
  provider text not null check (provider in ('evolution')),
  instance_name text not null,
  display_name text not null,
  webhook_token text not null unique,
  -- Instância criada por nós (apagamos ao remover) ou já existente (só soltamos o webhook).
  managed boolean not null default true,
  phone_number text,
  status text not null default 'pending' check (status in ('pending','qr','connected','disconnected','error')),
  status_detail text,
  actor_user_id uuid references app_auth.users(id) on delete set null,
  funnel_id uuid references public.funnels(id) on delete set null,
  is_active boolean not null default true,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id, instance_name)
);
create index if not exists channel_connections_org_idx on public.channel_connections (organization_id);

create table if not exists public.channel_chats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.channel_connections(id) on delete cascade,
  remote_jid text not null,
  phone_digits text,
  phone_key text generated always as (public.phone_match_key(phone_digits)) stored,
  push_name text,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  -- pending: ainda não procurado; linked: achou contato; unmatched: não achou
  -- (Fase 3: a IA decide se vira negócio); ignored: não comercial.
  status text not null default 'pending' check (status in ('pending','linked','unmatched','ignored')),
  matched_by text,
  message_count integer not null default 0,
  last_message_at timestamptz,
  analyzed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, remote_jid)
);
create index if not exists channel_chats_org_idx on public.channel_chats (organization_id, last_message_at desc);
create index if not exists channel_chats_lead_idx on public.channel_chats (lead_id) where lead_id is not null;
create index if not exists channel_chats_contact_idx on public.channel_chats (contact_id) where contact_id is not null;

create table if not exists public.channel_messages (
  id uuid not null default gen_random_uuid(),
  organization_id uuid not null,
  connection_id uuid not null,
  chat_id uuid not null,
  provider_message_id text not null,
  from_me boolean not null,
  message_type text not null,
  body text,
  media jsonb,
  transcript text,
  sent_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  primary key (id, sent_at),
  -- Idempotência: a Evolution reenvia; a mesma mensagem tem o mesmo horário.
  unique (connection_id, provider_message_id, sent_at)
) partition by range (sent_at);
create index if not exists channel_messages_chat_idx on public.channel_messages (chat_id, sent_at);
-- Sem partição do mês, a mensagem cai aqui em vez de se perder.
create table if not exists public.channel_messages_default partition of public.channel_messages default;

-- Cria as partições mensais de agora até `meses` à frente (o worker chama 1×/dia).
create or replace function public.ensure_channel_message_partitions(meses integer default 2)
returns void language plpgsql set search_path = public as $$
declare
  inicio date := date_trunc('month', now() - interval '1 month')::date;
  m date;
  nome text;
begin
  for i in 0..meses + 1 loop
    m := (inicio + make_interval(months => i))::date;
    nome := format('channel_messages_%s', to_char(m, 'YYYY_MM'));
    if to_regclass('public.' || nome) is null then
      execute format('create table public.%I partition of public.channel_messages for values from (%L) to (%L)',
        nome, m, (m + interval '1 month')::date);
    end if;
  end loop;
end;
$$;
select public.ensure_channel_message_partitions(2);

-- ---------- acesso ----------
alter table public.channel_servers enable row level security;
alter table public.channel_connections enable row level security;
alter table public.channel_chats enable row level security;
alter table public.channel_messages enable row level security;

revoke all on public.channel_servers, public.channel_connections, public.channel_chats, public.channel_messages from anon, authenticated;
grant all on public.channel_servers, public.channel_connections, public.channel_chats, public.channel_messages to service_role;

-- Conexões: membros leem tudo menos o token do webhook; owner/admin mudam
-- só o que não mexe na Evolution (criar/remover/QR passam pelo servidor).
grant select (id, organization_id, server_id, provider, instance_name, display_name, managed, phone_number, status,
  status_detail, actor_user_id, funnel_id, is_active, last_event_at, created_at, updated_at)
  on public.channel_connections to authenticated;
grant update (display_name, actor_user_id, funnel_id, is_active) on public.channel_connections to authenticated;

drop policy if exists channel_connections_select on public.channel_connections;
create policy channel_connections_select on public.channel_connections
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));
drop policy if exists channel_connections_update on public.channel_connections;
create policy channel_connections_update on public.channel_connections
  for update to authenticated
  using (public.get_user_org_role(organization_id) in ('owner','admin'))
  with check (public.get_user_org_role(organization_id) in ('owner','admin'));

grant select on public.channel_chats to authenticated;
drop policy if exists channel_chats_select on public.channel_chats;
create policy channel_chats_select on public.channel_chats
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));

grant select (id, organization_id, connection_id, chat_id, provider_message_id, from_me, message_type, body, media,
  transcript, sent_at, created_at) on public.channel_messages to authenticated;
drop policy if exists channel_messages_select on public.channel_messages;
create policy channel_messages_select on public.channel_messages
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));

-- O webhook grava pelo dono do banco (APP_DATABASE_URL), como a fila de saída.

-- O PostgREST guarda o schema em cache: sem isto as tabelas novas dão 404.
notify pgrst, 'reload schema';
