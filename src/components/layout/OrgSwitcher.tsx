import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateOrganizationDialog } from '@/components/organizations/CreateOrganizationDialog';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Visualizador',
};

export function OrgSwitcher() {
  const { organization, organizations, role, setActiveOrg } = useOrganization();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');

  const showSearch = organizations.length > 6;
  const filtered = useMemo(() => {
    if (!query.trim()) return organizations;
    const q = query.toLowerCase();
    return organizations.filter(o => o.name.toLowerCase().includes(q));
  }, [organizations, query]);

  const initial = organization?.name?.[0]?.toUpperCase() || 'C';

  return (
    <div className="flex h-14 items-center border-b px-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-10 w-full justify-start gap-2 px-2"
            aria-label="Trocar de empresa"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {initial}
            </div>
            {!collapsed && (
              <>
                <div className="flex min-w-0 flex-1 flex-col items-start leading-tight">
                  <span className="w-full truncate text-sm font-semibold">
                    {organization?.name || 'Org Connect'}
                  </span>
                  {role && (
                    <span className="text-[11px] text-muted-foreground">{roleLabels[role]}</span>
                  )}
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Suas empresas</DropdownMenuLabel>
          {showSearch && (
            <div className="px-2 pb-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  placeholder="Buscar empresa"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.map(org => (
              <DropdownMenuItem key={org.id} onClick={() => { setActiveOrg(org.id); closeOnMobile(); }} className="gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold">
                  {org.name?.[0]?.toUpperCase()}
                </div>
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === organization?.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada</p>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova empresa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
