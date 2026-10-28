import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getOrbiIntegration, orbiCallbackUrl, removeOrbiIntegration, saveOrbiIntegration } from '@/services/orbi';

export default function OrbiSettingsPage() {
  const { organization, isOwner, isAdmin } = useOrganization();
  const canManage = isOwner || isAdmin;
  const orgId = organization?.id;
  const qc = useQueryClient();
  const { data: integ, isLoading } = useQuery({
    queryKey: ['orbi-integration', orgId],
    queryFn: () => getOrbiIntegration(orgId!),
    enabled: !!orgId && canManage,
  });
  const [baseUrl, setBaseUrl] = useState('https://orbi.neosoluti.com.br');
  const [apiKey, setApiKey] = useState('');
  const [secret, setSecret] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['orbi-integration'] });
  const save = useMutation({
    mutationFn: () => saveOrbiIntegration({ organization_id: orgId!, base_url: baseUrl.trim(), api_key: apiKey.trim(), callback_secret: secret.trim() }),
    onSuccess: () => { toast.success('Orbi conectado'); setApiKey(''); setSecret(''); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => removeOrbiIntegration(orgId!),
    onSuccess: () => { toast.success('Integração removida'); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) return null;
  const callback = orbiCallbackUrl(orgId);
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast.success('Copiado'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarCheck className="h-6 w-6" /> Orbi</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tarefas do tipo Reunião viram pedidos de reunião no Orbi. O responsável confirma lá e a tarefa é concluída aqui.
          {!canManage && ' Somente proprietários e administradores podem configurar.'}
        </p>
      </div>

      {canManage && (
        <>
          <section className="space-y-2 rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-sm">1. URL de retorno</h2>
            <p className="text-xs text-muted-foreground">
              No Orbi, em Configurações → Integrações da organização, crie uma integração com esta URL de retorno.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={callback} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={() => copy(callback)} aria-label="Copiar"><Copy className="h-4 w-4" /></Button>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border bg-card p-4">
            <h2 className="font-semibold text-sm">2. Chave e segredo</h2>
            {isLoading ? <Skeleton className="h-10 w-full" /> : integ && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={integ.last_error ? 'destructive' : 'secondary'}>{integ.last_error ? 'Com erro' : 'Conectado'}</Badge>
                <span className="text-muted-foreground">chave …{integ.key_last4} · {integ.base_url}</span>
                {integ.last_ok_at && (
                  <span className="text-xs text-muted-foreground">
                    último sucesso {formatDistanceToNow(new Date(integ.last_ok_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
                {integ.last_error && <p className="w-full text-xs text-destructive">{integ.last_error}</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Cole a chave (orbi_int_…) e o segredo de assinatura (orbi_whsec_…) que o Orbi mostrou ao criar a integração.
              {integ && ' Colar de novo substitui os atuais.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>URL do Orbi</Label>
                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Chave da integração</Label>
                <Input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="orbi_int_…" />
              </div>
              <div className="space-y-1.5">
                <Label>Segredo de assinatura</Label>
                <Input type="password" autoComplete="off" value={secret} onChange={e => setSecret(e.target.value)} placeholder="orbi_whsec_…" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save.mutate()} disabled={!apiKey.trim() || !secret.trim() || save.isPending}>
                {save.isPending ? 'Testando…' : integ ? 'Substituir' : 'Conectar'}
              </Button>
              {integ && (
                <Button variant="outline" className="text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  Remover integração
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
