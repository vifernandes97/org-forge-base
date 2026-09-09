-- Internal/trigger-only functions: nobody may call them through the API
REVOKE ALL ON FUNCTION public.dispatch_pending_webhook() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_automations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_stage_task_automations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_contact_to_lead() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_lead_to_contact() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_invite_event(uuid, uuid, text, public.org_role, text, jsonb) FROM PUBLIC;

-- Signed-in-only RPCs: drop implicit PUBLIC execute, grant to authenticated only
REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_funnel_with_default_stages(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_funnel_with_default_stages(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.merge_leads(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_leads(uuid, uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.record_invite_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_invite_event(uuid, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.reorder_custom_fields(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_custom_fields(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.reorder_stages(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_stages(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.get_dashboard_summary(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, uuid, timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.get_archive_reasons_summary(uuid, uuid, timestamptz, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_archive_reasons_summary(uuid, uuid, timestamptz, timestamptz, uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.get_funnel_metrics(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_funnel_metrics(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_funnel_metrics(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_funnel_metrics(uuid, uuid, timestamptz, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.get_leads_by_period(uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leads_by_period(uuid, uuid, timestamptz, timestamptz, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_team_ranking(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_ranking(uuid, timestamptz, timestamptz, uuid) TO authenticated;

-- RLS helper functions: needed by policies for signed-in users only
REVOKE ALL ON FUNCTION public.get_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_org_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_org_role(uuid) TO authenticated;

-- Invite preview stays reachable before sign-in
REVOKE ALL ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;