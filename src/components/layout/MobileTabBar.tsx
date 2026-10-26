import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskBadgeCounts } from '@/hooks/useTasks';
import { useTheme } from '@/hooks/use-theme';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { mainNav, mobileTabUrls, settingsNav, type NavItem } from './navItems';
import { themeOptions, userInitials } from './menuOptions';

const tabs = mainNav.filter(i => mobileTabUrls.includes(i.url));
const moreItems = [...mainNav.filter(i => !mobileTabUrls.includes(i.url)), ...settingsNav];

const isActive = (pathname: string, url: string) => pathname === url || pathname.startsWith(`${url}/`);

/** Mobile app menu: bottom tab bar + "Mais" sheet. Replaces the sidebar below md. */
export function MobileTabBar() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: badgeCounts } = useTaskBadgeCounts();
  const taskBadge = (badgeCounts?.overdue || 0) + (badgeCounts?.today || 0);
  const moreActive = !tabs.some(t => isActive(pathname, t.url));

  return (
    <>
      <nav
        id="mobile-tabbar"
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {tabs.map(item => (
            <li key={item.url} className="flex-1">
              <TabLink
                item={item}
                active={isActive(pathname, item.url)}
                badge={item.url === '/tasks' ? taskBadge : 0}
                badgeUrgent={!!badgeCounts?.overdue}
              />
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={tabClass(moreActive)}
              aria-haspopup="dialog"
            >
              <TabIcon active={moreActive}><Menu className="h-5 w-5" /></TabIcon>
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} />
    </>
  );
}

const tabClass = (active: boolean) =>
  cn(
    'flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors [-webkit-tap-highlight-color:transparent]',
    active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
  );

function TabIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn('relative flex h-7 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-primary/10')}>
      {children}
    </span>
  );
}

function TabLink({ item, active, badge, badgeUrgent }: { item: NavItem; active: boolean; badge: number; badgeUrgent: boolean }) {
  return (
    <Link to={item.url} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
      <TabIcon active={active}>
        <item.icon className="h-5 w-5" />
        {badge > 0 && (
          <span
            className={cn(
              'absolute right-2 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
              badgeUrgent ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground',
            )}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </TabIcon>
      <span>{item.title}</span>
    </Link>
  );
}

function MoreSheet({ open, onOpenChange, pathname }: { open: boolean; onOpenChange: (o: boolean) => void; pathname: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const fullName = user?.user_metadata?.full_name as string | undefined;

  // Closing goes through DrawerClose: vaul only clears the body's pointer-events lock on its own close path.
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90dvh] pb-[env(safe-area-inset-bottom)]">
        <DrawerTitle className="sr-only">Mais opções</DrawerTitle>
        <div className="space-y-5 overflow-y-auto px-4 pb-4 pt-3">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-primary text-sm text-primary-foreground">{userInitials(fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{fullName || 'Usuário'}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {moreItems.map(item => {
              const active = item.url === '/settings' ? pathname === '/settings' || (pathname.startsWith('/settings/') && !pathname.startsWith('/settings/automations')) : isActive(pathname, item.url);
              return (
                <li key={item.url}>
                  <DrawerClose asChild>
                    <button
                      type="button"
                      onClick={() => navigate(item.url)}
                      className={cn('flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium active:bg-accent', active && 'text-primary')}
                    >
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="flex-1">{item.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DrawerClose>
                </li>
              );
            })}
          </ul>

          <div className="space-y-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Tema</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tema">
              {themeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                    theme === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                  )}
                >
                  <opt.icon className="h-4 w-4" /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          <DrawerClose asChild>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium text-destructive active:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
