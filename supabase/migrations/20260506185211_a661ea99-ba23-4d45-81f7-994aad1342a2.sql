
CREATE TABLE public.organization_invite_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invite_id uuid NULL,
  invite_token_preview text NULL,
  event_type text NOT NULL,
  actor_user_id uuid NULL,
  actor_email text NULL,
  role public.org_role NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_logs_org_created ON public.organization_invite_logs (organization_id, created_at DESC);
CREATE INDEX idx_invite_logs_invite ON public.organization_invite_logs (invite_id);

ALTER TABLE public.organization_invite_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/admin can view invite logs"
  ON public.organization_invite_logs FOR SELECT
  USING (get_user_org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text]));

-- Validate event_type via trigger
CREATE OR REPLACE FUNCTION public.validate_invite_log_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type NOT IN ('created','copied','revoked','deleted','accepted','accept_failed') THEN
    RAISE EXCEPTION 'Invalid event_type: %', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_invite_log_event
  BEFORE INSERT ON public.organization_invite_logs
  FOR EACH ROW EXECUTE FUNCTION public.validate_invite_log_event();

-- Internal helper to record events
CREATE OR REPLACE FUNCTION public.log_invite_event(
  p_org_id uuid,
  p_invite_id uuid,
  p_token text,
  p_role public.org_role,
  p_event text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_preview text;
BEGIN
  IF p_token IS NOT NULL AND length(p_token) >= 6 THEN
    v_preview := right(p_token, 6);
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;
  END IF;

  INSERT INTO public.organization_invite_logs
    (organization_id, invite_id, invite_token_preview, event_type, actor_user_id, actor_email, role, metadata)
  VALUES
    (p_org_id, p_invite_id, v_preview, p_event, v_uid, v_email, p_role, COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  -- best-effort logging; never break caller
  NULL;
END;
$$;

-- Wrapper exposed to clients: validates that the caller is owner/admin before logging
-- (used for created/copied/revoked/deleted from the frontend)
CREATE OR REPLACE FUNCTION public.record_invite_event(
  p_invite_id uuid,
  p_event text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.organization_invites;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_event NOT IN ('created','copied','revoked','deleted') THEN
    RAISE EXCEPTION 'Invalid event for client logging: %', p_event;
  END IF;

  SELECT * INTO v_inv FROM public.organization_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;

  v_role := get_user_org_role(v_inv.organization_id);
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Insufficient permissions'; END IF;

  PERFORM public.log_invite_event(
    v_inv.organization_id, v_inv.id, v_inv.token, v_inv.role, p_event, p_metadata
  );
END;
$$;

-- Update accept_invite to record audit events
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
    PERFORM public.log_invite_event(v_inv.organization_id, v_inv.id, v_inv.token, v_inv.role, 'accept_failed', jsonb_build_object('reason','revoked'));
    RAISE EXCEPTION 'Invite revoked';
  END IF;
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    PERFORM public.log_invite_event(v_inv.organization_id, v_inv.id, v_inv.token, v_inv.role, 'accept_failed', jsonb_build_object('reason','expired'));
    RAISE EXCEPTION 'Invite expired';
  END IF;
  IF v_inv.max_uses IS NOT NULL AND v_inv.uses_count >= v_inv.max_uses THEN
    PERFORM public.log_invite_event(v_inv.organization_id, v_inv.id, v_inv.token, v_inv.role, 'accept_failed', jsonb_build_object('reason','exhausted'));
    RAISE EXCEPTION 'Invite exhausted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_inv.organization_id AND user_id = v_user_id
  ) THEN
    PERFORM public.log_invite_event(v_inv.organization_id, v_inv.id, v_inv.token, v_inv.role, 'accepted', jsonb_build_object('already_member', true));
    RETURN jsonb_build_object('organization_id', v_inv.organization_id, 'already_member', true);
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (v_inv.organization_id, v_user_id, v_inv.role, now());

  UPDATE public.organization_invites
  SET uses_count = uses_count + 1
  WHERE id = v_inv.id;

  PERFORM public.log_invite_event(v_inv.organization_id, v_inv.id, v_inv.token, v_inv.role, 'accepted', jsonb_build_object('already_member', false));

  RETURN jsonb_build_object('organization_id', v_inv.organization_id, 'already_member', false);
END;
$$;
