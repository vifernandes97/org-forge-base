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
} from '@/components/ui/sidebar';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTaskBadgeCounts } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';

const mainNav = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Leads', url: '/leads', icon: Contact },
  { title: 'Tarefas', url: '/tasks', icon: CheckSquare },
];

const settingsNav = [
  { title: 'Funis', url: '/settings/funnels', icon: GitBranch },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { organization } = useOrganization();
  const { data: badgeCounts } = useTaskBadgeCounts();
  const totalBadge = (badgeCounts?.overdue || 0) + (badgeCounts?.today || 0);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          {organization?.name?.[0]?.toUpperCase() || 'C'}
        </div>
        <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
          {organization?.name || 'CRM'}
        </span>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
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
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
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
