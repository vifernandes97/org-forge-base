
-- Inbound Webhooks table
CREATE TABLE public.inbound_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  api_key text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  funnel_id uuid REFERENCES public.funnels(id) ON DELETE SET NULL,
  target_stage text NOT NULL DEFAULT 'first',
  default_source text NOT NULL DEFAULT 'formulário',
  default_assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  default_tags text[] NOT NULL DEFAULT '{}',
  duplicate_strategy text NOT NULL DEFAULT 'update',
  field_mapping jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_webhooks_org ON public.inbound_webhooks(organization_id);
CREATE INDEX idx_inbound_webhooks_api_key ON public.inbound_webhooks(api_key);

ALTER TABLE public.inbound_webhooks ENABLE ROW LEVEL SECURITY;

-- Validation trigger for duplicate_strategy
CREATE OR REPLACE FUNCTION public.validate_inbound_webhook_strategy()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.duplicate_strategy NOT IN ('update','create_new','ignore') THEN
    RAISE EXCEPTION 'Invalid duplicate_strategy: %', NEW.duplicate_strategy;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_inbound_webhook_strategy
  BEFORE INSERT OR UPDATE ON public.inbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.validate_inbound_webhook_strategy();

-- Updated_at trigger
CREATE TRIGGER update_inbound_webhooks_updated_at
  BEFORE UPDATE ON public.inbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies for inbound_webhooks
CREATE POLICY "Members can view inbound webhooks"
  ON public.inbound_webhooks FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can insert inbound webhooks"
  ON public.inbound_webhooks FOR INSERT
  WITH CHECK (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can update inbound webhooks"
  ON public.inbound_webhooks FOR UPDATE
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

CREATE POLICY "Owner/admin can delete inbound webhooks"
  ON public.inbound_webhooks FOR DELETE
  USING (get_user_org_role(organization_id) IN ('owner','admin'));

-- Inbound Webhook Logs table
CREATE TABLE public.inbound_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inbound_webhook_id uuid NOT NULL REFERENCES public.inbound_webhooks(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  action text NOT NULL,
  raw_payload jsonb NOT NULL,
  mapped_data jsonb,
  changes_applied jsonb,
  error_message text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_logs_org ON public.inbound_webhook_logs(organization_id);
CREATE INDEX idx_inbound_logs_webhook ON public.inbound_webhook_logs(inbound_webhook_id);
CREATE INDEX idx_inbound_logs_action ON public.inbound_webhook_logs(action);
CREATE INDEX idx_inbound_logs_created ON public.inbound_webhook_logs(created_at DESC);

ALTER TABLE public.inbound_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS for logs: SELECT for org members, DELETE for owner/admin
-- INSERT is done via service_role in the Edge Function (bypasses RLS)
CREATE POLICY "Members can view inbound webhook logs"
  ON public.inbound_webhook_logs FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Owner/admin can delete inbound webhook logs"
  ON public.inbound_webhook_logs FOR DELETE
  USING (get_user_org_role(organization_id) IN ('owner','admin'));
