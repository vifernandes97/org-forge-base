import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import { useCustomFields } from '@/hooks/useCustomFields';
import { downloadCSV } from '@/lib/exportCsv';
import { guessMapping, parseSpreadsheet, NATIVE_TARGETS, type SheetRow } from '@/lib/spreadsheet';
import {
  buildImportPreview,
  runImport,
  type ImportPreview,
  type ImportResult,
} from '@/services/leadsImport';
import { ColumnMappingStep } from './ColumnMappingStep';
import { ImportSummaryStep } from './ImportSummaryStep';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFunnelId?: string;
}

export function ImportLeadsDialog({ open, onOpenChange, defaultFunnelId }: Props) {
  const qc = useQueryClient();
  const { organization } = useOrganization();
  const { user } = useAuth();
  const orgId = organization?.id;
  const { data: funnels } = useFunnels();
  const { data: customFields } = useCustomFields();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [funnelId, setFunnelId] = useState(defaultFunnelId || '');
  const [stageId, setStageId] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const { data: stages } = useStages(funnelId || undefined);
  const activeCustomFields = (customFields || []).filter(f => f.is_active);

  // Keep the funnel in sync with the page selection whenever the dialog opens
  useEffect(() => {
    if (open && defaultFunnelId) setFunnelId(defaultFunnelId);
  }, [open, defaultFunnelId]);

  // Pre-select the first stage of the chosen funnel
  useEffect(() => {
    if (!stageId && stages?.length) setStageId(stages[0].id);
  }, [stages, stageId]);

  const reset = () => {
    setStep(1);
    setFileName('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreview(null);
    setResult(null);
    setProgress(null);
    setStageId('');
    setFunnelId(defaultFunnelId || '');
  };

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) reset();
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parseSpreadsheet(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        toast.error('A planilha está vazia ou sem cabeçalho.');
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(guessMapping(parsed.headers, activeCustomFields));
      setStep(2);
    } catch {
      toast.error('Não foi possível ler a planilha. Use CSV ou Excel (.xlsx).');
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const row: Record<string, string> = {};
    NATIVE_TARGETS.forEach(t => (row[t.label] = ''));
    activeCustomFields.forEach(f => (row[f.field_label] = ''));
    downloadCSV([row], 'modelo_negocios.csv');
  };

  const goToSummary = async () => {
    if (!orgId) return;
    if (!funnelId) {
      toast.error('Escolha o funil da importação.');
      return;
    }
    const mapped = Object.values(mapping).filter(Boolean);
    if (!mapped.length) {
      toast.error('Relacione ao menos uma coluna.');
      return;
    }
    setBusy(true);
    try {
      const p = await buildImportPreview({ orgId, funnelId, rows, mapping });
      setPreview(p);
      setStep(3);
    } catch {
      toast.error('Erro ao preparar a importação.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!orgId || !user || !preview || !funnelId || !stageId) return;
    setBusy(true);
    setProgress({ done: 0, total: preview.toCreate.length + preview.toUpdate.length });
    try {
      const res = await runImport({
        orgId,
        funnelId,
        stageId,
        userId: user.id,
        preview,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
      qc.invalidateQueries({ queryKey: ['leads-kanban'] });
      qc.invalidateQueries({ queryKey: ['leads-list'] });
      qc.invalidateQueries({ queryKey: ['funnel-metrics'] });
      toast.success(`${res.created} criado(s), ${res.updated} atualizado(s).`);
    } catch {
      toast.error('Erro ao importar a planilha.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const stageOptions = stages || [];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar negócios por planilha</DialogTitle>
          <DialogDescription>
            {step === 1 && 'Envie um arquivo CSV ou Excel (.xlsx) com os negócios.'}
            {step === 2 && `${rows.length} linha(s) encontradas em ${fileName}.`}
            {step === 3 && 'Escolha o funil e a etapa de entrada e confirme.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          {step === 1 && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center hover:bg-muted/50">
                {busy ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">Clique para escolher o arquivo</span>
                <span className="text-xs text-muted-foreground">CSV ou Excel (.xlsx)</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) handleFile(f);
                  }}
                />
              </label>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Baixar modelo de planilha
              </Button>
            </div>
          )}

          {step === 2 && (
            <ColumnMappingStep
              headers={headers}
              sample={rows.slice(0, 5)}
              mapping={mapping}
              customFields={activeCustomFields}
              onChange={(header, target) => setMapping(m => ({ ...m, [header]: target }))}
            />
          )}

          {step === 3 && preview && (
            <div className="space-y-4">
              {!result && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Funil</Label>
                    <Select
                      value={funnelId}
                      onValueChange={v => {
                        setFunnelId(v);
                        setStageId('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {(funnels || []).map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Etapa de entrada</Label>
                    <Select value={stageId} onValueChange={setStageId} disabled={!funnelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {stageOptions.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <ImportSummaryStep preview={preview} result={result} />
              {progress && (
                <p className="text-xs text-muted-foreground">
                  Importando {progress.done} de {progress.total}...
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
                Voltar
              </Button>
              <Button onClick={goToSummary} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continuar
              </Button>
            </>
          )}
          {step === 3 && !result && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} disabled={busy}>
                Voltar
              </Button>
              <Button
                onClick={confirmImport}
                disabled={busy || !funnelId || !stageId || (!preview?.toCreate.length && !preview?.toUpdate.length)}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importar
              </Button>
            </>
          )}
          {(step === 1 || result) && (
            <Button variant={result ? 'default' : 'outline'} onClick={() => close(false)}>
              {result ? 'Concluir' : 'Cancelar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
