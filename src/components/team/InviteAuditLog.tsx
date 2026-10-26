import { useState } from 'react';
import { useInviteAuditLog } from '@/hooks/useInvites';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const EVENT_LABEL: Record<string, string> = {
  created: 'Criado',
  copied: 'Copiado',
  revoked: 'Revogado',
  deleted: 'Excluído',
  accepted: 'Aceito',
  accept_failed: 'Falha no aceite',
};

const EVENT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'default',
  copied: 'secondary',
  revoked: 'outline',
  deleted: 'destructive',
  accepted: 'default',
  accept_failed: 'destructive',
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário', admin: 'Administrador', member: 'Membro', viewer: 'Visualizador',
};

const PAGE_SIZE = 20;

export function InviteAuditLog() {
  const [page, setPage] = useState(0);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const events = eventFilter === 'all' ? undefined : [eventFilter];
  const { data, isLoading } = useInviteAuditLog(page, events, PAGE_SIZE);

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const formatDetails = (ev: string, meta: Record<string, any>) => {
    if (ev === 'accept_failed' && meta?.reason) return `Motivo: ${meta.reason}`;
    if (ev === 'accepted' && meta?.already_member) return 'Já era membro';
    if (ev === 'created') {
      const parts: string[] = [];
      if (meta?.expires_at) parts.push(`expira ${format(new Date(meta.expires_at), 'dd/MM/yyyy', { locale: ptBR })}`);
      else parts.push('sem expiração');
      parts.push(meta?.max_uses ? `${meta.max_uses} usos` : 'usos ilimitados');
      return parts.join(' · ');
    }
    return '—';
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <CardTitle className="text-lg">Histórico de convites</CardTitle>
        <Select value={eventFilter} onValueChange={(v) => { setEventFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {Object.entries(EVENT_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum evento registrado.
                  </TableCell>
                </TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={EVENT_VARIANT[r.event_type] ?? 'secondary'}>
                      {EVENT_LABEL[r.event_type] ?? r.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-sm:w-full max-sm:text-xs" data-label="Autor">{r.actor_email ?? '—'}</TableCell>
                  <TableCell className="text-sm max-sm:text-xs" data-label="Papel">{r.role ? ROLE_LABEL[r.role] : '—'}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground max-sm:text-xs" data-label="Token">
                    {r.invite_token_preview ? `••••${r.invite_token_preview}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-sm:w-full max-sm:text-xs">
                    {formatDetails(r.event_type, r.metadata || {})}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages} · {total} eventos
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
