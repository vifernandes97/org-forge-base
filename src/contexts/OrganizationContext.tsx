import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<{ org_id: string; role: OrgRole }[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_ORG_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const fetchOrgs = useCallback(async (showLoading = true) => {
    if (!userId) {
      setOrganizations([]);
      setMemberships([]);
      setLoading(false);
      setInitialized(true);
      return;
    }
    try {
      if (showLoading) setLoading(true);
      const data = await getUserOrganizations();
      const orgs = data.map(d => d.organizations);
      const membList = data.map(d => ({ org_id: d.organization_id, role: d.role as OrgRole }));
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
      setInitialized(true);
    }
  }, [userId]);

  useEffect(() => { fetchOrgs(!initialized); }, [fetchOrgs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamic document title
  useEffect(() => {
    const org = organizations.find(o => o.id === activeOrgId);
    document.title = org ? `${org.name} — CRM` : 'CRM';
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
