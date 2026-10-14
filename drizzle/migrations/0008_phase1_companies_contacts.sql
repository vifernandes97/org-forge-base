-- FASE 1: Empresas e Contatos
-- 1. companies
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trade_name text NOT NULL,
  legal_name text,
  cnpj text,
  instagram text,
  match_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_cnpj_digits CHECK (cnpj IS NULL OR cnpj ~ '^\d{14}$')
);
COMMENT ON COLUMN public.companies.match_key IS 'Chave normalizada lower(trim(coalesce(razao social, nome fantasia))) usada pela ponte temporaria da fase 1; null para empresas criadas a partir do nome do negocio';
CREATE INDEX IF NOT EXISTS companies_org_idx ON public.companies(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS companies_org_cnpj_uidx ON public.companies(organization_id, cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS companies_org_match_key_uidx ON public.companies(organization_id, match_key) WHERE match_key IS NOT NULL;
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view companies" ON public.companies FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));
CREATE POLICY "Owner/admin/member can insert companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin','member']));
CREATE POLICY "Owner/admin/member can update companies" ON public.companies FOR UPDATE TO authenticated
  USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin','member']));
CREATE POLICY "Owner/admin can delete companies" ON public.companies FOR DELETE TO authenticated
  USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

-- 2. contacts
DROP TRIGGER IF EXISTS sync_contact_to_lead_trg ON public.contacts;
DROP TRIGGER IF EXISTS sync_lead_to_contact_ins_trg ON public.leads;
DROP TRIGGER IF EXISTS sync_lead_to_contact_upd_trg ON public.leads;
DROP FUNCTION IF EXISTS public.sync_contact_to_lead();
DROP FUNCTION IF EXISTS public.sync_lead_to_contact();

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_lead_id_key;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_lead_id_fkey;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ALTER COLUMN lead_id DROP NOT NULL;
COMMENT ON COLUMN public.contacts.lead_id IS 'DEPRECATED: substituida por lead_contacts; nao lida pelo app; remover na fase 4';
CREATE INDEX IF NOT EXISTS contacts_company_idx ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS contacts_org_email_idx ON public.contacts(organization_id, lower(email));

-- 3. lead_contacts
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_contacts_lead_contact_key UNIQUE (lead_id, contact_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_contacts_one_primary_uidx ON public.lead_contacts(lead_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS lead_contacts_contact_idx ON public.lead_contacts(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_contacts TO authenticated;
GRANT ALL ON public.lead_contacts TO service_role;
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view lead_contacts" ON public.lead_contacts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));
CREATE POLICY "Owner/admin/member can insert lead_contacts" ON public.lead_contacts FOR INSERT TO authenticated
  WITH CHECK (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin','member']));
CREATE POLICY "Owner/admin/member can update lead_contacts" ON public.lead_contacts FOR UPDATE TO authenticated
  USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin','member']));
CREATE POLICY "Owner/admin can delete lead_contacts" ON public.lead_contacts FOR DELETE TO authenticated
  USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

CREATE OR REPLACE FUNCTION public.validate_lead_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead public.leads; v_contact public.contacts;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
  SELECT * INTO v_contact FROM public.contacts WHERE id = NEW.contact_id;
  IF v_lead.organization_id IS DISTINCT FROM NEW.organization_id
     OR v_contact.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Contato e negócio devem pertencer à mesma organização';
  END IF;
  IF v_lead.company_id IS NULL OR v_contact.company_id IS DISTINCT FROM v_lead.company_id THEN
    RAISE EXCEPTION 'Contato deve pertencer à mesma empresa do negócio';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_lead_contact_trg ON public.lead_contacts;
CREATE TRIGGER validate_lead_contact_trg BEFORE INSERT OR UPDATE ON public.lead_contacts
  FOR EACH ROW EXECUTE FUNCTION public.validate_lead_contact();

-- 4. leads.company_id
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS leads_company_idx ON public.leads(company_id);

-- Helpers
CREATE OR REPLACE FUNCTION public.company_match_key(p_company_name text, p_company text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(lower(btrim(coalesce(nullif(btrim(p_company_name),''), nullif(btrim(p_company),'')))), '')
$$;

CREATE OR REPLACE FUNCTION public.resolve_company(p_org uuid, p_company text, p_company_name text, p_instagram text, p_lead_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text := public.company_match_key(p_company_name, p_company); v_id uuid;
BEGIN
  IF v_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.companies WHERE organization_id = p_org AND match_key = v_key;
    IF v_id IS NOT NULL THEN
      UPDATE public.companies SET instagram = nullif(btrim(p_instagram),'')
       WHERE id = v_id AND instagram IS NULL AND nullif(btrim(p_instagram),'') IS NOT NULL;
      RETURN v_id;
    END IF;
  END IF;
  INSERT INTO public.companies (organization_id, trade_name, legal_name, instagram, match_key)
  VALUES (p_org,
          coalesce(nullif(btrim(p_company),''), nullif(btrim(p_company_name),''), nullif(btrim(p_lead_name),''), 'Sem nome'),
          nullif(btrim(p_company_name),''), nullif(btrim(p_instagram),''), v_key)
  ON CONFLICT (organization_id, match_key) WHERE match_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.companies WHERE organization_id = p_org AND match_key = v_key;
  END IF;
  RETURN v_id;
END $$;

-- Dedup: e-mail quando ambos têm e-mail; telefone só se nenhum tem e-mail e nomes normalizados iguais
CREATE OR REPLACE FUNCTION public.find_company_contact(p_company uuid, p_name text, p_email text, p_phone text, p_exclude uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := nullif(lower(btrim(p_email)),'');
        v_digits text := nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),'');
        v_name text := lower(btrim(coalesce(p_name,''))); v_id uuid;
BEGIN
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM public.contacts
     WHERE company_id = p_company AND lower(btrim(email)) = v_email AND (p_exclude IS NULL OR id <> p_exclude)
     ORDER BY created_at LIMIT 1;
  ELSIF v_digits IS NOT NULL THEN
    SELECT id INTO v_id FROM public.contacts
     WHERE company_id = p_company AND nullif(btrim(email),'') IS NULL
       AND regexp_replace(coalesce(phone,''),'\D','','g') = v_digits
       AND lower(btrim(coalesce(name,''))) = v_name
       AND (p_exclude IS NULL OR id <> p_exclude)
     ORDER BY created_at LIMIT 1;
  END IF;
  RETURN v_id;
END $$;

-- 5. Backfill (idempotente: só negócios sem company_id)
ALTER TABLE public.leads DISABLE TRIGGER USER;
DO $$
DECLARE r RECORD; v_company uuid; c public.contacts; v_dup uuid; v_contact uuid;
BEGIN
  FOR r IN SELECT * FROM public.leads WHERE company_id IS NULL ORDER BY created_at LOOP
    v_company := public.resolve_company(r.organization_id, r.company, r.company_name, r.company_instagram, r.name);
    UPDATE public.leads SET company_id = v_company WHERE id = r.id;
    v_contact := NULL;
    c := NULL;
    SELECT * INTO c FROM public.contacts WHERE lead_id = r.id AND company_id IS NULL ORDER BY created_at LIMIT 1;
    IF c.id IS NOT NULL THEN
      IF coalesce(btrim(c.name),'') = '' AND coalesce(btrim(c.email),'') = '' AND coalesce(btrim(c.phone),'') = '' THEN
        DELETE FROM public.contacts WHERE id = c.id;
      ELSE
        v_dup := public.find_company_contact(v_company, c.name, c.email, c.phone, c.id);
        IF v_dup IS NOT NULL THEN
          DELETE FROM public.contacts WHERE id = c.id;
          v_contact := v_dup;
        ELSE
          UPDATE public.contacts SET company_id = v_company WHERE id = c.id;
          v_contact := c.id;
        END IF;
      END IF;
    ELSIF coalesce(btrim(r.name),'') <> '' OR coalesce(btrim(r.email),'') <> '' OR coalesce(btrim(r.phone),'') <> '' THEN
      v_contact := public.find_company_contact(v_company, r.name, r.email, r.phone);
      IF v_contact IS NULL THEN
        INSERT INTO public.contacts (organization_id, company_id, name, email, phone)
        VALUES (r.organization_id, v_company, coalesce(r.name,''), nullif(btrim(r.email),''), nullif(btrim(r.phone),''))
        RETURNING id INTO v_contact;
      END IF;
    END IF;
    IF v_contact IS NOT NULL THEN
      INSERT INTO public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
      VALUES (r.organization_id, r.id, v_contact, true)
      ON CONFLICT (lead_id, contact_id) DO NOTHING;
    END IF;
  END LOOP;
  DELETE FROM public.contacts WHERE company_id IS NULL;
END $$;
ALTER TABLE public.leads ENABLE TRIGGER USER;

-- 6. PONTE DE COMPATIBILIDADE TEMPORÁRIA — REMOVER NA FASE 4
CREATE OR REPLACE FUNCTION public.bridge_lead_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- TEMPORÁRIO: remover na fase 4
DECLARE v_new_key text := public.company_match_key(NEW.company_name, NEW.company);
        v_old_key text;
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_company(NEW.organization_id, NEW.company, NEW.company_name, NEW.company_instagram, NEW.name);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.company_id = OLD.company_id THEN
    v_old_key := public.company_match_key(OLD.company_name, OLD.company);
    IF v_new_key IS DISTINCT FROM v_old_key THEN
      NEW.company_id := public.resolve_company(NEW.organization_id, NEW.company, NEW.company_name, NEW.company_instagram, NEW.name);
    ELSIF NEW.company IS DISTINCT FROM OLD.company OR NEW.company_name IS DISTINCT FROM OLD.company_name
          OR NEW.company_instagram IS DISTINCT FROM OLD.company_instagram THEN
      UPDATE public.companies SET
        trade_name = coalesce(nullif(btrim(NEW.company),''), trade_name),
        legal_name = CASE WHEN nullif(btrim(NEW.company_name),'') IS NOT NULL THEN btrim(NEW.company_name) ELSE legal_name END,
        instagram = CASE WHEN NEW.company_instagram IS DISTINCT FROM OLD.company_instagram
                         THEN nullif(btrim(NEW.company_instagram),'') ELSE instagram END
      WHERE id = NEW.company_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.bridge_lead_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- TEMPORÁRIO: remover na fase 4
DECLARE v_contact uuid; v_cur public.contacts;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id
     AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.email IS NOT DISTINCT FROM OLD.email
     AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
    RETURN NULL;
  END IF;
  IF NEW.company_id IS NULL THEN RETURN NULL; END IF;

  IF TG_OP = 'UPDATE' AND NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    DELETE FROM public.lead_contacts WHERE lead_id = NEW.id;
  END IF;

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

DROP TRIGGER IF EXISTS bridge_lead_company_trg ON public.leads;
CREATE TRIGGER bridge_lead_company_trg BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.bridge_lead_company();
DROP TRIGGER IF EXISTS bridge_lead_contact_trg ON public.leads;
CREATE TRIGGER bridge_lead_contact_trg AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.bridge_lead_contact();
-- FIM DA PONTE TEMPORÁRIA

-- 8. Mesclagem: quando merge_leads marca o duplicado (merged_into_lead_id), mover os vínculos de contato
CREATE OR REPLACE FUNCTION public.move_lead_contacts_on_merge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_primary_company uuid;
BEGIN
  IF NEW.merged_into_lead_id IS NULL OR OLD.merged_into_lead_id IS NOT DISTINCT FROM NEW.merged_into_lead_id THEN
    RETURN NULL;
  END IF;
  SELECT company_id INTO v_primary_company FROM public.leads WHERE id = NEW.merged_into_lead_id;
  -- empresa do principal prevalece; só contatos dessa empresa podem ser vinculados; principal mantém seu único is_primary
  INSERT INTO public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
  SELECT lc.organization_id, NEW.merged_into_lead_id, lc.contact_id, false
  FROM public.lead_contacts lc JOIN public.contacts c ON c.id = lc.contact_id
  WHERE lc.lead_id = NEW.id AND c.company_id = v_primary_company
  ON CONFLICT (lead_id, contact_id) DO NOTHING;
  DELETE FROM public.lead_contacts lc USING public.contacts c
  WHERE lc.lead_id = NEW.id AND c.id = lc.contact_id AND c.company_id = v_primary_company;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS move_lead_contacts_on_merge_trg ON public.leads;
CREATE TRIGGER move_lead_contacts_on_merge_trg AFTER UPDATE OF merged_into_lead_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.move_lead_contacts_on_merge();

-- 7. Segurança das funções
REVOKE EXECUTE ON FUNCTION public.validate_lead_contact() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_company(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_company_contact(uuid,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bridge_lead_company() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bridge_lead_contact() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_lead_contacts_on_merge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.company_match_key(text,text) FROM PUBLIC, anon;
