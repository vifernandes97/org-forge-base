import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatCurrency';
import DashboardCard, { EmptyChart } from './DashboardCard';
import type { TeamMember } from '@/services/dashboard';

interface TeamRankingTableProps {
  data?: TeamMember[];
  isLoading: boolean;
}

export default function TeamRankingTable({ data, isLoading }: TeamRankingTableProps) {
  const rows = [...(data ?? [])].sort((a, b) => b.converted_count - a.converted_count || b.total_value - a.total_value);

  return (
    <DashboardCard title="Ranking da equipe" description="Ordenado por negócios ganhos no período" isLoading={isLoading}>
      {!rows.length ? (
        <EmptyChart />
      ) : (
        <>
          {/* Phones: compact list instead of the 6-column table */}
          <ol className="divide-y sm:hidden">
            {rows.map((m, i) => {
              const rate = m.leads_count > 0 ? (m.converted_count / m.leads_count) * 100 : 0;
              return (
                <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{m.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {m.converted_count} de {m.leads_count} ganhos · {formatCurrency(m.total_value)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{rate.toFixed(0)}%</span>
                </li>
              );
            })}
          </ol>
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Negócios</TableHead>
                  <TableHead className="text-right">Ganhos</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[180px]">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m, i) => {
                  const rate = m.leads_count > 0 ? (m.converted_count / m.leads_count) * 100 : 0;
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={m.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">{m.full_name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="max-w-[200px] truncate text-sm font-medium">{m.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.leads_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.converted_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(m.total_value)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums">{rate.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </DashboardCard>
  );
}
