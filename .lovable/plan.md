

# Fix: RLS Policies Blocking Organization Creation

## Problem
All RLS policies on `organizations`, `organization_members`, and `profiles` tables are **RESTRICTIVE** instead of **PERMISSIVE**. PostgreSQL requires at least one PERMISSIVE policy to grant access — restrictive policies only further limit access. With zero permissive policies, all operations are denied.

Additionally, the `organization_members` INSERT policy has a self-referencing bug that makes the NOT EXISTS check always return false.

## Solution

Run a single database migration that:

1. **Drops all existing RLS policies** on `organizations`, `organization_members`, and `profiles`
2. **Recreates them as PERMISSIVE** (the PostgreSQL default) with the same logic
3. **Fixes the self-join bug** in the `organization_members` INSERT policy

## Technical Details

### Migration SQL

The migration will:

**profiles table** (3 policies):
- SELECT: own record only
- UPDATE: own record only
- INSERT: own record only (for trigger)

**organizations table** (4 policies):
- SELECT: user is a member (via `get_user_org_ids()`)
- INSERT: any authenticated user
- UPDATE: owner/admin/member role
- DELETE: owner/admin role

**organization_members table** (4 policies):
- SELECT: user is member of the org
- INSERT: owner/admin OR the user adding themselves as first member (fixed subquery)
- UPDATE: owner/admin
- DELETE: owner/admin

The fixed INSERT policy for `organization_members` will correctly reference the outer `NEW.organization_id` instead of the self-referencing bug.

### Files Changed
- One new database migration (SQL only, no code changes needed)

