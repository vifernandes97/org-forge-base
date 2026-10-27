-- Importação dos clientes ativos da Oniplataforma no funil Sucesso do Cliente
-- (2026-10-27). Registro do que rodou em produção; ver docs/WHATSAPP.md §16.
--
-- Entrada: um JSON (variável psql "dados") com um item por empresa:
--   { i, empresa, cnpj, company_id (empresa já existente no CRM ou null),
--     cliente (false = trial: só CNPJ e contatos), valor, nota,
--     contatos: [{ n, nome, tel (+55…), email }] }   -- n = 1 é o gestor
-- Gerado da planilha por 2026-10-27-clientes-sucesso.py (os dados ficam fora
-- do repositório). company_id foi preenchido pela prévia (CNPJ, nome ou
-- telefone de contato) e conferido à mão antes.
--
-- Uso (túnel aberto com scripts/tunel-db.sh):
--   psql "$URL" -q -v dados="$(cat plano.json)" -f este.sql   -- termina em commit
--   Para ensaiar, troque o commit do final por rollback.
-- Os ids abaixo são da organização Oniplataforma em produção.
\set ON_ERROR_STOP on

begin;
create temp table plano on commit drop as select :'dados'::jsonb d;
do $$
declare
  O constant uuid := 'ff7bbd31-e907-4a2e-8d9f-ad1d53a35aaa';
  CS constant uuid := '20cdf74a-2f36-47d1-ad6c-e0e01884e963';
  ATIVO constant uuid := '4ff47326-e211-412e-ba6e-3160a53f69d5';
  DONO constant uuid := 'c105beaa-11d5-488e-9a92-4e66016a6301';
  ARENA_P7 constant uuid := '482c1c00-27fa-4bac-8d40-4437f9f14654';
  AMABE_LEAD constant uuid := '5ca70480-5133-41de-bbd0-fc1698145cc3';
  p jsonb; k jsonb; r jsonb; v_cia uuid; v_lead uuid; v_ct uuid; v_cts uuid[]; v_n int; v_criado boolean;
  c_cias int := 0; c_ct_novos int := 0; c_ct_atual int := 0; c_neg_novos int := 0; c_neg_atual int := 0; c_ganhos int := 0;
begin
  -- AMABE: a Arena P7 é a mesma empresa; o Túlio da Amabê fica com o telefone/e-mail (pela planilha, abaixo).
  update channel_chats set contact_id = (select contact_id from lead_contacts where lead_id = AMABE_LEAD and is_primary)
   where contact_id in (select id from contacts where company_id = ARENA_P7);
  delete from companies where id = ARENA_P7 and not exists (select 1 from leads where company_id = ARENA_P7);

  for p in select jsonb_array_elements(d) from plano loop
    v_cia := (p->>'company_id')::uuid; v_lead := null; v_cts := '{}'; v_criado := false;
    if v_cia is not null and p->>'cnpj' is not null then
      update companies set cnpj = coalesce(cnpj, p->>'cnpj') where id = v_cia
        and not exists (select 1 from companies x where x.organization_id = O and x.cnpj = p->>'cnpj' and x.id <> v_cia);
    end if;
    if v_cia is not null then
      select id into v_lead from leads
       where company_id = v_cia and archived_at is null and merged_into_lead_id is null
         and case when (p->>'cliente')::boolean then funnel_id = CS else status = 'open' end
       order by (status = 'open') desc, created_at desc limit 1;
    end if;

    for k in select jsonb_array_elements(p->'contatos') loop
      v_ct := null;
      if v_cia is not null then
        select id into v_ct from contacts where company_id = v_cia
          and ((k->>'tel' is not null and phone_key = phone_match_key(k->>'tel'))
            or (k->>'email' is not null and lower(btrim(email)) = k->>'email')) limit 1;
        if v_ct is null and (k->>'n')::int = 1 and v_lead is not null then
          select c.id into v_ct from lead_contacts lc join contacts c on c.id = lc.contact_id
           where lc.lead_id = v_lead and lc.is_primary and coalesce(btrim(c.phone),'') = '' and coalesce(btrim(c.email),'') = '';
        end if;
      end if;
      if v_ct is not null then
        update contacts set phone = coalesce(nullif(btrim(phone),''), k->>'tel'), email = coalesce(nullif(btrim(email),''), k->>'email')
         where id = v_ct;
        c_ct_atual := c_ct_atual + 1;
      else
        r := resolve_company_contact(O, p_trade_name => p->>'empresa', p_cnpj => p->>'cnpj',
               p_contact_name => k->>'nome', p_email => k->>'email', p_phone => k->>'tel');
        if v_cia is not null and (r->>'company_id')::uuid <> v_cia then
          raise exception 'Empresa divergente para %: esperada %, veio %', p->>'empresa', v_cia, r->>'company_id';
        end if;
        v_cia := (r->>'company_id')::uuid; v_ct := (r->>'contact_id')::uuid;
        if (r->>'company_created')::boolean then c_cias := c_cias + 1; end if;
        if (r->>'contact_created')::boolean then c_ct_novos := c_ct_novos + 1; else c_ct_atual := c_ct_atual + 1; end if;
      end if;
      v_cts := v_cts || v_ct;
    end loop;

    if (p->>'cliente')::boolean then
      if v_lead is null then
        insert into leads (organization_id, funnel_id, stage_id, company_id, value, source, tags, priority, status)
        values (O, CS, ATIVO, v_cia, (p->>'valor')::numeric, 'planilha', '{}', 'medium', 'open') returning id into v_lead;
        c_neg_novos := c_neg_novos + 1; v_criado := true;
      else
        update leads set value = (p->>'valor')::numeric, status = 'open' where id = v_lead;
        c_neg_atual := c_neg_atual + 1;
      end if;
      insert into lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
      values (O, v_lead, DONO, 'note', case when v_criado then 'Cliente cadastrado pela planilha' else 'Dados atualizados pela planilha' end,
              p->>'nota', jsonb_build_object('source', 'planilha_orgs_ativas_2026_10_27'));
      update leads set status = 'won' where company_id = v_cia and funnel_id <> CS and status = 'open'
        and archived_at is null and merged_into_lead_id is null;
      get diagnostics v_n = row_count; c_ganhos := c_ganhos + v_n;
    end if;

    if v_lead is not null then
      insert into lead_contacts (organization_id, lead_id, contact_id, is_primary)
      select O, v_lead, x, false from unnest(v_cts) x on conflict (lead_id, contact_id) do nothing;
      update lead_contacts set is_primary = false where lead_id = v_lead and is_primary and contact_id <> v_cts[1];
      update lead_contacts set is_primary = true where lead_id = v_lead and contact_id = v_cts[1];
    end if;
    raise notice '% | % | negócio % % | % contatos', p->>'i', p->>'empresa', coalesce(v_lead::text,'—'),
      case when v_criado then 'novo' else '' end, array_length(v_cts, 1);
  end loop;
  raise notice 'RESUMO empresas novas %, contatos novos %, contatos atualizados %, negócios novos %, negócios atualizados %, comerciais ganhos %',
    c_cias, c_ct_novos, c_ct_atual, c_neg_novos, c_neg_atual, c_ganhos;
end $$;
commit;
