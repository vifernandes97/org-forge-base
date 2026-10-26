import { LayoutDashboard, Settings, Contact, CheckSquare, Zap, Handshake, Building2 } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { OrgSwitcher } from '@/components/layout/OrgSwitcher';
import { useTaskBadgeCounts } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { BrandLogo } from '@/components/brand/BrandLogo';

const mainNav = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Negócios', url: '/leads', icon: Handshake },
  { title: 'Empresas', url: '/companies', icon: Building2 },
  { title: 'Contatos', url: '/contacts', icon: Contact },
  { title: 'Tarefas', url: '/tasks', icon: CheckSquare },
];

const settingsNav = [
  { title: 'Automações', url: '/settings/automations', icon: Zap },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { data: badgeCounts } = useTaskBadgeCounts();
  const totalBadge = (badgeCounts?.overdue || 0) + (badgeCounts?.today || 0);
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-14 justify-center border-b px-4 group-data-[collapsible=icon]:px-2">
        <NavLink to="/dashboard" onClick={closeOnMobile} aria-label="Org Connect — Dashboard" className="flex items-center">
          {collapsed
            ? <BrandLogo variant="simbolo" className="mx-auto h-8 w-8" />
            : <BrandLogo variant="horizontal" className="h-7 w-auto" />}
        </NavLink>
      </SidebarHeader>

      <OrgSwitcher />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end onClick={closeOnMobile} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.url === '/tasks' && totalBadge > 0 && (
                        <Badge variant={badgeCounts?.overdue ? 'destructive' : 'secondary'} className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px]">
                          {totalBadge}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel><Settings className="h-3.5 w-3.5 mr-1.5 inline" />Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} onClick={closeOnMobile} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
