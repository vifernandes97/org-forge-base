
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  stage_id uuid NOT NULL REFERENCES public.stages(id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  webhook_url text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  success boolean NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_org_id ON public.webhook_logs(organization_id);
CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_success ON public.webhook_logs(success);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view webhook logs" ON public.webhook_logs
  FOR SELECT USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Service role can insert webhook logs" ON public.webhook_logs
  FOR INSERT WITH CHECK (true);
