import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { useSearchParams } from 'react-router-dom';
import { useAppBadge } from '@/hooks/useAppBadge';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';

export function MainLayout({ children }: { children: React.ReactNode }) {
  useAppBadge();
  // ?lead=<id> abre o negócio em qualquer tela (clique na notificação/push).
  const [searchParams, setSearchParams] = useSearchParams();
  const leadId = searchParams.get('lead');
  const closeLead = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('lead');
    setSearchParams(next, { replace: true });
  };
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 w-full">
          <Header />
          <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6">{children}</main>
          <LeadDetailSheet leadId={leadId} onClose={closeLead} />
        </div>
      </div>
    </SidebarProvider>
  );
}
