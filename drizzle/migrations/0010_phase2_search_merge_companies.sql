-- FASE 2
ALTER TABLE public.leads ALTER COLUMN name SET DEFAULT '';

-- novo tipo de atividade para mesclagem de empresas (não editável como nota)
CREATE OR REPLACE FUNCTION public.validate_activity_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.activity_type NOT IN ('note','call','email','meeting','stage_change','field_update','task_created','task_completed','webhook_sent','webhook_failed','company_merge') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  RETURN NEW;
END $$;

-- PONTE TEMPORÁRIA (remover na fase 4): reage só a mudanças de nome/e-mail/telefone;
-- troca de empresa feita pelo app não recria contatos a partir dos campos antigos
CREATE OR REPLACE FUNCTION public.bridge_lead_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- TEMPORÁRIO: remover na fase 4
DECLARE v_contact uuid; v_cur public.contacts;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
    RETURN NULL;
  END IF;
  IF NEW.company_id IS NULL THEN RETURN NULL; END IF;
  IF coalesce(btrim(NEW.name),'') = '' AND coalesce(btrim(NEW.email),'') = '' AND coalesce(btrim(NEW.phone),'') = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.* INTO v_cur FROM public.lead_contacts lc JOIN public.contacts c ON c.id = lc.contact_id
   WHERE lc.lead_id = NEW.id AND lc.is_primary AND c.company_id = NEW.company_id;

  IF v_cur.id IS NOT NULL THEN
    UPDATE public.contacts SET name = coalesce(NEW.name,''), email = nullif(btrim(NEW.email),''), phone = nullif(btrim(NEW.phone),'')
     WHERE id = v_cur.id
       AND (name IS DISTINCT FROM coalesce(NEW.name,'') OR email IS DISTINCT FROM nullif(btrim(NEW.email),'')
            OR phone IS DISTINCT FROM nullif(btrim(NEW.phone),''));
    RETURN NULL;
  END IF;

  v_contact := public.find_company_contact(NEW.company_id, NEW.name, NEW.email, NEW.phone);
  IF v_contact IS NULL THEN
    INSERT INTO public.contacts (organization_id, company_id, name, email, phone)
    VALUES (NEW.organization_id, NEW.company_id, coalesce(NEW.name,''), nullif(btrim(NEW.email),''), nullif(btrim(NEW.phone),''))
    RETURNING id INTO v_contact;
  END IF;
  UPDATE public.lead_contacts SET is_primary = false WHERE lead_id = NEW.id AND is_primary;
  INSERT INTO public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
  VALUES (NEW.organization_id, NEW.id, v_contact, true)
  ON CONFLICT (lead_id, contact_id) DO UPDATE SET is_primary = true;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.bridge_lead_contact() FROM PUBLIC, anon, authenticated;

-- Busca de negócios (respeita RLS)
CREATE OR REPLACE FUNCTION public.search_leads(p_org uuid, p_term text)
RETURNS SETOF public.leads LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH t AS (
    SELECT public.normalize_company_key(p_term) AS k,
           regexp_replace(coalesce(p_term,''), '\D', '', 'g') AS d,
           lower(btrim(coalesce(p_term,''))) AS raw
  )
  SELECT l.* FROM public.leads l, t
  WHERE l.organization_id = p_org
    AND (
      t.k IS NULL
      OR EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = l.company_id
          AND (
            public.normalize_company_key(c.trade_name) LIKE '%' || t.k || '%'
            OR public.normalize_company_key(c.legal_name) LIKE '%' || t.k || '%'
            OR (length(t.d) >= 3 AND c.cnpj LIKE '%' || t.d || '%')
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.lead_contacts lc JOIN public.contacts ct ON ct.id = lc.contact_id
        WHERE lc.lead_id = l.id
          AND (
            public.normalize_company_key(ct.name) LIKE '%' || t.k || '%'
            OR lower(coalesce(ct.email,'')) LIKE '%' || t.raw || '%'
            OR (length(t.d) >= 3 AND regexp_replace(coalesce(ct.phone,''), '\D', '', 'g') LIKE '%' || t.d || '%')
          )
      )
    )
$$;
REVOKE EXECUTE ON FUNCTION public.search_leads(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_leads(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_company_key(text) TO authenticated;

-- Mesclar empresas: p_source é absorvida por p_target
CREATE OR REPLACE FUNCTION public.merge_companies(p_target uuid, p_source uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_t public.companies; v_s public.companies;
  v_role text; c RECORD; lk RECORD; v_dup uuid;
  v_leads uuid[]; v_contacts_moved int := 0; v_contacts_merged int := 0; v_lead uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_target = p_source THEN RAISE EXCEPTION 'Escolha uma empresa diferente'; END IF;
  SELECT * INTO v_t FROM public.companies WHERE id = p_target FOR UPDATE;
  SELECT * INTO v_s FROM public.companies WHERE id = p_source FOR UPDATE;
  IF v_t.id IS NULL OR v_s.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF v_t.organization_id <> v_s.organization_id THEN RAISE EXCEPTION 'Empresas de organizações diferentes'; END IF;
  v_role := public.get_user_org_role(v_t.organization_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Sem permissão para mesclar empresas'; END IF;
  IF v_t.cnpj IS NOT NULL AND v_s.cnpj IS NOT NULL AND v_t.cnpj <> v_s.cnpj THEN
    RAISE EXCEPTION 'As duas empresas têm CNPJ diferentes; não é possível mesclar';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_leads FROM public.leads WHERE company_id = p_source;
  UPDATE public.leads SET company_id = p_target WHERE company_id = p_source;

  FOR c IN SELECT * FROM public.contacts WHERE company_id = p_source LOOP
    v_dup := public.find_company_contact(p_target, c.name, c.email, c.phone, c.id);
    IF v_dup IS NULL THEN
      UPDATE public.contacts SET company_id = p_target WHERE id = c.id;
      v_contacts_moved := v_contacts_moved + 1;
    ELSE
      FOR lk IN SELECT * FROM public.lead_contacts WHERE contact_id = c.id LOOP
        IF EXISTS (SELECT 1 FROM public.lead_contacts WHERE lead_id = lk.lead_id AND contact_id = v_dup) THEN
          DELETE FROM public.lead_contacts WHERE id = lk.id;
          IF lk.is_primary THEN
            UPDATE public.lead_contacts SET is_primary = true WHERE lead_id = lk.lead_id AND contact_id = v_dup;
          END IF;
        ELSE
          UPDATE public.lead_contacts SET contact_id = v_dup WHERE id = lk.id;
        END IF;
      END LOOP;
      UPDATE public.contacts SET
        email = coalesce(nullif(btrim(email),''), c.email),
        phone = coalesce(nullif(btrim(phone),''), c.phone)
      WHERE id = v_dup;
      DELETE FROM public.contacts WHERE id = c.id;
      v_contacts_merged := v_contacts_merged + 1;
    END IF;
  END LOOP;

  DELETE FROM public.companies WHERE id = p_source;
  UPDATE public.companies SET
    legal_name = coalesce(nullif(btrim(legal_name),''), v_s.legal_name),
    cnpj = coalesce(cnpj, v_s.cnpj),
    instagram = coalesce(nullif(btrim(instagram),''), v_s.instagram),
    segment = coalesce(nullif(btrim(segment),''), v_s.segment),
    match_key = coalesce(match_key, v_s.match_key)
  WHERE id = p_target;

  FOREACH v_lead IN ARRAY v_leads LOOP
    INSERT INTO public.lead_activities (organization_id, lead_id, user_id, activity_type, title, description, metadata)
    VALUES (v_t.organization_id, v_lead, v_uid, 'company_merge', 'Empresa mesclada',
      'A empresa "' || v_s.trade_name || '" foi mesclada em "' || v_t.trade_name || '".',
      jsonb_build_object('merge', true, 'kind', 'company', 'source_company_id', p_source, 'source_trade_name', v_s.trade_name,
                         'target_company_id', p_target, 'target_trade_name', v_t.trade_name));
  END LOOP;

  RETURN jsonb_build_object('leads_moved', coalesce(array_length(v_leads,1),0),
    'contacts_moved', v_contacts_moved, 'contacts_merged', v_contacts_merged);
END $$;
REVOKE EXECUTE ON FUNCTION public.merge_companies(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_companies(uuid,uuid) TO authenticated;
