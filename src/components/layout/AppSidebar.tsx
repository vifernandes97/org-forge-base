import { LayoutDashboard, Settings, GitBranch, Contact, CheckSquare, Zap } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { OrgSwitcher } from '@/components/layout/OrgSwitcher';
import { useTaskBadgeCounts } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';

const mainNav = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Negócios', url: '/leads', icon: Contact },
  { title: 'Tarefas', url: '/tasks', icon: CheckSquare },
];

const settingsNav = [
  { title: 'Funis', url: '/settings/funnels', icon: GitBranch },
  { title: 'Automações', url: '/settings/automations', icon: Zap },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { data: badgeCounts } = useTaskBadgeCounts();
  const totalBadge = (badgeCounts?.overdue || 0) + (badgeCounts?.today || 0);
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon" className="border-r">
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
