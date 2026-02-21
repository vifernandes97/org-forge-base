import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebhookLogs, useWebhookStats } from '@/hooks/useWebhooks';
import { useStages } from '@/hooks/useStages';
import { useFunnels } from '@/hooks/useFunnels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Activity, TrendingUp, AlertTriangle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { WebhookLogFilters } from '@/services/webhooks';

export default function WebhooksPage() {
  const [filters, setFilters] = useState<WebhookLogFilters>({ page: 0, pageSize: 50 });
  const [detailLog, setDetailLog] = useState<any | null>(null);

  const { data: funnels } = useFunnels();
  const defaultFunnel = useMemo(() => funnels?.find(f => f.is_default) || funnels?.[0], [funnels]);
  const { data: stages } = useStages(defaultFunnel?.id);

  const { data: logsData, isLoading } = useWebhookLogs(filters);
  const { data: stats } = useWebhookStats();

  const logs = logsData?.data || [];
  const totalCount = logsData?.count || 0;
  const totalPages = Math.ceil(totalCount / (filters.pageSize || 50));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Webhooks</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Disparados</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Falhas (24h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.failures24h || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.success === null || filters.success === undefined ? 'all' : String(filters.success)}
          onValueChange={v => setFilters(f => ({ ...f, success: v === 'all' ? null : v === 'true', page: 0 }))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sucesso</SelectItem>
            <SelectItem value="false">Falha</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.stageId || 'all'}
          onValueChange={v => setFilters(f => ({ ...f, stageId: v === 'all' ? null : v, page: 0 }))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {(stages || []).map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Tentativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3].map(i => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum webhook disparado ainda.</TableCell>
                </TableRow>
              ) : logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" style={{ borderColor: log.stages?.color }}>
                      {log.stages?.name || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground" title={log.webhook_url}>
                    {log.webhook_url}
                  </TableCell>
                  <TableCell className="text-sm">{log.response_status || '—'}</TableCell>
                  <TableCell>
                    {log.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{log.attempt_number}/3</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDetailLog(log)} aria-label="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{totalCount} registros</span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={(filters.page || 0) === 0}
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 0) - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm flex items-center px-2">
              {(filters.page || 0) + 1} / {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              disabled={(filters.page || 0) >= totalPages - 1}
              onClick={() => setFilters(f => ({ ...f, page: (f.page || 0) + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailLog} onOpenChange={open => { if (!open) setDetailLog(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Webhook</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div><span className="font-medium">Status:</span> {detailLog.response_status || 'N/A'}</div>
                <div><span className="font-medium">Tentativa:</span> {detailLog.attempt_number}/3</div>
                <div>
                  <span className="font-medium">Resultado:</span>{' '}
                  {detailLog.success ? <span className="text-green-500">Sucesso</span> : <span className="text-destructive">Falha</span>}
                </div>
              </div>
              {detailLog.error_message && (
                <div className="text-sm text-destructive">
                  <span className="font-medium">Erro:</span> {detailLog.error_message}
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-1">Payload Enviado:</p>
                <ScrollArea className="h-[200px] rounded-md border p-3">
                  <pre className="text-xs">{JSON.stringify(detailLog.payload, null, 2)}</pre>
                </ScrollArea>
              </div>
              {detailLog.response_body && (
                <div>
                  <p className="text-sm font-medium mb-1">Response Body:</p>
                  <ScrollArea className="h-[150px] rounded-md border p-3">
                    <pre className="text-xs">{detailLog.response_body}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
