import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { CreateOrganizationDialog } from '@/components/organizations/CreateOrganizationDialog';
import { cn } from '@/lib/utils';
import { NotificationBell } from './NotificationBell';
import { roleLabels } from './menuOptions';

/** Mobile top bar: active workspace (tap to switch) + notifications. */
export function MobileHeader() {
  const { organization, organizations, role, setActiveOrg } = useOrganization();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  // "Nova empresa" opens its dialog only after the sheet finished closing (two modal layers fight over focus/pointer lock).
  const createAfterClose = useRef(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return organizations;
    const q = query.toLowerCase();
    return organizations.filter(o => o.name.toLowerCase().includes(q));
  }, [organizations, query]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex h-14 items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left active:bg-accent"
          aria-label="Trocar de empresa"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {organization?.name?.[0]?.toUpperCase() || 'C'}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold">{organization?.name || 'Org Connect'}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </span>
            {role && <span className="text-[11px] text-muted-foreground">{roleLabels[role]}</span>}
          </span>
        </button>
        <div className="flex-1" />
        <NotificationBell />
      </div>

      <Drawer
        open={open}
        onOpenChange={o => { setOpen(o); if (!o) setQuery(''); }}
        onAnimationEnd={o => {
          if (!o && createAfterClose.current) { createAfterClose.current = false; setCreateOpen(true); }
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[85dvh] pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base">Suas empresas</DrawerTitle>
          </DrawerHeader>
          {organizations.length > 6 && (
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar empresa" className="pl-9" />
              </div>
            </div>
          )}
          <ul className="overflow-y-auto px-2">
            {filtered.map(org => {
              const current = org.id === organization?.id;
              return (
                <li key={org.id}>
                  <DrawerClose asChild>
                    <button
                      type="button"
                      onClick={() => setActiveOrg(org.id)}
                      className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left active:bg-accent', current && 'bg-accent/60')}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                        {org.name?.[0]?.toUpperCase()}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">{org.name}</span>
                      {current && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </DrawerClose>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada</li>
            )}
          </ul>
          <div className="border-t p-2">
            <DrawerClose asChild>
              <button
                type="button"
                onClick={() => { createAfterClose.current = true; }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium active:bg-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed">
                  <Plus className="h-4 w-4" />
                </span>
                Nova empresa
              </button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  );
}
