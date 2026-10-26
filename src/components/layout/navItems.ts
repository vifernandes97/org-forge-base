import { LayoutDashboard, Settings, Contact, CheckSquare, Zap, Handshake, Building2, type LucideIcon } from 'lucide-react';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

/** Shared by the desktop sidebar and the mobile app menu (tab bar + "Mais"). */
export const mainNav: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Negócios', url: '/leads', icon: Handshake },
  { title: 'Empresas', url: '/companies', icon: Building2 },
  { title: 'Contatos', url: '/contacts', icon: Contact },
  { title: 'Tarefas', url: '/tasks', icon: CheckSquare },
];

export const settingsNav: NavItem[] = [
  { title: 'Automações', url: '/settings/automations', icon: Zap },
  { title: 'Configurações', url: '/settings', icon: Settings },
];

/** Tab bar slots on mobile; everything else lives under "Mais". */
export const mobileTabUrls = ['/dashboard', '/leads', '/companies', '/tasks'];
