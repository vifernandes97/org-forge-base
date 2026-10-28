-- Boas-vindas por áudio (docs/WHATSAPP.md §17): quando o lead manda a frase
-- do formulário ("Oi, quero falar com um consultor!"), o CRM espera o negócio
-- do formulário existir com segmento e chama um webhook (n8n), que manda pela
-- Evolution o áudio gravado do segmento.
--
-- channel_connections.welcome_*: configuração por número. O segredo vai no
--   cabeçalho X-CRM-Token e fica cifrado (cifra.ts); sem grant para o
--   navegador (as colunas novas ficam fora do grant por coluna da 60).
-- channel_welcomes: uma linha por contato (telefone) por organização — é a
--   trava de "uma vez por contato" — e o id da mensagem enviada, que marca o
--   áudio como automático para a IA não ler como fala de uma pessoa.

alter table public.channel_connections
  add column if not exists welcome_webhook_url text,
  add column if not exists welcome_trigger text,
  add column if not exists welcome_secret text;

create table if not exists public.channel_welcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.channel_connections(id) on delete cascade,
  chat_id uuid not null references public.channel_chats(id) on delete cascade,
  phone_key text not null,
  lead_id uuid references public.leads(id) on delete set null,
  segment text,
  -- waiting: esperando o negócio/segmento; sent; skipped (motivo em reason); failed.
  status text not null default 'waiting' check (status in ('waiting','sent','skipped','failed')),
  reason text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists channel_welcomes_phone_uidx on public.channel_welcomes (organization_id, phone_key);
create index if not exists channel_welcomes_msg_idx on public.channel_welcomes (connection_id, provider_message_id) where provider_message_id is not null;

alter table public.channel_welcomes enable row level security;
revoke all on public.channel_welcomes from anon, authenticated;
grant all on public.channel_welcomes to service_role;
grant select on public.channel_welcomes to authenticated;
drop policy if exists channel_welcomes_select on public.channel_welcomes;
create policy channel_welcomes_select on public.channel_welcomes
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));

notify pgrst, 'reload schema';
