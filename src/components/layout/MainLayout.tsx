import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { useAppBadge } from '@/hooks/useAppBadge';

export function MainLayout({ children }: { children: React.ReactNode }) {
  useAppBadge();
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 w-full">
          <Header />
          <main className="flex-1 min-w-0 overflow-x-hidden p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
