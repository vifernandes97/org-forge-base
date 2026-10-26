import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Organization, OrgRole } from '@/types';
import { useAuth } from './AuthContext';
import { getUserOrganizations } from '@/services/organizations';

interface OrganizationContextType {
  organization: Organization | null;
  organizations: Organization[];
  role: OrgRole | null;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isViewer: boolean;
  loading: boolean;
  hasOrg: boolean;
  setActiveOrg: (orgId: string) => void;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ACTIVE_ORG_KEY = 'crm_active_org_id';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<{ org_id: string; role: OrgRole }[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ORG_KEY)
  );
  const [fetching, setFetching] = useState(true);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);
  const [initialized, setInitialized] = useState(false);
  const setLoading = setFetching;

  const fetchOrgs = useCallback(async (showLoading = true) => {
    if (authLoading) return;
    if (!userId) {
      setOrganizations([]);
      setMemberships([]);
      setLoading(false);
      setLoadedFor(null);
      setInitialized(true);
      return;
    }
    try {
      if (showLoading) setLoading(true);
      const data = await getUserOrganizations();
      // A user may have more than one membership row per org — keep one entry per organization
      const seen = new Set<string>();
      const orgs = data
        .map(d => d.organizations)
        .filter(o => o && !seen.has(o.id) && seen.add(o.id));
      const membSeen = new Set<string>();
      const membList = data
        .filter(d => !membSeen.has(d.organization_id) && membSeen.add(d.organization_id))
        .map(d => ({ org_id: d.organization_id, role: d.role as OrgRole }));
      setOrganizations(orgs);
      setMemberships(membList);

      // Auto-select org
      if (orgs.length > 0) {
        const saved = localStorage.getItem(ACTIVE_ORG_KEY);
        const valid = orgs.find(o => o.id === saved);
        if (!valid) {
          setActiveOrgId(orgs[0].id);
          localStorage.setItem(ACTIVE_ORG_KEY, orgs[0].id);
        }
      } else {
        setActiveOrgId(null);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    } finally {
      setLoading(false);
      setLoadedFor(userId);
      setInitialized(true);
    }
  }, [userId, authLoading]);

  useEffect(() => { fetchOrgs(!initialized); }, [fetchOrgs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading until auth resolved AND orgs fetched for the current user
  const loading = authLoading || loadedFor !== userId || (fetching && !initialized);

  // Dynamic document title
  useEffect(() => {
    const org = organizations.find(o => o.id === activeOrgId);
    document.title = org ? `${org.name} — Org Connect` : 'Org Connect';
  }, [organizations, activeOrgId]);

  const setActiveOrg = (orgId: string) => {
    if (orgId === activeOrgId) return;
    setActiveOrgId(orgId);
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    // Discard cached data from the previous organization
    queryClient.clear();
  };

  const organization = organizations.find(o => o.id === activeOrgId) ?? null;
  const membership = memberships.find(m => m.org_id === activeOrgId);
  const role = membership?.role ?? null;

  return (
    <OrganizationContext.Provider value={{
      organization,
      organizations,
      role,
      isOwner: role === 'owner',
      isAdmin: role === 'admin',
      isMember: role === 'member',
      isViewer: role === 'viewer',
      loading,
      hasOrg: organizations.length > 0,
      setActiveOrg,
      refetch: fetchOrgs,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}
