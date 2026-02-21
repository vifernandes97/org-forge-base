
DROP POLICY "Service role can insert webhook logs" ON public.webhook_logs;

CREATE POLICY "Members can insert webhook logs" ON public.webhook_logs
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
  );
