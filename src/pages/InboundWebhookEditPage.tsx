import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, RefreshCw, Send, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useInboundWebhook, useUpdateInboundWebhook, useRegenerateApiKey, useTestInboundWebhook, useInboundWebhookLogsByWebhook } from '@/hooks/useInboundWebhooks';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useFunnels } from '@/hooks/useFunnels';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { TagsInput } from '@/components/leads/TagsInput';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DEFAULT_TEST_PAYLOAD = JSON.stringify({
  "your-name": "João Silva",
  "your-email": "joao@example.com",
  "your-phone": "+5511999999999",
  "company": "Empresa Teste",
  "your-message": "Tenho interesse no produto"
}, null, 2);

const CRM_FIELD_GROUPS = [
  { title: 'Empresa', fields: [
    { key: 'company_trade_name', label: 'Nome fantasia', placeholder: 'ex: nome_fantasia' },
    { key: 'company_legal_name', label: 'Razão social', placeholder: 'ex: razao_social' },
    { key: 'company_cnpj', label: 'CNPJ', placeholder: 'ex: cnpj' },
    { key: 'company_instagram', label: 'Instagram', placeholder: 'ex: instagram' },
    { key: 'company_segment', label: 'Segmento', placeholder: 'ex: segmento' },
    { key: 'company', label: 'Empresa (texto livre: vira segmento se for um, senão nome fantasia)', placeholder: 'ex: company' },
  ] },
  { title: 'Contato', fields: [
    { key: 'contact_name', label: 'Nome', placeholder: 'ex: your-name' },
    { key: 'contact_email', label: 'E-mail', placeholder: 'ex: your-email' },
    { key: 'contact_phone', label: 'Telefone', placeholder: 'ex: your-phone' },
  ] },
  { title: 'Negócio', fields: [
    { key: 'value', label: 'Valor', placeholder: 'ex: budget' },
    { key: 'notes', label: 'Notas', placeholder: 'ex: your-message' },
  ] },
];

/** Saved mappings with legacy keys open on the matching new field. */
const LEGACY_KEY_MAP: Record<string, string> = {
  name: 'contact_name', email: 'contact_email', phone: 'contact_phone', company_name: 'company_legal_name',
};
function upgradeMapping(fm: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fm)) {
    const nk = LEGACY_KEY_MAP[k] || k;
    if (v && !out[nk]) out[nk] = v;
  }
  return out;
}

export default function InboundWebhookEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === 'new';
  const { data: webhook, isLoading } = useInboundWebhook(isNew ? undefined : id);
  const updateMutation = useUpdateInboundWebhook();
  const regenerateMutation = useRegenerateApiKey();
  const testMutation = useTestInboundWebhook();
  const { data: logs } = useInboundWebhookLogsByWebhook(isNew ? undefined : id);
  const { data: customFields } = useCustomFields();
  const { data: funnels } = useFunnels();
  const { data: members } = useOrgMembers();
  const { organization } = useOrganization();

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [funnelId, setFunnelId] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [defaultSource, setDefaultSource] = useState('formulário');
  const [defaultTags, setDefaultTags] = useState<string[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState('update');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [customFieldMapping, setCustomFieldMapping] = useState<Record<string, string>>({});
  const [testPayload, setTestPayload] = useState(DEFAULT_TEST_PAYLOAD);
  const [testResult, setTestResult] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showElementor, setShowElementor] = useState(false);

  useEffect(() => {
    if (webhook) {
      setName((webhook as any).name || '');
      setIsActive((webhook as any).is_active ?? true);
      setFunnelId((webhook as any).funnel_id || '');
      setAssignedTo((webhook as any).default_assigned_to || '');
      setDefaultSource((webhook as any).default_source || 'formulário');
      setDefaultTags((webhook as any).default_tags || []);
      setDuplicateStrategy((webhook as any).duplicate_strategy || 'update');
      const fm = (webhook as any).field_mapping || {};
      const { custom_fields, ...rest } = fm;
      setFieldMapping(upgradeMapping(rest as Record<string, string>));
      setCustomFieldMapping(custom_fields || {});
    }
  }, [webhook]);

  const endpointUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-webhook`;
  const apiKey = (webhook as any)?.api_key || '';

  const handleSave = async () => {
    if (!id || isNew) return;
    try {
      await updateMutation.mutateAsync({
        id,
        name,
        is_active: isActive,
        funnel_id: funnelId || null,
        default_assigned_to: assignedTo || null,
        default_source: defaultSource,
        default_tags: defaultTags,
        duplicate_strategy: duplicateStrategy,
        field_mapping: { ...fieldMapping, custom_fields: customFieldMapping },
      });
      toast({ title: 'Webhook atualizado!' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copiado!` });
  };

  const handleRegenerate = async () => {
    if (!id) return;
    try {
      await regenerateMutation.mutateAsync(id);
      toast({ title: 'API Key regenerada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleTest = async () => {
    if (!apiKey) return;
    setTestResult(null);
    try {
      const payload = JSON.parse(testPayload);
      const result = await testMutation.mutateAsync({ apiKey, payload });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    }
  };

  const activeCustomFields = customFields?.filter((cf: any) => cf.is_active) || [];

  if (isLoading && !isNew) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings/inbound-webhooks')} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isNew ? 'Novo Webhook de Entrada' : 'Editar Webhook'}</h1>
      </div>

      {/* Section 1 - General */}
      <Card>
        <CardHeader><CardTitle>Configuração Geral</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Nome</Label>
              <Input id="wh-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Form Landing Page" />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="wh-active" />
              <Label htmlFor="wh-active">{isActive ? 'Ativo' : 'Inativo'}</Label>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Funil destino</Label>
              <Select value={funnelId || '__default__'} onValueChange={v => setFunnelId(v === '__default__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Funil padrão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Funil padrão</SelectItem>
                  {funnels?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsável padrão</Label>
              <Select value={assignedTo || '__none__'} onValueChange={v => setAssignedTo(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {members?.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wh-source">Fonte padrão</Label>
              <Input id="wh-source" value={defaultSource} onChange={e => setDefaultSource(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tags padrão</Label>
              <TagsInput value={defaultTags} onChange={setDefaultTags} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estratégia de duplicados</Label>
            <RadioGroup value={duplicateStrategy} onValueChange={setDuplicateStrategy} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="update" id="strat-update" />
                <Label htmlFor="strat-update" className="font-normal">Atualizar negócio existente <span className="text-muted-foreground">(recomendado)</span></Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="create_new" id="strat-new" />
                <Label htmlFor="strat-new" className="font-normal">Criar novo negócio sempre</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ignore" id="strat-ignore" />
                <Label htmlFor="strat-ignore" className="font-normal">Ignorar se e-mail já existe</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateMutation.isPending || !name.trim()}>Salvar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2 - URL & API Key */}
      {!isNew && (
        <Card>
          <CardHeader><CardTitle>URL e API Key</CardTitle><CardDescription>Use estas credenciais no seu formulário externo.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <div className="flex gap-2">
                <Input value={endpointUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(endpointUrl, 'URL')} aria-label="Copiar URL">
                  {copied === 'URL' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Input value={apiKey} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(apiKey, 'API Key')} aria-label="Copiar API Key">
                  {copied === 'API Key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Regenerar API Key"><RefreshCw className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regenerar API Key?</AlertDialogTitle>
                      <AlertDialogDescription>A key anterior será invalidada imediatamente.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRegenerate}>Regenerar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <Collapsible open={showElementor} onOpenChange={setShowElementor}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="gap-2 text-sm">
                  {showElementor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Como configurar no Elementor
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-lg bg-muted p-4 mt-2 text-sm space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>No Elementor, edite seu formulário.</li>
                    <li>Vá em "Actions After Submit" (Ações Após Envio).</li>
                    <li>Adicione a ação "Webhook".</li>
                    <li>No campo URL, cole: <code className="bg-background px-1 rounded">{endpointUrl}</code></li>
                    <li>Em "Advanced" adicione o header: <code>X-API-Key: {apiKey}</code></li>
                    <li>Salve e publique.</li>
                    <li>Os IDs dos campos (aba Advanced → campo "ID") devem corresponder ao mapeamento abaixo.</li>
                  </ol>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Section 3 - Field Mapping */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Mapeamento de Campos</CardTitle>
            <Tooltip>
              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Digite o nome/ID do campo no seu formulário. Se vazio, o sistema tenta detectar automaticamente.
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CRM_FIELD_GROUPS.map((g, gi) => (
              <div key={g.title} className="space-y-3">
                {gi > 0 && <Separator className="my-4" />}
                <p className="text-sm font-semibold text-muted-foreground">{g.title}</p>
                {g.fields.map(f => (
                  <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                    <Label className="text-sm font-medium">{f.label} <span className="text-muted-foreground">({f.key})</span></Label>
                    <Input
                      placeholder={f.placeholder}
                      value={fieldMapping[f.key] || ''}
                      onChange={e => setFieldMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            ))}
            {activeCustomFields.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-sm font-semibold text-muted-foreground">Campos Personalizados</p>
                {activeCustomFields.map((cf: any) => (
                  <div key={cf.id} className="grid grid-cols-2 gap-3 items-center">
                    <Label className="text-sm font-medium">{cf.field_label} <span className="text-muted-foreground">({cf.field_name})</span></Label>
                    <Input
                      placeholder={`ex: ${cf.field_name}`}
                      value={customFieldMapping[cf.field_name] || ''}
                      onChange={e => setCustomFieldMapping(prev => ({ ...prev, [cf.field_name]: e.target.value }))}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>Salvar mapeamento</Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 4 - Test */}
      {!isNew && (
        <Card>
          <CardHeader><CardTitle>Testar Webhook</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="font-mono text-xs min-h-[150px]"
              value={testPayload}
              onChange={e => setTestPayload(e.target.value)}
              placeholder="Cole seu payload JSON aqui..."
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleTest} disabled={testMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />Enviar teste
              </Button>
              {testMutation.isPending && <span className="text-sm text-muted-foreground">Enviando...</span>}
            </div>
            {testResult && (
              <div className={`rounded-lg p-4 text-sm font-mono ${testResult.success ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}>
                <pre className="whitespace-pre-wrap">{JSON.stringify(testResult, null, 2)}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 5 - Recent Logs */}
      {!isNew && logs && logs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Logs Recentes</CardTitle>
              <Button variant="link" onClick={() => navigate(`/settings/inbound-webhooks/logs?webhook=${id}`)}>Ver todos</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(logs as any[]).slice(0, 20).map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.action === 'created' ? 'default' : log.action === 'updated' ? 'secondary' : log.action === 'error' ? 'destructive' : 'outline'}>
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  {log.ip_address && <span className="text-xs text-muted-foreground">{log.ip_address}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
