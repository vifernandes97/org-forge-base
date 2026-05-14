-- Create contacts table (1:1 with leads)
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  lead_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  email text,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_org ON public.contacts(organization_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contacts" ON public.contacts FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Owner/admin/member can insert contacts" ON public.contacts FOR INSERT
  WITH CHECK (get_user_org_role(organization_id) = ANY (ARRAY['owner','admin','member']));
CREATE POLICY "Owner/admin/member can update contacts" ON public.contacts FOR UPDATE
  USING (get_user_org_role(organization_id) = ANY (ARRAY['owner','admin','member']));
CREATE POLICY "Owner/admin can delete contacts" ON public.contacts FOR DELETE
  USING (get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: create one contact per existing lead
INSERT INTO public.contacts (organization_id, lead_id, name, email, phone)
SELECT organization_id, id, COALESCE(name, ''), email, phone
FROM public.leads
ON CONFLICT (lead_id) DO NOTHING;

-- Sync trigger: contact -> lead (mirror name/email/phone)
CREATE OR REPLACE FUNCTION public.sync_contact_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.leads
  SET name = COALESCE(NEW.name, ''),
      email = NEW.email,
      phone = NEW.phone
  WHERE id = NEW.lead_id
    AND (
      COALESCE(name,'') IS DISTINCT FROM COALESCE(NEW.name,'') OR
      COALESCE(email,'') IS DISTINCT FROM COALESCE(NEW.email,'') OR
      COALESCE(phone,'') IS DISTINCT FROM COALESCE(NEW.phone,'')
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_contact_to_lead_trg
  AFTER INSERT OR UPDATE OF name, email, phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.sync_contact_to_lead();

-- Sync trigger: lead -> contact (auto-create on insert, mirror on update)
CREATE OR REPLACE FUNCTION public.sync_lead_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contacts (organization_id, lead_id, name, email, phone)
    VALUES (NEW.organization_id, NEW.id, COALESCE(NEW.name, ''), NEW.email, NEW.phone)
    ON CONFLICT (lead_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.contacts
    SET name = COALESCE(NEW.name, ''),
        email = NEW.email,
        phone = NEW.phone
    WHERE lead_id = NEW.id
      AND (
        COALESCE(name,'') IS DISTINCT FROM COALESCE(NEW.name,'') OR
        COALESCE(email,'') IS DISTINCT FROM COALESCE(NEW.email,'') OR
        COALESCE(phone,'') IS DISTINCT FROM COALESCE(NEW.phone,'')
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_lead_to_contact_ins_trg
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_contact();

CREATE TRIGGER sync_lead_to_contact_upd_trg
  AFTER UPDATE OF name, email, phone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_contact();