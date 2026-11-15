-- Bia agenda pelo Orbi (docs/ORBI.md, "Agendamento pela Bia"): o link do tipo
-- de reunião do Orbi cujos horários livres a Bia oferece ao lead
-- (https://orbi…/agendar/<pessoa>/<tipo>). Vazio = a Bia não oferece horário
-- e a demo segue pelo pedido de reunião de sempre (/humano, motivo demo).
-- O navegador lê e grava (owner/admin) só esta coluna; chave e segredo seguem
-- só pelo servidor.

alter table public.org_orbi_integrations
  add column if not exists booking_link text
    check (booking_link is null or booking_link ~ '^https?://[^ ]+/agendar/[a-z0-9-]+/[a-z0-9-]+/?$');

grant select (booking_link) on public.org_orbi_integrations to authenticated;
grant update (booking_link) on public.org_orbi_integrations to authenticated;
drop policy if exists org_orbi_integrations_update on public.org_orbi_integrations;
create policy org_orbi_integrations_update on public.org_orbi_integrations
  for update to authenticated
  using (public.get_user_org_role(organization_id) in ('owner','admin'))
  with check (public.get_user_org_role(organization_id) in ('owner','admin'));

-- Tarefa de demo marcada pela Bia: id da reserva no Orbi (a reunião fica em external_ref_id).
comment on column public.tasks.external_request_id is
  'Id do pedido no Orbi; para demo marcada pela Bia, id da reserva (booking) no Orbi.';

notify pgrst, 'reload schema';
