ALTER TABLE public.companies ADD COLUMN trade_name_source text NOT NULL DEFAULT 'provided';
ALTER TABLE public.companies ADD CONSTRAINT companies_trade_name_source_chk CHECK (trade_name_source IN ('provided','placeholder'));
COMMENT ON COLUMN public.companies.trade_name_source IS 'provided = trade name came from a company field or manual edit; placeholder = derived from contact name, e-mail, Instagram or ''Sem nome'' (may be replaced by inbound data)';

-- Backfill: placeholder when the trade name equals a contact name/e-mail of the same company, the Instagram, or 'Sem nome'
UPDATE public.companies c SET trade_name_source = 'placeholder'
WHERE public.normalize_company_key(c.trade_name) IS NULL
   OR public.normalize_company_key(c.trade_name) = 'sem nome'
   OR public.normalize_company_key(c.trade_name) = public.normalize_company_key(ltrim(coalesce(c.instagram,''),'@'))
   OR EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
              AND (public.normalize_company_key(ct.name) = public.normalize_company_key(c.trade_name)
                   OR lower(btrim(ct.email)) = lower(btrim(c.trade_name))));

CREATE OR REPLACE FUNCTION public.resolve_company_contact(
  p_org uuid,
  p_trade_name text DEFAULT NULL, p_legal_name text DEFAULT NULL, p_cnpj text DEFAULT NULL,
  p_instagram text DEFAULT NULL, p_segment text DEFAULT NULL, p_segment_hint text DEFAULT NULL,
  p_company_value text DEFAULT NULL,
  p_contact_name text DEFAULT NULL, p_email text DEFAULT NULL, p_phone text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_seg_explicit uuid; v_seg_hint uuid; v_seg_company uuid; v_seg uuid; v_seg_source text;
  v_conflict jsonb := NULL; v_unknown text[] := '{}';
  v_trade text := nullif(btrim(p_trade_name),''); v_legal text := nullif(btrim(p_legal_name),'');
  v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj,''),'\D','','g'),'');
  v_ig text := nullif(btrim(p_instagram),'');
  v_name text := nullif(btrim(p_contact_name),''); v_email text := nullif(lower(btrim(p_email)),'');
  v_phone text := nullif(btrim(p_phone),''); v_digits text;
  v_company uuid; v_company_created boolean := false; v_matched_by text;
  v_contact uuid; v_contact_created boolean := false; v_key text; v_formal boolean;
  v_provided_name text; v_cur record; v_renamed jsonb := NULL; v_new_key text; v_key_taken uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(),'') <> 'service_role' THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  ELSIF coalesce(public.get_user_org_role(p_org),'') NOT IN ('owner','admin','member') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Segment: explicit > hint (tipo_de_negocio) > company value; only active segments
  IF nullif(btrim(p_segment),'') IS NOT NULL THEN
    v_seg_explicit := public.active_segment_id_from_value(p_org, p_segment);
    IF v_seg_explicit IS NULL THEN v_unknown := v_unknown || btrim(p_segment); END IF;
  END IF;
  IF nullif(btrim(p_segment_hint),'') IS NOT NULL THEN
    v_seg_hint := public.active_segment_id_from_value(p_org, p_segment_hint);
    IF v_seg_hint IS NULL THEN v_unknown := v_unknown || btrim(p_segment_hint); END IF;
  END IF;
  v_seg_company := public.active_segment_id_from_value(p_org, p_company_value);
  v_seg := coalesce(v_seg_explicit, v_seg_hint, v_seg_company);
  v_seg_source := CASE WHEN v_seg_explicit IS NOT NULL THEN 'company_segment'
                       WHEN v_seg_hint IS NOT NULL THEN 'tipo_de_negocio'
                       WHEN v_seg_company IS NOT NULL THEN 'company' END;
  IF (SELECT count(DISTINCT x) FROM unnest(ARRAY[v_seg_explicit, v_seg_hint, v_seg_company]) x WHERE x IS NOT NULL) > 1 THEN
    v_conflict := jsonb_build_object(
      'company_segment', (SELECT label FROM company_segments WHERE id = v_seg_explicit),
      'tipo_de_negocio', (SELECT label FROM company_segments WHERE id = v_seg_hint),
      'company', (SELECT label FROM company_segments WHERE id = v_seg_company),
      'used', (SELECT label FROM company_segments WHERE id = v_seg));
  END IF;

  -- Company value: only an ACTIVE segment is a segment; generic/@ -> empty; anything else is the trade name
  IF v_trade IS NOT NULL AND public.is_blank_company_value(v_trade) THEN v_trade := NULL; END IF;
  IF v_trade IS NULL AND v_seg_company IS NULL AND NOT public.is_blank_company_value(p_company_value) THEN
    v_trade := btrim(p_company_value);
  END IF;
  IF v_legal IS NOT NULL AND public.is_blank_company_value(v_legal) THEN v_legal := NULL; END IF;
  IF v_legal IS NOT NULL THEN
    v_formal := lower(v_legal) ~ '(^|[^a-z])(ltda|me|epp|eireli|s/a|s\.a\.?|sa)\.?$';
    IF v_trade IS NULL AND NOT v_formal THEN v_trade := v_legal; v_legal := NULL; END IF;
  END IF;
  v_provided_name := coalesce(v_trade, v_legal);
  IF v_cnpj IS NOT NULL AND length(v_cnpj) <> 14 THEN v_cnpj := NULL; END IF;
  v_digits := nullif(regexp_replace(coalesce(v_phone,''),'\D','','g'),'');

  -- a) CNPJ
  IF v_cnpj IS NOT NULL THEN
    SELECT id INTO v_company FROM companies WHERE organization_id = p_org AND cnpj = v_cnpj LIMIT 1;
    IF v_company IS NOT NULL THEN v_matched_by := 'cnpj'; END IF;
  END IF;
  -- b) existing contact
  IF v_company IS NULL AND v_email IS NOT NULL THEN
    SELECT company_id INTO v_company FROM contacts
     WHERE organization_id = p_org AND lower(btrim(email)) = v_email AND company_id IS NOT NULL ORDER BY created_at LIMIT 1;
    IF v_company IS NOT NULL THEN v_matched_by := 'contact_email'; END IF;
  END IF;
  IF v_company IS NULL AND v_email IS NULL AND v_digits IS NOT NULL AND v_name IS NOT NULL THEN
    SELECT company_id INTO v_company FROM contacts
     WHERE organization_id = p_org AND company_id IS NOT NULL
       AND regexp_replace(coalesce(phone,''),'\D','','g') = v_digits
       AND public.normalize_company_key(name) = public.normalize_company_key(v_name)
     ORDER BY created_at LIMIT 1;
    IF v_company IS NOT NULL THEN v_matched_by := 'contact_phone'; END IF;
  END IF;
  -- c) name key (only real company names)
  v_key := public.normalize_company_key(v_provided_name);
  IF v_company IS NULL AND v_key IS NOT NULL THEN
    SELECT id INTO v_company FROM companies WHERE organization_id = p_org AND match_key = v_key LIMIT 1;
    IF v_company IS NOT NULL THEN v_matched_by := 'name'; END IF;
  END IF;
  -- d) create
  IF v_company IS NULL THEN
    INSERT INTO companies (organization_id, trade_name, legal_name, cnpj, instagram, segment_id, match_key, trade_name_source)
    VALUES (p_org,
      coalesce(v_trade, v_legal, nullif(btrim(ltrim(coalesce(v_ig,''),'@')),''), v_name, v_email, 'Sem nome'),
      v_legal, v_cnpj, v_ig, v_seg, v_key,
      CASE WHEN v_provided_name IS NOT NULL THEN 'provided' ELSE 'placeholder' END)
    RETURNING id INTO v_company;
    v_company_created := true;
  ELSE
    SELECT trade_name, trade_name_source INTO v_cur FROM companies WHERE id = v_company;
    -- Placeholder name (contact/e-mail/Instagram/'Sem nome') is replaced by a real company name; 'provided' is never overwritten
    IF v_cur.trade_name_source = 'placeholder' AND v_provided_name IS NOT NULL THEN
      v_new_key := public.normalize_company_key(v_provided_name);
      SELECT id INTO v_key_taken FROM companies
       WHERE organization_id = p_org AND match_key = v_new_key AND id <> v_company LIMIT 1;
      UPDATE companies SET trade_name = v_provided_name, trade_name_source = 'provided',
        match_key = CASE WHEN v_key_taken IS NULL THEN v_new_key ELSE match_key END
      WHERE id = v_company;
      v_renamed := jsonb_build_object('from', v_cur.trade_name, 'to', v_provided_name,
        'name_key_in_use_by', v_key_taken);
    END IF;
    UPDATE companies SET
      segment_id = coalesce(segment_id, v_seg),
      cnpj = coalesce(cnpj, v_cnpj),
      instagram = coalesce(nullif(btrim(instagram),''), v_ig),
      legal_name = coalesce(nullif(btrim(legal_name),''), v_legal)
    WHERE id = v_company;
  END IF;

  -- Contact
  IF v_name IS NOT NULL OR v_email IS NOT NULL OR v_phone IS NOT NULL THEN
    v_contact := public.find_company_contact(v_company, v_name, v_email, v_phone);
    IF v_contact IS NULL THEN
      INSERT INTO contacts (organization_id, company_id, name, email, phone)
      VALUES (p_org, v_company, coalesce(v_name, ''), v_email, v_phone) RETURNING id INTO v_contact;
      v_contact_created := true;
    ELSE
      UPDATE contacts SET
        name = CASE WHEN coalesce(btrim(name),'') = '' THEN coalesce(v_name, name) ELSE name END,
        email = coalesce(nullif(btrim(email),''), v_email),
        phone = coalesce(nullif(btrim(phone),''), v_phone)
      WHERE id = v_contact;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'company_id', v_company, 'company_created', v_company_created, 'company_matched_by', v_matched_by,
    'company_name_received', v_provided_name,
    'trade_name_source', (SELECT trade_name_source FROM companies WHERE id = v_company),
    'trade_name_replaced', v_renamed,
    'contact_id', v_contact, 'contact_created', v_contact_created,
    'segment_id', v_seg, 'segment', (SELECT label FROM company_segments WHERE id = v_seg), 'segment_source', v_seg_source,
    'segment_applied', (SELECT segment_id = v_seg FROM companies WHERE id = v_company) AND v_seg IS NOT NULL,
    'unknown_segments', to_jsonb(v_unknown), 'segment_conflict', v_conflict);
END $$;

REVOKE ALL ON FUNCTION public.resolve_company_contact(uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_contact(uuid, text, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;