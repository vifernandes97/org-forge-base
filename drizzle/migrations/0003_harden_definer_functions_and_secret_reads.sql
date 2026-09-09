-- 1) Trigger + internal-only SECURITY DEFINER functions: not callable via API
REVOKE ALL ON FUNCTION public.dispatch_pending_webhook() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_automations() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.execute_stage_task_automations() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_contact_to_lead() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_lead_to_contact() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.log_invite_event(uuid, uuid, text, public.org_role, text, jsonb) FROM anon, authenticated;

-- 2) Authenticated-only RPCs: remove anonymous execute
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM anon;
REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_funnel_with_default_stages(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.merge_leads(uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.record_invite_event(uuid, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_custom_fields(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.reorder_stages(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(uuid, uuid, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.get_archive_reasons_summary(uuid, uuid, timestamptz, timestamptz, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.get_funnel_metrics(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_funnel_metrics(uuid, uuid, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.get_leads_by_period(uuid, uuid, timestamptz, timestamptz, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_team_ranking(uuid, timestamptz, timestamptz, uuid) FROM anon;

-- 3) Secrets (api_key / webhook_secret) readable by owner/admin only
DROP POLICY IF EXISTS "Members can view inbound webhooks" ON public.inbound_webhooks;
CREATE POLICY "Owner/admin can view inbound webhooks"
ON public.inbound_webhooks
FOR SELECT
TO authenticated
USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

DROP POLICY IF EXISTS "Members can view stage task templates" ON public.stage_task_templates;
CREATE POLICY "Owner/admin can view stage task templates"
ON public.stage_task_templates
FOR SELECT
TO authenticated
USING (public.get_user_org_role(organization_id) = ANY (ARRAY['owner','admin']));

REVOKE SELECT ON public.inbound_webhooks FROM anon;
REVOKE SELECT ON public.stage_task_templates FROM anon;