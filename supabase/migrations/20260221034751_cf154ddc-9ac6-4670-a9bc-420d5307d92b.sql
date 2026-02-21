
CREATE TABLE public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL,
  filters jsonb NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_filters_org_id ON public.saved_filters(organization_id);
CREATE INDEX idx_saved_filters_user_id ON public.saved_filters(user_id);

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own and shared filters" ON public.saved_filters
  FOR SELECT USING (
    organization_id IN (SELECT get_user_org_ids())
    AND (user_id = auth.uid() OR is_shared = true)
  );

CREATE POLICY "Owner/admin/member can insert filters" ON public.saved_filters
  FOR INSERT WITH CHECK (
    get_user_org_role(organization_id) IN ('owner','admin','member')
    AND user_id = auth.uid()
  );

CREATE POLICY "Creator can delete own filters" ON public.saved_filters
  FOR DELETE USING (user_id = auth.uid());
