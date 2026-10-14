-- FASE 1b: segmentos, normalização com unaccent e reagrupamento de empresas
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS segment text;
CREATE INDEX IF NOT EXISTS companies_org_segment_idx ON public.companies(organization_id, segment) WHERE segment IS NOT NULL;

-- Chave normalizada: remove invisíveis, unaccent (dicionário explícito), lower, espaços múltiplos -> um, trim
CREATE OR REPLACE FUNCTION public.normalize_company_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, extensions AS $$
  SELECT nullif(btrim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary,
      regexp_replace(coalesce(p,''), '[\u200B-\u200D\u2060\uFEFF\u00AD]', '', 'g'))),
    '[[:space:]\u00A0]+', ' ', 'g')), '')
$$;

-- Segmento padronizado a partir do valor do campo Empresa (mapa conhecido + segmentos já existentes na organização)
CREATE OR REPLACE FUNCTION public.company_segment_from_value(p_org uuid, p_value text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text := public.normalize_company_key(p_value); v text;
BEGIN
  IF k IS NULL THEN RETURN NULL; END IF;
  v := CASE k
    WHEN 'buffet infantil' THEN 'Buffet Infantil'
    WHEN 'infantil' THEN 'Buffet Infantil'
    WHEN 'buffet itinerante' THEN 'Buffet Itinerante'
    WHEN 'espaco de eventos' THEN 'Espaço de Eventos'
    WHEN 'espaco para eventos' THEN 'Espaço de Eventos'
    WHEN 'decoracao / fotografia' THEN 'Decoração / Fotografia'
    WHEN 'decoracao' THEN 'Decoração / Fotografia'
    WHEN 'sou fotografa' THEN 'Decoração / Fotografia'
    WHEN 'produtora de eventos' THEN 'Produtora de Eventos'
    WHEN 'producao de eventos' THEN 'Produtora de Eventos'
    WHEN 'casamento / corportativo' THEN 'Casamento / Corporativo'
    WHEN 'casamento / corporativo' THEN 'Casamento / Corporativo'
    ELSE NULL END;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT segment INTO v FROM public.companies
   WHERE organization_id = p_org AND segment IS NOT NULL AND public.normalize_company_key(segment) = k LIMIT 1;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.is_blank_company_value(p_value text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT public.normalize_company_key(p_value) IS NULL
      OR position('@' in p_value) > 0
      OR public.normalize_company_key(p_value) IN ('festa','restaurante','n/a','no','n tenho','particular','privado',
           'pessoa fisica','sem nome ainda','bb','50 anos','poderoso chefinho gael')
$$;

-- Chave de empresa de um negócio (null = empresa individual por negócio)
CREATE OR REPLACE FUNCTION public.lead_company_key(p_org uuid, p_company text, p_company_name text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.company_segment_from_value(p_org, p_company) IS NULL AND NOT public.is_blank_company_value(p_company) THEN
    RETURN public.normalize_company_key(p_company);
  END IF;
  RETURN public.normalize_company_key(p_company_name);
END $$;

CREATE OR REPLACE FUNCTION public.resolve_company(p_org uuid, p_company text, p_company_name text, p_instagram text, p_lead_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seg text := public.company_segment_from_value(p_org, p_company);
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
        segment = coalesce(segment, v_seg),
        legal_name = coalesce(legal_name, v_legal)
       WHERE id = v_id;
      RETURN v_id;
    END IF;
  END IF;
  INSERT INTO public.companies (organization_id, trade_name, legal_name, instagram, match_key, segment)
  VALUES (p_org, v_trade, v_legal, v_ig, v_key, v_seg)
  ON CONFLICT (organization_id, match_key) WHERE match_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.companies WHERE organization_id = p_org AND match_key = v_key;
  END IF;
  RETURN v_id;
END $$;

-- PONTE TEMPORÁRIA (remover na fase 4): nova regra de empresa/segmento
CREATE OR REPLACE FUNCTION public.bridge_lead_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- TEMPORÁRIO: remover na fase 4
DECLARE v_new_key text; v_old_key text; v_seg text; v_rs text;
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
  v_seg := public.company_segment_from_value(NEW.organization_id, NEW.company);
  v_rs := nullif(btrim(NEW.company_name),'');
  UPDATE public.companies SET
    segment = coalesce(v_seg, segment),
    instagram = CASE WHEN NEW.company_instagram IS DISTINCT FROM OLD.company_instagram
                     THEN nullif(btrim(NEW.company_instagram),'') ELSE instagram END,
    legal_name = CASE
      WHEN v_seg IS NULL AND NOT public.is_blank_company_value(NEW.company) THEN coalesce(v_rs, legal_name)
      WHEN v_rs IS NOT NULL AND lower(v_rs) ~ '(^|[^a-z])(ltda|me|epp|eireli|s/a|s\.a\.?|sa)\.?$' THEN v_rs
      ELSE legal_name END
  WHERE id = NEW.company_id;
  RETURN NEW;
END $$;

-- Reagrupamento (dados): negócios de teste interno não são alterados
ALTER TABLE public.leads DISABLE TRIGGER USER;
DO $$
DECLARE r RECORD; v_target uuid; c public.contacts; v_dup uuid; v_new uuid; v_others boolean;
BEGIN
  -- libera chaves antigas (exceto empresas que hospedam negócios de teste)
  UPDATE public.companies SET match_key = NULL
   WHERE id NOT IN (SELECT company_id FROM public.leads
                     WHERE company_id IS NOT NULL
                       AND public.normalize_company_key(company) IN ('teste','thavia teste','vinicius','neosoluti'));
  UPDATE public.companies SET match_key = public.normalize_company_key(match_key) WHERE match_key IS NOT NULL;

  FOR r IN
    SELECT l.*, pc.id AS pc_id, pc.name AS pc_name
    FROM public.leads l
    LEFT JOIN public.lead_contacts lc ON lc.lead_id = l.id AND lc.is_primary
    LEFT JOIN public.contacts pc ON pc.id = lc.contact_id
    WHERE coalesce(public.normalize_company_key(l.company),'') NOT IN ('teste','thavia teste','vinicius','neosoluti')
    ORDER BY l.created_at
  LOOP
    v_target := public.resolve_company(r.organization_id, r.company, r.company_name, r.company_instagram,
                                       coalesce(nullif(btrim(r.pc_name),''), r.name));
    UPDATE public.leads SET company_id = v_target WHERE id = r.id;

    IF r.pc_id IS NOT NULL THEN
      SELECT * INTO c FROM public.contacts WHERE id = r.pc_id;
      IF c.company_id IS DISTINCT FROM v_target THEN
        v_dup := public.find_company_contact(v_target, c.name, c.email, c.phone, c.id);
        v_others := EXISTS (SELECT 1 FROM public.lead_contacts WHERE contact_id = c.id AND lead_id <> r.id);
        DELETE FROM public.lead_contacts WHERE lead_id = r.id AND contact_id = c.id;
        IF v_dup IS NOT NULL THEN
          v_new := v_dup;
        ELSIF NOT v_others THEN
          UPDATE public.contacts SET company_id = v_target WHERE id = c.id;
          v_new := c.id;
        ELSE
          INSERT INTO public.contacts (organization_id, company_id, name, email, phone)
          VALUES (c.organization_id, v_target, c.name, c.email, c.phone) RETURNING id INTO v_new;
        END IF;
        INSERT INTO public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
        VALUES (r.organization_id, r.id, v_new, true)
        ON CONFLICT (lead_id, contact_id) DO UPDATE SET is_primary = true;
        IF v_dup IS NOT NULL AND NOT v_others THEN
          DELETE FROM public.contacts WHERE id = c.id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- limpeza: contatos sem vínculo em empresas sem negócios; depois empresas vazias
  DELETE FROM public.contacts ct
   WHERE NOT EXISTS (SELECT 1 FROM public.lead_contacts lc WHERE lc.contact_id = ct.id)
     AND NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = ct.company_id);
  DELETE FROM public.companies co
   WHERE NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.company_id = co.id)
     AND NOT EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.company_id = co.id);
END $$;
ALTER TABLE public.leads ENABLE TRIGGER USER;

COMMENT ON FUNCTION public.company_match_key(text,text) IS 'DEPRECATED: substituída por normalize_company_key/lead_company_key';

REVOKE EXECUTE ON FUNCTION public.company_segment_from_value(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lead_company_key(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_company(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bridge_lead_company() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_company_key(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_blank_company_value(text) FROM anon;
