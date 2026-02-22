
-- Create archive_reasons table
CREATE TABLE public.archive_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archive_reasons ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view archive reasons"
  ON public.archive_reasons FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert archive reasons"
  ON public.archive_reasons FOR INSERT
  WITH CHECK (get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

CREATE POLICY "Owner/admin can update archive reasons"
  ON public.archive_reasons FOR UPDATE
  USING (get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

CREATE POLICY "Owner/admin can delete archive reasons"
  ON public.archive_reasons FOR DELETE
  USING (get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

-- Add columns to leads
ALTER TABLE public.leads
  ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN archive_reason_id UUID DEFAULT NULL REFERENCES public.archive_reasons(id) ON DELETE SET NULL;

-- Update create_organization_with_owner to seed default reasons
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name text, p_slug text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (p_name, p_slug)
  RETURNING * INTO v_org;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_org.id, v_user_id, 'owner', now());

  -- Seed default archive reasons
  INSERT INTO public.archive_reasons (organization_id, label, position) VALUES
    (v_org.id, 'Contratou concorrente', 0),
    (v_org.id, 'Não tem perfil de cliente ideal', 1),
    (v_org.id, 'Demora no follow-up', 2);

  RETURN v_org;
END;
$function$;
