import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { hasOrg, loading: orgLoading } = useOrganization();
  const location = useLocation();

  if (authLoading || orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    // Guarda o destino (ex.: /dashboard?lead=<id>) para voltar a ele depois do login.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (!hasOrg) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
