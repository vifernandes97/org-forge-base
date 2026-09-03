CREATE POLICY "Users can update their own manual activities"
ON public.lead_activities
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND organization_id IN (SELECT public.get_user_org_ids())
  AND activity_type IN ('note','call','email','meeting')
)
WITH CHECK (
  user_id = auth.uid()
  AND organization_id IN (SELECT public.get_user_org_ids())
  AND activity_type IN ('note','call','email','meeting')
);