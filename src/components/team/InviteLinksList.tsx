import { useInvites, useRevokeInvite, useDeleteInvite } from '@/hooks/useInvites';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Trash2, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { buildInviteUrl, logInviteEvent } from '@/services/invites';
import { useQueryClient } from '@tanstack/react-query';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário', admin: 'Administrador', member: 'Membro', viewer: 'Visualizador',
};

export function InviteLinksList() {
  const { data: invites, isLoading } = useInvites();
  const revoke = useRevokeInvite();
  const del = useDeleteInvite();
  const qc = useQueryClient();

  const handleCopy = async (id: string, token: string) => {
    await navigator.clipboard.writeText(buildInviteUrl(token));
    await logInviteEvent(id, 'copied');
    qc.invalidateQueries({ queryKey: ['invite-logs'] });
    toast.success('Link copiado!');
  };

  const isExpired = (i: { expires_at: string | null }) =>
    i.expires_at ? new Date(i.expires_at) < new Date() : false;
  const isExhausted = (i: { max_uses: number | null; uses_count: number }) =>
    i.max_uses !== null && i.uses_count >= i.max_uses;

  const statusBadge = (i: any) => {
    if (i.revoked_at) return <Badge variant="outline">Revogado</Badge>;
    if (isExpired(i)) return <Badge variant="outline">Expirado</Badge>;
    if (isExhausted(i)) return <Badge variant="outline">Esgotado</Badge>;
    return <Badge>Ativo</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Links de convite</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="table-stack">
            <TableHeader>
              <TableRow>
                <TableHead>Papel</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2].map(i => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !invites?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum link de convite ativo.
                  </TableCell>
                </TableRow>
              ) : invites.map(inv => {
                const active = !inv.revoked_at && !isExpired(inv) && !isExhausted(inv);
                return (
                  <TableRow key={inv.id}>
                    <TableCell><Badge variant="secondary">{ROLE_LABEL[inv.role]}</Badge></TableCell>
                    <TableCell className="text-sm max-sm:order-3 max-sm:text-xs" data-label="Usos">
                      {inv.uses_count}{inv.max_uses !== null ? ` / ${inv.max_uses}` : ' / ∞'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-sm:order-3 max-sm:text-xs" data-label="Expira">
                      {inv.expires_at ? format(new Date(inv.expires_at), 'dd/MM/yyyy', { locale: ptBR }) : 'Nunca'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-sm:order-3 max-sm:text-xs" data-label="Criado">
                      {format(new Date(inv.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{statusBadge(inv)}</TableCell>
                    <TableCell className="text-right max-sm:ml-auto">
                      <div className="flex justify-end gap-1">
                        {active && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(inv.id, inv.token)} aria-label="Copiar link">
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {active && (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={async () => { await revoke.mutateAsync(inv.id); toast.success('Link revogado'); }}
                            aria-label="Revogar link"
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={async () => { await del.mutateAsync(inv.id); toast.success('Link excluído'); }}
                          aria-label="Excluir link"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
