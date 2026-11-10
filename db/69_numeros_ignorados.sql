-- Números ignorados no WhatsApp (docs/WHATSAPP.md §18): mensagens de/para um
-- número desta lista não são gravadas pelo webhook — nem conversa, nem
-- mídia, nem análise da IA. Casa por phone_key (mesma regra dos contatos).
-- Membros leem; owner/admin incluem e removem pela tela WhatsApp.

create table if not exists public.channel_ignored_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone text not null,
  phone_key text generated always as (public.phone_match_key(phone)) stored,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (public.phone_match_key(phone) is not null)
);
create unique index if not exists channel_ignored_numbers_key on public.channel_ignored_numbers (organization_id, phone_key);

alter table public.channel_ignored_numbers enable row level security;
grant select, insert, delete on public.channel_ignored_numbers to authenticated;
grant all on public.channel_ignored_numbers to service_role;

drop policy if exists channel_ignored_numbers_select on public.channel_ignored_numbers;
create policy channel_ignored_numbers_select on public.channel_ignored_numbers
  for select to authenticated using (organization_id in (select public.get_user_org_ids()));
drop policy if exists channel_ignored_numbers_insert on public.channel_ignored_numbers;
create policy channel_ignored_numbers_insert on public.channel_ignored_numbers
  for insert to authenticated with check (public.get_user_org_role(organization_id) in ('owner','admin'));
drop policy if exists channel_ignored_numbers_delete on public.channel_ignored_numbers;
create policy channel_ignored_numbers_delete on public.channel_ignored_numbers
  for delete to authenticated using (public.get_user_org_role(organization_id) in ('owner','admin'));

notify pgrst, 'reload schema';
