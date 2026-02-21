
-- Create enum for org member roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- ========== TABLES ==========

-- Organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organization Members (roles stored here, NOT on profiles)
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  invited_email TEXT,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- ========== HELPER FUNCTIONS (SECURITY DEFINER) ==========

-- Get user's role in an org
CREATE OR REPLACE FUNCTION public.get_user_org_role(org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.organization_members
  WHERE organization_id = org_id
    AND user_id = auth.uid()
  LIMIT 1;
$$;

-- Get all org IDs for current user
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$;

-- ========== UPDATED_AT TRIGGER ==========

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== RLS ==========

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- PROFILES: only own record
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Allow the trigger to insert profiles (service role)
CREATE POLICY "Allow insert for service role"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ORGANIZATIONS: select for members; insert for anyone authed; update for owner/admin/member; delete for owner/admin
CREATE POLICY "Org members can view org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Org owner/admin/member can update org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.get_user_org_role(id) IN ('owner', 'admin', 'member'));

CREATE POLICY "Org owner/admin can delete org"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.get_user_org_role(id) IN ('owner', 'admin'));

-- ORGANIZATION_MEMBERS: select for org members; insert/update/delete for owner/admin
CREATE POLICY "Org members can view members"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Org owner/admin can insert members"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_user_org_role(organization_id) IN ('owner', 'admin')
    OR (user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM public.organization_members WHERE organization_id = organization_members.organization_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY "Org owner/admin can update members"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (public.get_user_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Org owner/admin can delete members"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (public.get_user_org_role(organization_id) IN ('owner', 'admin'));
