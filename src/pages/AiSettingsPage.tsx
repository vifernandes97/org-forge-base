import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  createAiCredential, deleteAiCredential, getAiCredentials, getCredentialModels, getOrgAiSettings,
  getTranscriptionSecondsThisMonth, saveOrgAiSettings, type AiCredential, type AiProvider, type OrgAiSettings,
} from '@/services/ai';

const PROVEDORES: Record<AiProvider, { nome: string; dica: string; modelo: string }> = {
  groq: { nome: 'Groq', dica: 'Plano gratuito com transcrição (whisper-large-v3-turbo). Chave em console.groq.com.', modelo: 'whisper-large-v3-turbo' },
  openai: { nome: 'OpenAI', dica: 'Transcrição paga (gpt-4o-mini-transcribe). Chave em platform.openai.com.', modelo: 'gpt-4o-mini-transcribe' },
  openai_compatible: { nome: 'Compatível com OpenAI', dica: 'OpenRouter, Whisper na VPS, etc. Informe a URL base (…/v1).', modelo: '' },
};

const NENHUMA = '__none__';

function NovaCredencialDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { organization } = useOrganization();
  const qc = useQueryClient();
  const [provider, setProvider] = useState<AiProvider>('groq');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (open) { setProvider('groq'); setLabel(''); setBaseUrl(''); setApiKey(''); }
  }, [open]);

  const criar = useMutation({
    mutationFn: () => createAiCredential({
      organization_id: organization!.id, provider, label: label.trim() || PROVEDORES[provider].nome,
      base_url: provider === 'openai_compatible' ? baseUrl.trim() : null, api_key: apiKey.trim(),
    }),
    onSuccess: r => {
      toast.success('Chave conferida e salva', { description: `${r.models.length} modelos disponíveis` });
      qc.invalidateQueries({ queryKey: ['ai-credentials'] });
      onOpenChange(false);
    },
    onError: e => toast.error('Chave não aceita', { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar provedor de IA</DialogTitle>
          <DialogDescription>A chave é testada antes de salvar e fica cifrada. Depois disso, só os 4 últimos dígitos aparecem.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={v => setProvider(v as AiProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVEDORES) as AiProvider[]).map(p => <SelectItem key={p} value={p}>{PROVEDORES[p].nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{PROVEDORES[provider].dica}</p>
          </div>
          {provider === 'openai_compatible' && (
            <div className="space-y-2">
              <Label htmlFor="ia-url">URL base</Label>
              <Input id="ia-url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="ia-label">Apelido</Label>
            <Input id="ia-label" value={label} onChange={e => setLabel(e.target.value)} placeholder={PROVEDORES[provider].nome} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ia-key">Chave da API</Label>
            <Input id="ia-key" type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!apiKey.trim() || (provider === 'openai_compatible' && !baseUrl.trim()) || criar.isPending}>
            {criar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Testar e salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Credencial + modelo de uma tarefa; os modelos vêm da própria chave. */
function EscolhaDeModelo({ titulo, credenciais, credId, modelo, opcional, onChange }: {
  titulo: string; credenciais: AiCredential[]; credId: string | null; modelo: string | null; opcional?: boolean;
  onChange: (credId: string | null, modelo: string | null) => void;
}) {
  const { data, isFetching, error } = useQuery({
    queryKey: ['ai-models', credId, 'transcription'],
    queryFn: () => getCredentialModels(credId!, 'transcription'),
    enabled: !!credId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const modelos = data?.models ?? [];

  const trocarCredencial = (v: string) => {
    if (v === NENHUMA) return onChange(null, null);
    const cred = credenciais.find(c => c.id === v);
    onChange(v, cred ? PROVEDORES[cred.provider].modelo || null : null);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>{titulo}</Label>
        <Select value={credId ?? NENHUMA} onValueChange={trocarCredencial}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NENHUMA}>{opcional ? 'Sem reserva' : 'Nenhuma'}</SelectItem>
            {credenciais.map(c => <SelectItem key={c.id} value={c.id}>{c.label} · {PROVEDORES[c.provider].nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Modelo</Label>
        <Select value={modelo ?? ''} onValueChange={v => onChange(credId, v)} disabled={!credId}>
          <SelectTrigger>
            {isFetching ? <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Carregando</span> : <SelectValue placeholder="Escolha" />}
          </SelectTrigger>
          <SelectContent>
            {/* O modelo salvo continua visível mesmo se a lista não o trouxer. */}
            {[...new Set([...(modelo ? [modelo] : []), ...modelos])].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
        {credId && !isFetching && !error && !modelos.length && <p className="text-xs text-muted-foreground">Essa chave não lista modelos de transcrição.</p>}
      </div>
    </div>
  );
}

function Transcricao({ credenciais }: { credenciais: AiCredential[] }) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const { data: salvo, isLoading } = useQuery({ queryKey: ['org-ai-settings', orgId], queryFn: () => getOrgAiSettings(orgId!), enabled: !!orgId });
  const { data: segundos } = useQuery({ queryKey: ['ai-usage', orgId], queryFn: () => getTranscriptionSecondsThisMonth(orgId!), enabled: !!orgId });
  const [form, setForm] = useState<Partial<OrgAiSettings>>({});

  useEffect(() => {
    setForm(salvo ?? { transcription_enabled: true, transcription_language: 'pt' });
  }, [salvo]);

  const salvar = useMutation({
    mutationFn: () => saveOrgAiSettings({
      organization_id: orgId!,
      transcription_enabled: form.transcription_enabled ?? true,
      transcription_credential_id: form.transcription_credential_id ?? null,
      transcription_model: form.transcription_model ?? null,
      transcription_fallback_credential_id: form.transcription_fallback_credential_id ?? null,
      transcription_fallback_model: form.transcription_fallback_model ?? null,
      transcription_language: form.transcription_language || 'pt',
    }),
    onSuccess: () => {
      toast.success('Transcrição salva');
      qc.invalidateQueries({ queryKey: ['org-ai-settings'] });
    },
    onError: e => toast.error('Não foi possível salvar', { description: e.message }),
  });

  const semPrincipal = form.transcription_enabled !== false && (!form.transcription_credential_id || !form.transcription_model);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Transcrição de áudios</CardTitle>
            <CardDescription>Áudios do WhatsApp (recebidos e enviados) viram texto para a IA analisar a conversa.</CardDescription>
          </div>
          <Switch checked={form.transcription_enabled !== false} aria-label="Transcrever áudios"
            onCheckedChange={v => setForm(f => ({ ...f, transcription_enabled: v }))} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? <Skeleton className="h-24" /> : (
          <>
            <EscolhaDeModelo titulo="Credencial principal" credenciais={credenciais}
              credId={form.transcription_credential_id ?? null} modelo={form.transcription_model ?? null}
              onChange={(c, m) => setForm(f => ({ ...f, transcription_credential_id: c, transcription_model: m }))} />
            <EscolhaDeModelo titulo="Reserva (se a principal bater no limite)" credenciais={credenciais} opcional
              credId={form.transcription_fallback_credential_id ?? null} modelo={form.transcription_fallback_model ?? null}
              onChange={(c, m) => setForm(f => ({ ...f, transcription_fallback_credential_id: c, transcription_fallback_model: m }))} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Este mês: {segundos ? `${Math.round(segundos / 60)} min de áudio` : 'nenhum áudio transcrito'}
              </p>
              <Button onClick={() => salvar.mutate()} disabled={semPrincipal || salvar.isPending}>
                {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </div>
            {semPrincipal && <p className="text-xs text-muted-foreground">Escolha a credencial e o modelo principal para ligar a transcrição.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiSettingsPage() {
  const { organization, isOwner, isAdmin } = useOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const [nova, setNova] = useState(false);
  const { data: credenciais, isLoading } = useQuery({ queryKey: ['ai-credentials', orgId], queryFn: () => getAiCredentials(orgId!), enabled: !!orgId });

  const remover = useMutation({
    mutationFn: deleteAiCredential,
    onSuccess: () => {
      toast.success('Credencial removida');
      qc.invalidateQueries({ queryKey: ['ai-credentials'] });
      qc.invalidateQueries({ queryKey: ['org-ai-settings'] });
    },
    onError: e => toast.error(e.message),
  });

  if (!isOwner && !isAdmin) {
    return <p className="text-muted-foreground">Só owner ou admin configuram a inteligência artificial.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inteligência artificial</h1>
          <p className="text-muted-foreground">Provedores e modelos que a organização usa. Cada organização usa as próprias chaves.</p>
        </div>
        <Button onClick={() => setNova(true)}><Plus className="mr-2 h-4 w-4" />Conectar provedor</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Credenciais</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <Skeleton className="h-12" /> : !credenciais?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum provedor conectado. Para transcrever áudio sem custo, conecte a Groq.</p>
          ) : credenciais.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {PROVEDORES[c.provider]?.nome ?? c.provider} · ••••{c.key_last4}{c.base_url && ` · ${c.base_url}`}
                  </div>
                  {c.status === 'error' && c.last_error && <div className="text-xs text-destructive">{c.last_error}</div>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={c.status === 'ok' ? 'secondary' : 'destructive'}>{c.status === 'ok' ? 'OK' : 'Erro'}</Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label="Remover credencial"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover {c.label}?</AlertDialogTitle>
                      <AlertDialogDescription>As tarefas que usam esta chave ficam sem credencial até você escolher outra.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remover.mutate(c.id)}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Transcricao credenciais={credenciais ?? []} />

      <NovaCredencialDialog open={nova} onOpenChange={setNova} />
    </div>
  );
}
