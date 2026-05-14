import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowDownToLine, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react';
import { useInboundWebhooks, useCreateInboundWebhook, useUpdateInboundWebhook, useDeleteInboundWebhook } from '@/hooks/useInboundWebhooks';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useFunnels } from '@/hooks/useFunnels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function InboundWebhooksPage() {
  const { organization } = useOrganization();
  const { data: webhooks, isLoading } = useInboundWebhooks();
  const createMutation = useCreateInboundWebhook();
  const updateMutation = useUpdateInboundWebhook();
  const deleteMutation = useDeleteInboundWebhook();
  const { data: funnels } = useFunnels();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!organization) return;
    try {
      const result = await createMutation.mutateAsync({
        organization_id: organization.id,
        name: 'Novo Webhook de Entrada',
      });
      toast({ title: 'Webhook criado!' });
      navigate(`/settings/inbound-webhooks/${(result as any).id}`);
    } catch (err: any) {
      toast({ title: 'Erro ao criar webhook', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggle = async (wh: any) => {
    try {
      await updateMutation.mutateAsync({ id: wh.id, is_active: !wh.is_active });
      toast({ title: wh.is_active ? 'Webhook desativado' : 'Webhook ativado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Webhook excluído' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks de Entrada</h1>
          <p className="text-muted-foreground">Capture negócios automaticamente a partir de formulários externos.</p>
        </div>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />Novo Webhook
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowDownToLine className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum webhook de entrada configurado</h3>
            <p className="text-muted-foreground mb-4">Crie um webhook para receber negócios de formulários Elementor, Typeform e outros.</p>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              <Plus className="h-4 w-4 mr-2" />Criar primeiro webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {webhooks.map((wh: any) => {
            const funnelName = funnels?.find((f: any) => f.id === wh.funnel_id)?.name || 'Funil padrão';
            return (
              <Card key={wh.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/settings/inbound-webhooks/${wh.id}`)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{wh.name}</CardTitle>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(wh)} aria-label={wh.is_active ? 'Desativar' : 'Ativar'}>
                        {wh.is_active ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive" aria-label="Excluir webhook">×</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir webhook?</AlertDialogTitle>
                            <AlertDialogDescription>Isso removerá o webhook e todos os logs associados.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(wh.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={wh.is_active ? 'default' : 'secondary'}>{wh.is_active ? 'Ativo' : 'Inativo'}</Badge>
                    <span>→ {funnelName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Criado {formatDistanceToNow(new Date(wh.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ExternalLink className="h-4 w-4" />
            <span>Veja todos os logs de entrada em </span>
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/settings/inbound-webhooks/logs')}>Logs de Webhooks</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
