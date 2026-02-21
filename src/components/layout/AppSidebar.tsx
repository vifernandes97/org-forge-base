import { LayoutDashboard, Users, Settings, BarChart3 } from 'lucide-react';
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

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Contatos', url: '/contacts', icon: Users },
  { title: 'Relatórios', url: '/reports', icon: BarChart3 },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { organization } = useOrganization();

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
              {navItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
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
