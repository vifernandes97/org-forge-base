import { useEffect, useState, type ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

export interface Column<T> {
  key: string;
  label: string;
  sortKey?: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Always visible, not listed in the column chooser */
  fixed?: boolean;
}

/** Visible-columns state persisted per screen (like ListView). */
export function useVisibleColumns(storageKey: string, all: string[]) {
  const [visible, setVisible] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (Array.isArray(v)) return v; } catch { /* ignore */ }
    return all;
  });
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(visible)); }, [storageKey, visible]);
  const toggle = (k: string) => setVisible(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k]));
  return { visible, toggle };
}

export function ColumnsMenu<T>({ columns, visible, onToggle }: { columns: Column<T>[]; visible: string[]; onToggle: (k: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9"><Columns3 className="mr-1.5 h-4 w-4" /> Colunas</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.filter(c => !c.fixed).map(c => (
          <DropdownMenuCheckboxItem key={c.key} checked={visible.includes(c.key)} onCheckedChange={() => onToggle(c.key)}
            onSelect={e => e.preventDefault()}>
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Props<T extends { id: string }> {
  columns: Column<T>[];
  visible: string[];
  rows: T[];
  loading?: boolean;
  sort: string;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  renderCard: (row: T) => ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPage: (n: number) => void;
  empty?: ReactNode;
}

export function DataTable<T extends { id: string }>(p: Props<T>) {
  const isMobile = useIsMobile();
  const cols = p.columns.filter(c => c.fixed || p.visible.includes(c.key));
  const selectable = !!p.onSelectedChange;
  const sel = new Set(p.selected || []);
  const allOnPage = p.rows.length > 0 && p.rows.every(r => sel.has(r.id));
  const toggleRow = (id: string) => {
    const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id);
    p.onSelectedChange?.([...n]);
  };
  const toggleAll = () => {
    const n = new Set(sel);
    if (allOnPage) p.rows.forEach(r => n.delete(r.id)); else p.rows.forEach(r => n.add(r.id));
    p.onSelectedChange?.([...n]);
  };
  const pages = Math.max(1, Math.ceil(p.total / p.pageSize));

  const pager = (
    <div className="flex items-center justify-between gap-2 pt-3 text-sm text-muted-foreground">
      <span>{p.total} {p.total === 1 ? 'registro' : 'registros'}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={p.page === 0} onClick={() => p.onPage(p.page - 1)} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2">{p.page + 1} / {pages}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={p.page + 1 >= pages} onClick={() => p.onPage(p.page + 1)} aria-label="Próxima página">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (p.loading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (!p.rows.length) return <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">{p.empty || 'Nenhum registro encontrado.'}</div>;

  if (isMobile) {
    return (
      <div>
        <div className="space-y-2">
          {p.rows.map(r => (
            <div key={r.id} className="flex items-start gap-2 rounded-lg border bg-card p-3">
              {selectable && <Checkbox className="mt-1" checked={sel.has(r.id)} onCheckedChange={() => toggleRow(r.id)} aria-label="Selecionar" />}
              <button type="button" className="flex-1 min-w-0 text-left" onClick={() => p.onRowClick?.(r)}>{p.renderCard(r)}</button>
            </div>
          ))}
        </div>
        {pager}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && <TableHead className="w-10"><Checkbox checked={allOnPage} onCheckedChange={toggleAll} aria-label="Selecionar todos" /></TableHead>}
              {cols.map(c => {
                const sk = c.sortKey;
                const active = sk && p.sort === sk;
                return (
                  <TableHead key={c.key} className={c.className}>
                    {sk ? (
                      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground whitespace-nowrap" onClick={() => p.onSort(sk)}>
                        {c.label}
                        {active ? (p.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                      </button>
                    ) : c.label}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.rows.map(r => (
              <TableRow key={r.id} className={p.onRowClick ? 'cursor-pointer' : ''} data-state={sel.has(r.id) ? 'selected' : undefined}
                onClick={() => p.onRowClick?.(r)}>
                {selectable && (
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggleRow(r.id)} aria-label="Selecionar" />
                  </TableCell>
                )}
                {cols.map(c => <TableCell key={c.key} className={c.className}>{c.render(r)}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pager}
    </div>
  );
}
