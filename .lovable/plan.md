

# Fix: Organization Creation via SECURITY DEFINER Function

## Problem
INSERT into `organizations` table still fails with RLS violation despite policies being PERMISSIVE. The `organization_members` INSERT policy also has a self-referencing subquery issue. These problems compound because org creation requires two inserts (org + member) that depend on each other.

## Solution
Create a single `SECURITY DEFINER` database function `create_organization_with_owner(name, slug)` that:
1. Inserts the organization
2. Adds the current user as owner in `organization_members`
3. Returns the created organization

Since `SECURITY DEFINER` runs with the function owner's privileges (bypassing RLS), this eliminates all policy conflicts during the onboarding flow.

## Changes

### 1. Database Migration
- Create function `public.create_organization_with_owner(p_name text, p_slug text)` as `SECURITY DEFINER`
- The function performs both inserts atomically and returns the organization row

### 2. Update `src/services/organizations.ts`
- Replace the two separate inserts in `createOrganization()` with a single RPC call: `supabase.rpc('create_organization_with_owner', { p_name, p_slug })`
- Remove the manual member insertion code

### 3. Update `src/integrations/supabase/types.ts`
- This file updates automatically after migration

## Why This Approach
- Atomic: both inserts succeed or fail together
- Secure: function runs with elevated privileges only for this specific operation
- Reliable: no dependency on complex RLS policy interactions during onboarding
- Clean: simplifies client-side code from ~15 lines to a single RPC call

