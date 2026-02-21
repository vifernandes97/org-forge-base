import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useInboundWebhookLogs, useInboundWebhooks } from '@/hooks/useInboundWebhooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function InboundWebhookLogsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [webhookFilter, setWebhookFilter] = useState(searchParams.get('webhook') || '');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: webhooks } = useInboundWebhooks();
  const { data: logsData, isLoading } = useInboundWebhookLogs({
    webhookId: webhookFilter || undefined,
    action: actionFilter ? [actionFilter] : undefined,
    page,
    pageSize: 50,
  });

  const logs = logsData?.data || [];
  const totalCount = logsData?.count || 0;
  const totalPages = Math.ceil(totalCount / 50);

  const actionColor = (action: string) => {
    switch (action) {
      case 'created': return 'default';
      case 'updated': return 'secondary';
      case 'ignored': return 'outline';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/inbound-webhooks')} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Logs de Webhooks de Entrada</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-3">
            <Select value={webhookFilter} onValueChange={v => { setWebhookFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os webhooks" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {webhooks?.map((wh: any) => <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Todas as ações" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                <SelectItem value="created">Criado</SelectItem>
                <SelectItem value="updated">Atualizado</SelectItem>
                <SelectItem value="ignored">Ignorado</SelectItem>
                <SelectItem value="error">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum log encontrado.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => (
                      <>
                        <TableRow key={log.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">{(log as any).inbound_webhooks?.name || '—'}</TableCell>
                          <TableCell><Badge variant={actionColor(log.action) as any}>{log.action}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">{log.lead_id ? log.lead_id.slice(0, 8) + '...' : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.ip_address || '—'}</TableCell>
                          <TableCell>
                            {expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </TableCell>
                        </TableRow>
                        {expandedId === log.id && (
                          <TableRow key={`${log.id}-detail`}>
                            <TableCell colSpan={6}>
                              <div className="grid gap-3 md:grid-cols-2 p-2 text-xs">
                                <div>
                                  <p className="font-semibold mb-1">Raw Payload</p>
                                  <pre className="bg-muted p-2 rounded overflow-auto max-h-48">{JSON.stringify(log.raw_payload, null, 2)}</pre>
                                </div>
                                <div>
                                  <p className="font-semibold mb-1">Mapped Data</p>
                                  <pre className="bg-muted p-2 rounded overflow-auto max-h-48">{JSON.stringify(log.mapped_data, null, 2)}</pre>
                                </div>
                                {log.changes_applied && (
                                  <div>
                                    <p className="font-semibold mb-1">Changes</p>
                                    <pre className="bg-muted p-2 rounded overflow-auto max-h-48">{JSON.stringify(log.changes_applied, null, 2)}</pre>
                                  </div>
                                )}
                                {log.error_message && (
                                  <div>
                                    <p className="font-semibold mb-1 text-destructive">Erro</p>
                                    <p className="text-destructive">{log.error_message}</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">{totalCount} registros</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <span className="text-sm py-1">{page + 1} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
