import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import type { TeamMember } from '@/services/dashboard';

interface TeamRankingTableProps {
  data?: TeamMember[];
  isLoading: boolean;
}

export default function TeamRankingTable({ data, isLoading }: TeamRankingTableProps) {
  if (isLoading) {
    return <Card><CardHeader><CardTitle>Ranking da Equipe</CardTitle></CardHeader><CardContent><Skeleton className="h-[200px] w-full" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Ranking da Equipe</CardTitle></CardHeader>
      <CardContent>
        {!data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => {
                const rate = m.leads_count > 0 ? (m.converted_count / m.leads_count) * 100 : 0;
                return (
                  <TableRow key={m.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{m.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate max-w-[150px]">{m.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{m.leads_count}</TableCell>
                    <TableCell className="text-right">{m.converted_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.total_value)}</TableCell>
                    <TableCell className="text-right">{rate.toFixed(1)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
