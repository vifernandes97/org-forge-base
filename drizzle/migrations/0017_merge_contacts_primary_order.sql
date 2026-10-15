CREATE OR REPLACE FUNCTION public.merge_contacts(p_keep uuid, p_remove uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid(); k public.contacts; r public.contacts; lk RECORD; v_moved int := 0; v_dedup int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_keep = p_remove THEN RAISE EXCEPTION 'Escolha contatos diferentes'; END IF;
  SELECT * INTO k FROM public.contacts WHERE id = p_keep FOR UPDATE;
  SELECT * INTO r FROM public.contacts WHERE id = p_remove FOR UPDATE;
  IF k.id IS NULL OR r.id IS NULL THEN RAISE EXCEPTION 'Contato não encontrado'; END IF;
  IF k.organization_id <> r.organization_id THEN RAISE EXCEPTION 'Contatos de organizações diferentes'; END IF;
  IF coalesce(public.get_user_org_role(k.organization_id),'') NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Sem permissão para mesclar contatos';
  END IF;
  IF k.company_id IS DISTINCT FROM r.company_id THEN RAISE EXCEPTION 'Os contatos precisam ser da mesma empresa'; END IF;

  FOR lk IN SELECT * FROM public.lead_contacts WHERE contact_id = p_remove LOOP
    IF EXISTS (SELECT 1 FROM public.lead_contacts WHERE lead_id = lk.lead_id AND contact_id = p_keep) THEN
      -- delete first: only one primary per deal is allowed at any moment
      DELETE FROM public.lead_contacts WHERE id = lk.id;
      IF lk.is_primary THEN
        UPDATE public.lead_contacts SET is_primary = true WHERE lead_id = lk.lead_id AND contact_id = p_keep;
      END IF;
      v_dedup := v_dedup + 1;
    ELSE
      UPDATE public.lead_contacts SET contact_id = p_keep WHERE id = lk.id;
      v_moved := v_moved + 1;
    END IF;
    INSERT INTO public.lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
    VALUES (k.organization_id, lk.lead_id, v_uid, 'contact_merge', 'Contato mesclado',
      'O contato "' || coalesce(nullif(r.name,''), r.email, 'sem nome') || '" foi mesclado em "' || coalesce(nullif(k.name,''), k.email, 'sem nome') || '".',
      jsonb_build_object('merge', true, 'kind', 'contact', 'removed_contact_id', p_remove, 'kept_contact_id', p_keep));
  END LOOP;

  UPDATE public.contacts SET
    name = CASE WHEN coalesce(btrim(name),'') = '' THEN r.name ELSE name END,
    email = coalesce(nullif(btrim(email),''), r.email),
    phone = coalesce(nullif(btrim(phone),''), r.phone)
  WHERE id = p_keep;
  DELETE FROM public.contacts WHERE id = p_remove;
  RETURN jsonb_build_object('kept', p_keep, 'moved', v_moved, 'deduplicated', v_dedup);
END $$;
REVOKE ALL ON FUNCTION public.merge_contacts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_contacts(uuid, uuid) TO authenticated, service_role;