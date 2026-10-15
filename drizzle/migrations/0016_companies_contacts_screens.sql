CREATE OR REPLACE VIEW public.companies_overview WITH (security_invoker = true) AS
SELECT c.id, c.organization_id, c.trade_name, c.legal_name, c.cnpj, c.instagram, c.segment_id, c.trade_name_source,
  c.created_at, c.updated_at,
  s.label AS segment_label, s.position AS segment_position,
  (SELECT count(*) FROM public.contacts ct WHERE ct.company_id = c.id) AS contacts_count,
  coalesce(la.open_count, 0) AS open_leads_count,
  coalesce(la.total_count, 0) AS total_leads_count,
  coalesce(la.open_value, 0) AS open_value,
  la.last_lead_at,
  (SELECT max(a.created_at) FROM public.lead_activities a JOIN public.leads l2 ON l2.id = a.lead_id
    WHERE l2.company_id = c.id AND l2.merged_into_lead_id IS NULL) AS last_activity_at
FROM public.companies c
LEFT JOIN public.company_segments s ON s.id = c.segment_id
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE l.status = 'open' AND l.archived_at IS NULL) AS open_count,
         count(*) AS total_count,
         sum(l.value) FILTER (WHERE l.status = 'open' AND l.archived_at IS NULL) AS open_value,
         max(l.created_at) AS last_lead_at
  FROM public.leads l WHERE l.company_id = c.id AND l.merged_into_lead_id IS NULL
) la ON true;

CREATE OR REPLACE VIEW public.contacts_overview WITH (security_invoker = true) AS
SELECT ct.id, ct.organization_id, ct.company_id, ct.name, ct.email, ct.phone, ct.created_at, ct.updated_at,
  c.trade_name AS company_trade_name, c.segment_id, s.label AS segment_label, s.position AS segment_position,
  coalesce(x.leads_count, 0) AS leads_count,
  coalesce(x.primary_count, 0) AS primary_count,
  coalesce(x.in_active, false) AS in_active_lead
FROM public.contacts ct
LEFT JOIN public.companies c ON c.id = ct.company_id
LEFT JOIN public.company_segments s ON s.id = c.segment_id
LEFT JOIN LATERAL (
  SELECT count(*) AS leads_count,
         count(*) FILTER (WHERE lc.is_primary) AS primary_count,
         bool_or(l.status = 'open' AND l.archived_at IS NULL) AS in_active
  FROM public.lead_contacts lc JOIN public.leads l ON l.id = lc.lead_id
  WHERE lc.contact_id = ct.id AND l.merged_into_lead_id IS NULL
) x ON true;

GRANT SELECT ON public.companies_overview TO authenticated;
GRANT SELECT ON public.contacts_overview TO authenticated;
GRANT SELECT ON public.companies_overview TO service_role;
GRANT SELECT ON public.contacts_overview TO service_role;

CREATE OR REPLACE FUNCTION public.list_companies(p_org uuid, p_filters jsonb DEFAULT '{}', p_sort text DEFAULT 'trade_name',
  p_dir text DEFAULT 'asc', p_page int DEFAULT 0, p_page_size int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  f jsonb := coalesce(p_filters, '{}');
  v_k text := public.normalize_company_key(f->>'q');
  v_d text := regexp_replace(coalesce(f->>'q',''), '\D', '', 'g');
  v_raw text := lower(btrim(coalesce(f->>'q','')));
  v_segs text[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(f->'segment_ids','[]')));
  v_owners uuid[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(f->'assigned_to','[]'))::uuid);
  v_funnels uuid[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(f->'funnel_ids','[]'))::uuid);
  v_dir text := CASE WHEN lower(p_dir) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_order text; v_rows jsonb; v_total bigint;
BEGIN
  v_order := CASE p_sort
    WHEN 'segment' THEN format('segment_position %s NULLS LAST, lower(trade_name)', v_dir)
    WHEN 'legal_name' THEN format('lower(legal_name) %s NULLS LAST', v_dir)
    WHEN 'cnpj' THEN format('cnpj %s NULLS LAST', v_dir)
    WHEN 'instagram' THEN format('lower(instagram) %s NULLS LAST', v_dir)
    WHEN 'contacts_count' THEN format('contacts_count %s', v_dir)
    WHEN 'open_leads_count' THEN format('open_leads_count %s, total_leads_count %s', v_dir, v_dir)
    WHEN 'open_value' THEN format('open_value %s', v_dir)
    WHEN 'last_activity_at' THEN format('last_activity_at %s NULLS LAST', v_dir)
    WHEN 'created_at' THEN format('created_at %s', v_dir)
    ELSE format('lower(trade_name) %s', v_dir) END || ', id';

  CREATE TEMP TABLE IF NOT EXISTS _lc_ids (id uuid, ord bigint) ON COMMIT DROP;
  TRUNCATE _lc_ids;
  EXECUTE format($q$
    INSERT INTO _lc_ids SELECT id, row_number() OVER (ORDER BY %s) FROM public.companies_overview o
    WHERE o.organization_id = $1
      AND ($2 IS NULL OR public.normalize_company_key(o.trade_name) LIKE '%%'||$2||'%%'
           OR public.normalize_company_key(o.legal_name) LIKE '%%'||$2||'%%'
           OR (length($3) >= 3 AND o.cnpj LIKE '%%'||$3||'%%')
           OR EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.company_id = o.id AND (
                public.normalize_company_key(ct.name) LIKE '%%'||$2||'%%'
                OR lower(coalesce(ct.email,'')) LIKE '%%'||$4||'%%'
                OR (length($3) >= 3 AND regexp_replace(coalesce(ct.phone,''),'\D','','g') LIKE '%%'||$3||'%%'))))
      AND (cardinality($5) = 0 OR o.segment_id::text = ANY($5) OR ('__none__' = ANY($5) AND o.segment_id IS NULL))
      AND (coalesce($6,'') = '' OR ($6 = 'open' AND o.open_leads_count > 0)
           OR ($6 = 'no_open' AND o.open_leads_count = 0) OR ($6 = 'no_leads' AND o.total_leads_count = 0))
      AND (cardinality($7) = 0 OR EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = o.id
            AND l.merged_into_lead_id IS NULL AND l.assigned_to = ANY($7)))
      AND (cardinality($8) = 0 OR EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = o.id
            AND l.merged_into_lead_id IS NULL AND l.funnel_id = ANY($8)))
      AND (NOT $9 OR o.contacts_count = 0)
      AND ($10 IS NULL OR o.created_at >= $10)
      AND ($11 IS NULL OR o.created_at <= $11)
  $q$, v_order)
  USING p_org, v_k, v_d, v_raw, v_segs, f->>'situation', v_owners, v_funnels,
        coalesce((f->>'no_contacts')::boolean, false),
        (f->>'created_from')::timestamptz, (f->>'created_to')::timestamptz;

  SELECT count(*) INTO v_total FROM _lc_ids;
  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY i.ord), '[]') INTO v_rows
  FROM (SELECT * FROM _lc_ids ORDER BY ord
        OFFSET CASE WHEN p_page_size IS NULL THEN 0 ELSE p_page * p_page_size END
        LIMIT coalesce(p_page_size, 20000)) i
  JOIN public.companies_overview o ON o.id = i.id;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END $$;

CREATE OR REPLACE FUNCTION public.list_contacts(p_org uuid, p_filters jsonb DEFAULT '{}', p_sort text DEFAULT 'name',
  p_dir text DEFAULT 'asc', p_page int DEFAULT 0, p_page_size int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE
  f jsonb := coalesce(p_filters, '{}');
  v_k text := public.normalize_company_key(f->>'q');
  v_d text := regexp_replace(coalesce(f->>'q',''), '\D', '', 'g');
  v_raw text := lower(btrim(coalesce(f->>'q','')));
  v_segs text[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(f->'segment_ids','[]')));
  v_dir text := CASE WHEN lower(p_dir) = 'desc' THEN 'DESC' ELSE 'ASC' END;
  v_order text; v_rows jsonb; v_total bigint;
BEGIN
  v_order := CASE p_sort
    WHEN 'company' THEN format('lower(company_trade_name) %s NULLS LAST, lower(name)', v_dir)
    WHEN 'segment' THEN format('segment_position %s NULLS LAST, lower(company_trade_name), lower(name)', v_dir)
    WHEN 'email' THEN format('lower(email) %s NULLS LAST', v_dir)
    WHEN 'phone' THEN format('phone %s NULLS LAST', v_dir)
    WHEN 'leads_count' THEN format('leads_count %s', v_dir)
    WHEN 'primary_count' THEN format('primary_count %s', v_dir)
    WHEN 'created_at' THEN format('created_at %s', v_dir)
    ELSE format('lower(name) %s', v_dir) END || ', id';

  CREATE TEMP TABLE IF NOT EXISTS _lct_ids (id uuid, ord bigint) ON COMMIT DROP;
  TRUNCATE _lct_ids;
  EXECUTE format($q$
    INSERT INTO _lct_ids SELECT id, row_number() OVER (ORDER BY %s) FROM public.contacts_overview o
    WHERE o.organization_id = $1
      AND ($2 IS NULL OR public.normalize_company_key(o.name) LIKE '%%'||$2||'%%'
           OR lower(coalesce(o.email,'')) LIKE '%%'||$4||'%%'
           OR (length($3) >= 3 AND regexp_replace(coalesce(o.phone,''),'\D','','g') LIKE '%%'||$3||'%%'))
      AND ($5 IS NULL OR o.company_id = $5)
      AND (cardinality($6) = 0 OR o.segment_id::text = ANY($6) OR ('__none__' = ANY($6) AND o.segment_id IS NULL))
      AND (coalesce($7,'') = '' OR ($7 = 'yes') = (nullif(btrim(o.email),'') IS NOT NULL))
      AND (coalesce($8,'') = '' OR ($8 = 'yes') = (nullif(btrim(o.phone),'') IS NOT NULL))
      AND (coalesce($9,'') = '' OR ($9 = 'yes') = o.in_active_lead)
      AND ($10 IS NULL OR o.created_at >= $10)
      AND ($11 IS NULL OR o.created_at <= $11)
  $q$, v_order)
  USING p_org, v_k, v_d, v_raw, (f->>'company_id')::uuid, v_segs, f->>'has_email', f->>'has_phone', f->>'in_active',
        (f->>'created_from')::timestamptz, (f->>'created_to')::timestamptz;

  SELECT count(*) INTO v_total FROM _lct_ids;
  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY i.ord), '[]') INTO v_rows
  FROM (SELECT * FROM _lct_ids ORDER BY ord
        OFFSET CASE WHEN p_page_size IS NULL THEN 0 ELSE p_page * p_page_size END
        LIMIT coalesce(p_page_size, 20000)) i
  JOIN public.contacts_overview o ON o.id = i.id;
  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END $$;

-- STABLE functions cannot create temp tables; mark VOLATILE
ALTER FUNCTION public.list_companies(uuid, jsonb, text, text, int, int) VOLATILE;
ALTER FUNCTION public.list_contacts(uuid, jsonb, text, text, int, int) VOLATILE;

CREATE OR REPLACE FUNCTION public.validate_activity_type()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.activity_type NOT IN ('note','call','email','meeting','stage_change','field_update','task_created','task_completed','webhook_sent','webhook_failed','company_merge','contact_merge') THEN
    RAISE EXCEPTION 'Invalid activity_type: %', NEW.activity_type;
  END IF;
  RETURN NEW;
END $$;

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
      IF lk.is_primary THEN
        UPDATE public.lead_contacts SET is_primary = true WHERE lead_id = lk.lead_id AND contact_id = p_keep;
      END IF;
      DELETE FROM public.lead_contacts WHERE id = lk.id;
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

REVOKE ALL ON FUNCTION public.list_companies(uuid, jsonb, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_companies(uuid, jsonb, text, text, int, int) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_contacts(uuid, jsonb, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_contacts(uuid, jsonb, text, text, int, int) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.merge_contacts(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_contacts(uuid, uuid) TO authenticated, service_role;