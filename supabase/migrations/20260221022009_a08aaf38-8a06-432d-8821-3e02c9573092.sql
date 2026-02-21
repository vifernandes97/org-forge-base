
-- Fix the permissive INSERT policy on organizations
-- Drop and recreate to be more restrictive (user must be authenticated, handled by TO authenticated)
DROP POLICY "Authenticated users can create orgs" ON public.organizations;
CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
