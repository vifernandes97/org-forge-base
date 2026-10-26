import { useTheme as useNextTheme } from 'next-themes';

export type ThemePreference = 'light' | 'dark' | 'system';

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  return {
    theme: (theme ?? 'system') as ThemePreference,
    resolvedTheme: (resolvedTheme ?? 'light') as 'light' | 'dark',
    setTheme: (t: ThemePreference) => setTheme(t),
  };
}
