
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  role public.org_role NOT NULL DEFAULT 'member',
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invites_org ON public.organization_invites(organization_id);
CREATE INDEX idx_org_invites_token ON public.organization_invites(token);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/admin can view invites"
ON public.organization_invites FOR SELECT
USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

CREATE POLICY "Owner/admin can insert invites"
ON public.organization_invites FOR INSERT
WITH CHECK (
  public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin'])
  AND created_by = auth.uid()
);

CREATE POLICY "Owner/admin can update invites"
ON public.organization_invites FOR UPDATE
USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

CREATE POLICY "Owner/admin can delete invites"
ON public.organization_invites FOR DELETE
USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

-- Resolve token to public-safe info
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.organization_invites;
  v_org_name text;
  v_valid boolean;
  v_reason text;
BEGIN
  SELECT * INTO v_inv FROM public.organization_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_inv.organization_id;

  v_valid := true;
  IF v_inv.revoked_at IS NOT NULL THEN
    v_valid := false; v_reason := 'revoked';
  ELSIF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    v_valid := false; v_reason := 'expired';
  ELSIF v_inv.max_uses IS NOT NULL AND v_inv.uses_count >= v_inv.max_uses THEN
    v_valid := false; v_reason := 'exhausted';
  END IF;

  RETURN jsonb_build_object(
    'valid', v_valid,
    'reason', v_reason,
    'organization_id', v_inv.organization_id,
    'organization_name', v_org_name,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at,
    'max_uses', v_inv.max_uses,
    'uses_count', v_inv.uses_count
  );
END;
$$;

-- Accept invite as authenticated user
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_inv public.organization_invites;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM public.organization_invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite revoked';
  END IF;
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;
  IF v_inv.max_uses IS NOT NULL AND v_inv.uses_count >= v_inv.max_uses THEN
    RAISE EXCEPTION 'Invite exhausted';
  END IF;

  -- If already a member, do nothing but return success
  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_inv.organization_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('organization_id', v_inv.organization_id, 'already_member', true);
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_inv.organization_id, v_user_id, v_inv.role, now());

  UPDATE public.organization_invites
  SET uses_count = uses_count + 1
  WHERE id = v_inv.id;

  RETURN jsonb_build_object('organization_id', v_inv.organization_id, 'already_member', false);
END;
$$;
