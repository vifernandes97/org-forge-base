import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { MobileHeader } from './MobileHeader';
import { MobileTabBar } from './MobileTabBar';
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
        {/* Sidebar no desktop; abaixo de md o menu é a barra inferior (MobileTabBar). */}
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 w-full">
          <Header />
          <MobileHeader />
          <main className="flex-1 min-w-0 overflow-x-hidden px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-6">{children}</main>
          <LeadDetailSheet leadId={leadId} onClose={closeLead} />
        </div>
        <MobileTabBar />
      </div>
    </SidebarProvider>
  );
}
