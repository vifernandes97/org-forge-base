import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '@/hooks/use-theme';

/** Shared by the desktop header/sidebar and the mobile app menu. */
export const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export const userInitials = (fullName?: string) =>
  fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

export const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Visualizador',
};
