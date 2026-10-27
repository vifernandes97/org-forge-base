import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  createAiCredential, deleteAiCredential, getAiCredentials, getCredentialModels, getOrgAiSettings,
  getTranscriptionSecondsThisMonth, saveOrgAiSettings, testAnalysis, type AiCredential, type AiProvider, type AnalysisAction,
  type OrgAiSettings, type TestAnalysisResult,
} from '@/services/ai';

type Tarefa = 'transcription' | 'analysis';

/** Modelo sugerido ao escolher a credencial (o usuário troca à vontade). */
const PROVEDORES: Record<AiProvider, { nome: string; dica: string; sugestao: Partial<Record<Tarefa, string>> }> = {
  groq: { nome: 'Groq', dica: 'Transcrição grátis (whisper-large-v3-turbo) e modelos abertos para análise. Chave em console.groq.com.', sugestao: { transcription: 'whisper-large-v3-turbo' } },
  openai: { nome: 'OpenAI', dica: 'Transcrição (gpt-4o-mini-transcribe) e modelos GPT para análise. Chave em platform.openai.com.', sugestao: { transcription: 'gpt-4o-mini-transcribe' } },
  anthropic: { nome: 'Anthropic (Claude)', dica: 'Modelos Claude para a análise das conversas, com leitura de imagens. Chave em console.anthropic.com.', sugestao: { analysis: 'claude-opus-5-5' } },
  google: { nome: 'Google Gemini', dica: 'Modelos Gemini para a análise. Chave em aistudio.google.com.', sugestao: {} },
  openai_compatible: { nome: 'Compatível com OpenAI', dica: 'OpenRouter, DeepSeek, Ollama/Whisper na VPS, etc. Informe a URL base (…/v1).', sugestao: {} },
};

/** Só estes falam a API de áudio (transcrição). */
const TRANSCREVEM: AiProvider[] = ['groq', 'openai', 'openai_compatible'];

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
      toast.success('Chave conferida e salva', { description: `${r.models} modelos disponíveis` });
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
function EscolhaDeModelo({ tarefa, titulo, credenciais: todas, credId, modelo, opcional, onChange }: {
  tarefa: Tarefa; titulo: string; credenciais: AiCredential[]; credId: string | null; modelo: string | null; opcional?: boolean;
  onChange: (credId: string | null, modelo: string | null) => void;
}) {
  const credenciais = tarefa === 'transcription' ? todas.filter(c => TRANSCREVEM.includes(c.provider)) : todas;
  const { data, isFetching, error } = useQuery({
    queryKey: ['ai-models', credId, tarefa],
    queryFn: () => getCredentialModels(credId!, tarefa),
    enabled: !!credId,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const modelos = data?.models ?? [];

  const trocarCredencial = (v: string) => {
    if (v === NENHUMA) return onChange(null, null);
    const cred = credenciais.find(c => c.id === v);
    onChange(v, cred ? PROVEDORES[cred.provider].sugestao[tarefa] ?? null : null);
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
            {modelo && !modelos.some(m => m.id === modelo) && <SelectItem value={modelo}>{modelo}</SelectItem>}
            {modelos.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome !== m.id ? `${m.nome} · ${m.id}` : m.id}{tarefa === 'analysis' && m.visao ? ' · lê imagens' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
        {credId && !isFetching && !error && !modelos.length && (
          <p className="text-xs text-muted-foreground">Essa chave não lista modelos {tarefa === 'transcription' ? 'de transcrição' : 'de texto'}.</p>
        )}
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
            <EscolhaDeModelo tarefa="transcription" titulo="Credencial principal" credenciais={credenciais}
              credId={form.transcription_credential_id ?? null} modelo={form.transcription_model ?? null}
              onChange={(c, m) => setForm(f => ({ ...f, transcription_credential_id: c, transcription_model: m }))} />
            <EscolhaDeModelo tarefa="transcription" titulo="Reserva (se a principal bater no limite)" credenciais={credenciais} opcional
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

const ESTADO: Record<AnalysisAction['state'], { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  applied: { label: 'Faria', variant: 'default' },
  pending: { label: 'Sugeriria', variant: 'outline' },
  skipped: { label: 'Não faria', variant: 'secondary' },
};

function descreverAcao(a: AnalysisAction): string {
  const p = a.payload;
  switch (a.type) {
    case 'note': return `Registrar resumo: "${p.resumo}"`;
    case 'stage_change': return `Mudar etapa para ${p.para}${a.confidence != null ? ` (confiança ${Math.round(a.confidence * 100)}%)` : ''}: ${p.motivo}`;
    case 'task': return `Criar tarefa "${p.titulo}" para daqui a ${p.prazo_dias} dia(s)`;
    case 'field_update': return `Atualizar valor para R$ ${Number(p.valor).toLocaleString('pt-BR')}: ${p.motivo}`;
    case 'create_lead': return `Criar negócio${p.empresa ? ` para ${p.empresa}` : ''}${p.contato ? ` (contato ${p.contato})` : ''}`;
    case 'classify': return 'Marcar conversa como não comercial';
  }
}

function Analise({ credenciais }: { credenciais: AiCredential[] }) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();
  const { data: salvo, isLoading } = useQuery({ queryKey: ['org-ai-settings', orgId], queryFn: () => getOrgAiSettings(orgId!), enabled: !!orgId });
  const [form, setForm] = useState<Partial<OrgAiSettings>>({});
  const [teste, setTeste] = useState<TestAnalysisResult | null>(null);

  useEffect(() => {
    setForm(salvo ?? {});
  }, [salvo]);

  const valor = <K extends keyof OrgAiSettings>(k: K, padrao: OrgAiSettings[K]) => (form[k] ?? padrao) as OrgAiSettings[K];
  const ligado = valor('analysis_enabled', true);
  const pct = (k: 'stage_min_confidence' | 'stage_back_min_confidence', padrao: number) => Math.round(Number(valor(k, padrao)) * 100);
  const setPct = (k: 'stage_min_confidence' | 'stage_back_min_confidence', v: string) => {
    const n = Math.max(50, Math.min(100, Number(v) || 0));
    setForm(f => ({ ...f, [k]: n / 100 }));
  };

  const salvar = useMutation({
    mutationFn: () => saveOrgAiSettings({
      organization_id: orgId!,
      analysis_enabled: ligado,
      analysis_credential_id: form.analysis_credential_id ?? null,
      analysis_model: form.analysis_model ?? null,
      analysis_fallback_credential_id: form.analysis_fallback_credential_id ?? null,
      analysis_fallback_model: form.analysis_fallback_model ?? null,
      autonomy: 'auto',
      stage_min_confidence: Number(valor('stage_min_confidence', 0.8)),
      stage_back_min_confidence: Number(valor('stage_back_min_confidence', 0.9)),
      create_leads: valor('create_leads', true),
      instructions: form.instructions?.trim() || null,
    }),
    onSuccess: () => {
      toast.success('Análise salva');
      qc.invalidateQueries({ queryKey: ['org-ai-settings'] });
    },
    onError: e => toast.error('Não foi possível salvar', { description: e.message }),
  });

  const testar = useMutation({
    mutationFn: () => testAnalysis(orgId!),
    onSuccess: setTeste,
    onError: e => toast.error('Teste falhou', { description: e.message }),
  });

  const semPrincipal = ligado && (!form.analysis_credential_id || !form.analysis_model);
  const alterado = JSON.stringify(form) !== JSON.stringify(salvo ?? {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Análise das conversas</CardTitle>
            <CardDescription>
              A IA lê cada conversa do WhatsApp alguns minutos depois da última mensagem e atualiza o negócio: resumo na linha do tempo, tarefas, valor e etapa.
            </CardDescription>
          </div>
          <Switch checked={ligado} aria-label="Analisar conversas" onCheckedChange={v => setForm(f => ({ ...f, analysis_enabled: v }))} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? <Skeleton className="h-40" /> : (
          <>
            <EscolhaDeModelo tarefa="analysis" titulo="Credencial principal" credenciais={credenciais}
              credId={form.analysis_credential_id ?? null} modelo={form.analysis_model ?? null}
              onChange={(c, m) => setForm(f => ({ ...f, analysis_credential_id: c, analysis_model: m }))} />
            <EscolhaDeModelo tarefa="analysis" titulo="Reserva (se a principal falhar)" credenciais={credenciais} opcional
              credId={form.analysis_fallback_credential_id ?? null} modelo={form.analysis_fallback_model ?? null}
              onChange={(c, m) => setForm(f => ({ ...f, analysis_fallback_credential_id: c, analysis_fallback_model: m }))} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ia-conf">Confiança mínima para mudar de etapa (%)</Label>
                <Input id="ia-conf" type="number" min={50} max={100} value={pct('stage_min_confidence', 0.8)}
                  onChange={e => setPct('stage_min_confidence', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ia-conf-volta">Para voltar uma etapa (%)</Label>
                <Input id="ia-conf-volta" type="number" min={50} max={100} value={pct('stage_back_min_confidence', 0.9)}
                  onChange={e => setPct('stage_back_min_confidence', e.target.value)} />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              A mudança de etapa dispara o webhook e as automações da etapa, como no Kanban. Abaixo da confiança mínima, a IA só registra o resumo.
            </p>

            <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Criar negócio para número desconhecido</div>
                <div className="text-xs text-muted-foreground">Quando a conversa é comercial e o número não está no CRM. Conversas pessoais e de fornecedores são ignoradas.</div>
              </div>
              <Switch checked={valor('create_leads', true)} aria-label="Criar negócio para número desconhecido"
                onCheckedChange={v => setForm(f => ({ ...f, create_leads: v }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ia-instr">Instruções para a IA (opcional)</Label>
              <Textarea id="ia-instr" rows={4} value={form.instructions ?? ''} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                placeholder={'Ex.: "Proposta enviada" = mandamos o PDF da proposta.\n"Ganho" só quando o cliente confirma o pagamento.'} />
              <p className="text-xs text-muted-foreground">Explique o que significa cada etapa do seu funil e regras do seu negócio. É o que mais melhora as decisões.</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => testar.mutate()} disabled={testar.isPending || alterado || !salvo?.analysis_model}
                title={alterado ? 'Salve antes de testar' : undefined}>
                {testar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}Testar com a conversa mais recente
              </Button>
              <Button onClick={() => salvar.mutate()} disabled={semPrincipal || salvar.isPending}>
                {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </div>
            {semPrincipal && <p className="text-right text-xs text-muted-foreground">Escolha a credencial e o modelo principal para ligar a análise.</p>}

            {teste && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Teste: {teste.chat.push_name || (teste.chat.phone_digits ? `+${teste.chat.phone_digits}` : 'conversa')}</span>
                  <span className="text-xs text-muted-foreground">Nada foi gravado</span>
                </div>
                {teste.resultado.status === 'done' ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {teste.resultado.mensagens} mensagens · {teste.resultado.provedor} {teste.resultado.modelo}
                      {teste.resultado.tokensEntrada != null && ` · ${teste.resultado.tokensEntrada.toLocaleString('pt-BR')} tokens de entrada, ${teste.resultado.tokensSaida?.toLocaleString('pt-BR')} de saída`}
                    </p>
                    {!teste.resultado.acoes.length && <p>Nada a fazer neste lote.</p>}
                    <ul className="space-y-2">
                      {teste.resultado.acoes.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge variant={ESTADO[a.state].variant} className="shrink-0">{ESTADO[a.state].label}</Badge>
                          <span>{descreverAcao(a)}{a.reason && <span className="text-muted-foreground"> — {a.reason}</span>}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className={teste.resultado.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                    {teste.resultado.status === 'error' ? teste.resultado.erro : teste.resultado.motivo}
                  </p>
                )}
              </div>
            )}
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
            <p className="text-sm text-muted-foreground">Nenhum provedor conectado. Conecte um provedor para a análise (ex.: Anthropic) e a Groq para transcrever áudio sem custo.</p>
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

      <Analise credenciais={credenciais ?? []} />

      <Transcricao credenciais={credenciais ?? []} />

      <NovaCredencialDialog open={nova} onOpenChange={setNova} />
    </div>
  );
}
