CREATE TABLE public.company_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX company_segments_org_key_uniq ON public.company_segments (organization_id, public.normalize_company_key(label));
CREATE INDEX company_segments_org_idx ON public.company_segments (organization_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_segments TO authenticated;
GRANT ALL ON public.company_segments TO service_role;
ALTER TABLE public.company_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view company segments" ON public.company_segments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));
CREATE POLICY "Owner/admin can insert company segments" ON public.company_segments FOR INSERT TO authenticated
  WITH CHECK (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));
CREATE POLICY "Owner/admin can update company segments" ON public.company_segments FOR UPDATE TO authenticated
  USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));
CREATE POLICY "Owner/admin can delete company segments" ON public.company_segments FOR DELETE TO authenticated
  USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));
CREATE TRIGGER update_company_segments_updated_at BEFORE UPDATE ON public.company_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.companies ADD COLUMN segment_id uuid REFERENCES public.company_segments(id) ON DELETE RESTRICT;
CREATE INDEX companies_segment_id_idx ON public.companies (segment_id);

-- Backfill: one segment per distinct normalized value per org
INSERT INTO public.company_segments (organization_id, label, position)
SELECT organization_id, label, (row_number() OVER (PARTITION BY organization_id ORDER BY label) - 1)::int
FROM (
  SELECT DISTINCT ON (organization_id, public.normalize_company_key(segment)) organization_id, btrim(segment) AS label
  FROM public.companies
  WHERE public.normalize_company_key(segment) IS NOT NULL
  ORDER BY organization_id, public.normalize_company_key(segment), btrim(segment)
) s;
UPDATE public.companies c SET segment_id = s.id
FROM public.company_segments s
WHERE s.organization_id = c.organization_id
  AND public.normalize_company_key(c.segment) = public.normalize_company_key(s.label);

COMMENT ON COLUMN public.companies.segment IS 'DEPRECATED: replaced by segment_id (company_segments). Remove in phase 4.';

-- Segment id resolver (aliases kept from phase 1 mapping)
CREATE OR REPLACE FUNCTION public.company_segment_id_from_value(p_org uuid, p_value text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text := public.normalize_company_key(p_value); v_id uuid;
BEGIN
  IF k IS NULL THEN RETURN NULL; END IF;
  k := CASE k
    WHEN 'infantil' THEN 'buffet infantil'
    WHEN 'espaco para eventos' THEN 'espaco de eventos'
    WHEN 'decoracao' THEN 'decoracao / fotografia'
    WHEN 'sou fotografa' THEN 'decoracao / fotografia'
    WHEN 'producao de eventos' THEN 'produtora de eventos'
    WHEN 'casamento / corportativo' THEN 'casamento / corporativo'
    ELSE k END;
  SELECT id INTO v_id FROM public.company_segments
   WHERE organization_id = p_org AND public.normalize_company_key(label) = k LIMIT 1;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.company_segment_from_value(p_org uuid, p_value text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT label FROM public.company_segments WHERE id = public.company_segment_id_from_value(p_org, p_value)
$$;

CREATE OR REPLACE FUNCTION public.resolve_company(p_org uuid, p_company text, p_company_name text, p_instagram text, p_lead_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_seg uuid := public.company_segment_id_from_value(p_org, p_company);
  v_rs text := nullif(btrim(p_company_name),'');
  v_ig text := nullif(btrim(p_instagram),'');
  v_trade text; v_legal text; v_key text; v_id uuid;
BEGIN
  IF v_seg IS NULL AND NOT public.is_blank_company_value(p_company) THEN
    v_trade := btrim(p_company); v_legal := v_rs; v_key := public.normalize_company_key(p_company);
  ELSIF v_rs IS NOT NULL THEN
    v_trade := v_rs; v_key := public.normalize_company_key(v_rs);
    v_legal := CASE WHEN lower(v_rs) ~ '(^|[^a-z])(ltda|me|epp|eireli|s/a|s\.a\.?|sa)\.?$' THEN v_rs ELSE NULL END;
  ELSE
    v_trade := coalesce(nullif(btrim(ltrim(coalesce(v_ig,''),'@')),''), nullif(btrim(p_lead_name),''), 'Sem nome');
    v_key := NULL; v_legal := NULL;
  END IF;
  IF v_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.companies WHERE organization_id = p_org AND match_key = v_key;
    IF v_id IS NOT NULL THEN
      UPDATE public.companies SET
        instagram = coalesce(instagram, v_ig),
        segment_id = coalesce(segment_id, v_seg),
        legal_name = coalesce(legal_name, v_legal)
       WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;
  INSERT INTO public.companies (organization_id, trade_name, legal_name, instagram, match_key, segment_id)
  VALUES (p_org, v_trade, v_legal, v_ig, v_key, v_seg)
  ON CONFLICT (organization_id, match_key) WHERE match_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.companies WHERE organization_id = p_org AND match_key = v_key;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.bridge_lead_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- TEMPORÁRIO: remover na fase 4
DECLARE v_new_key text; v_old_key text; v_seg uuid; v_rs text;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_company(NEW.organization_id, NEW.company, NEW.company_name, NEW.company_instagram, NEW.name);
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN RETURN NEW; END IF;
  IF NEW.company IS NOT DISTINCT FROM OLD.company AND NEW.company_name IS NOT DISTINCT FROM OLD.company_name
     AND NEW.company_instagram IS NOT DISTINCT FROM OLD.company_instagram THEN
    RETURN NEW;
  END IF;
  v_new_key := public.lead_company_key(NEW.organization_id, NEW.company, NEW.company_name);
  v_old_key := public.lead_company_key(OLD.organization_id, OLD.company, OLD.company_name);
  IF v_new_key IS DISTINCT FROM v_old_key THEN
    NEW.company_id := public.resolve_company(NEW.organization_id, NEW.company, NEW.company_name, NEW.company_instagram, NEW.name);
    RETURN NEW;
  END IF;
  v_seg := public.company_segment_id_from_value(NEW.organization_id, NEW.company);
  v_rs := nullif(btrim(NEW.company_name),'');
  UPDATE public.companies SET
    segment_id = coalesce(v_seg, segment_id),
    instagram = CASE WHEN NEW.company_instagram IS DISTINCT FROM OLD.company_instagram
                     THEN nullif(btrim(NEW.company_instagram),'') ELSE instagram END,
    legal_name = CASE
      WHEN v_seg IS NULL AND NOT public.is_blank_company_value(NEW.company) THEN coalesce(v_rs, legal_name)
      WHEN v_rs IS NOT NULL AND lower(v_rs) ~ '(^|[^a-z])(ltda|me|epp|eireli|s/a|s\.a\.?|sa)\.?$' THEN v_rs
      ELSE legal_name END
  WHERE id = NEW.company_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.merge_companies(p_target uuid, p_source uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    segment_id = coalesce(segment_id, v_s.segment_id),
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

CREATE OR REPLACE FUNCTION public.add_company_segment(p_org_id uuid, p_label text)
RETURNS public.company_segments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_label text := regexp_replace(btrim(coalesce(p_label,'')), '\s+', ' ', 'g'); v_row public.company_segments;
BEGIN
  IF v_label = '' THEN RAISE EXCEPTION 'Segmento inválido'; END IF;
  IF coalesce(public.get_user_org_role(p_org_id),'') NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO v_row FROM public.company_segments
   WHERE organization_id = p_org_id AND public.normalize_company_key(label) = public.normalize_company_key(v_label) LIMIT 1;
  IF v_row.id IS NOT NULL THEN
    IF NOT v_row.is_active THEN
      UPDATE public.company_segments SET is_active = true WHERE id = v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;
  INSERT INTO public.company_segments (organization_id, label, position)
  VALUES (p_org_id, v_label, coalesce((SELECT max(position)+1 FROM public.company_segments WHERE organization_id = p_org_id), 0))
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.reorder_company_segments(p_org_id uuid, p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(public.get_user_org_role(p_org_id),'') NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.company_segments s SET position = x.ord - 1
  FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
  WHERE s.id = x.id AND s.organization_id = p_org_id;
END $$;

CREATE OR REPLACE FUNCTION public.merge_company_segments(p_source uuid, p_target uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_s public.company_segments; v_t public.company_segments; v_n int;
BEGIN
  IF p_source = p_target THEN RAISE EXCEPTION 'Escolha um segmento diferente'; END IF;
  SELECT * INTO v_s FROM public.company_segments WHERE id = p_source;
  SELECT * INTO v_t FROM public.company_segments WHERE id = p_target;
  IF v_s.id IS NULL OR v_t.id IS NULL OR v_s.organization_id <> v_t.organization_id THEN RAISE EXCEPTION 'Segmento não encontrado'; END IF;
  IF coalesce(public.get_user_org_role(v_s.organization_id),'') NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.companies SET segment_id = p_target WHERE segment_id = p_source;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.company_segments SET is_active = false WHERE id = p_source;
  RETURN v_n;
END $$;

REVOKE ALL ON FUNCTION public.company_segment_id_from_value(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_company_segment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_company_segments(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merge_company_segments(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_company_segment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_company_segments(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_company_segments(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.company_segment_from_value(uuid, text) FROM PUBLIC, anon, authenticated;