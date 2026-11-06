-- Mesclar empresas e contatos registra 'company_merge' / 'contact_merge' na
-- linha do tempo (merge_companies, merge_contacts), mas a validação de
-- lead_activities nunca aceitou esses tipos: mesclar uma empresa ou um contato
-- com negócio falhava inteiro. Mesma lista da 60, mais os dois.

create or replace function public.validate_activity_type()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.activity_type not in ('note','call','email','meeting','stage_change','field_update','task_created','task_completed',
                               'webhook_sent','webhook_failed','whatsapp','company_merge','contact_merge') then
    raise exception 'Invalid activity_type: %', new.activity_type;
  end if;
  return new;
end;
$$;
