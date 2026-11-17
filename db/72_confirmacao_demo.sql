-- Confirmação da demo 3 h antes (docs/ORBI.md, "Confirmação 3 h antes"): o worker
-- manda o template oni_confirmacao_demo pelo Chatvolt (número 0573) a quem tem
-- uma demo marcada no Orbi.
--
-- tasks.meeting_url: link da chamada (Meet) da reserva do Orbi. Antes só ia na
--   descrição da tarefa; o botão do template precisa dele estruturado. Preenchido
--   pela demo que a Bia marca (/agendar); demo que chega pelo retorno do Orbi
--   não traz o link e fica sem confirmação (motivo sem_link).
-- demo_confirmations: uma linha por tarefa — a trava de "uma vez por demo". O
--   worker insere antes de chamar o Chatvolt e fecha com o resultado; sem nova
--   tentativa automática (se a Meta aceitou e a resposta se perdeu, repetir
--   mandaria a mensagem duas vezes). provider_message_id é o id da mensagem no
--   Chatvolt: a IA lê a mensagem como automática, não como atendimento humano.

alter table public.tasks add column if not exists meeting_url text;
comment on column public.tasks.meeting_url is
  'Link da chamada (Meet) da reunião no Orbi; usado na confirmação da demo 3 h antes.';

create table if not exists public.demo_confirmations (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  -- sending: reservada, chamando o Chatvolt; sent; skipped (motivo em reason); failed.
  status text not null default 'sending' check (status in ('sending','sent','skipped','failed')),
  reason text,
  template text,
  provider_message_id text,
  provider_conversation_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists demo_confirmations_msg_idx on public.demo_confirmations (provider_message_id)
  where provider_message_id is not null;
create index if not exists demo_confirmations_lead_idx on public.demo_confirmations (lead_id) where lead_id is not null;

alter table public.demo_confirmations enable row level security;
revoke all on public.demo_confirmations from anon, authenticated;
grant all on public.demo_confirmations to service_role;
grant select on public.demo_confirmations to authenticated;
drop policy if exists demo_confirmations_select on public.demo_confirmations;
create policy demo_confirmations_select on public.demo_confirmations
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));

notify pgrst, 'reload schema';
