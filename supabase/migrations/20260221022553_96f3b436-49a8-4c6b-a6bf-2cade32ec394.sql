
-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert for service role" ON public.profiles;

-- Drop all existing policies on organizations
DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated users can create orgs" ON public.organizations;
DROP POLICY IF EXISTS "Org owner/admin/member can update org" ON public.organizations;
DROP POLICY IF EXISTS "Org owner/admin can delete org" ON public.organizations;

-- Drop all existing policies on organization_members
DROP POLICY IF EXISTS "Org members can view members" ON public.organization_members;
DROP POLICY IF EXISTS "Org owner/admin can insert members" ON public.organization_members;
DROP POLICY IF EXISTS "Org owner/admin can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Org owner/admin can delete members" ON public.organization_members;

-- ========== PROFILES (PERMISSIVE) ==========

CREATE POLICY "Users can view own profile" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ========== ORGANIZATIONS (PERMISSIVE) ==========

CREATE POLICY "Org members can view org" ON public.organizations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Authenticated users can create orgs" ON public.organizations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Org owner/admin/member can update org" ON public.organizations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.get_user_org_role(id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Org owner/admin can delete org" ON public.organizations
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.get_user_org_role(id) IN ('owner', 'admin'));

-- ========== ORGANIZATION_MEMBERS (PERMISSIVE) ==========

CREATE POLICY "Org members can view members" ON public.organization_members
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org owner/admin can insert members" ON public.organization_members
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_org_role(organization_id) IN ('owner', 'admin')
    OR (
      user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members AS om_check
        WHERE om_check.organization_id = organization_members.organization_id
      )
    )
  );

CREATE POLICY "Org owner/admin can update members" ON public.organization_members
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.get_user_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Org owner/admin can delete members" ON public.organization_members
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (public.get_user_org_role(organization_id) IN ('owner', 'admin'));
