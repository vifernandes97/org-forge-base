import { Button } from '@/components/ui/button';
import { Download, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { downloadCSV } from '@/lib/exportCsv';
import type { ImportPreview, ImportRowError } from '@/services/leadsImport';

interface Props {
  preview: ImportPreview;
  result?: { created: number; updated: number; failed: ImportRowError[] } | null;
}

function ErrorList({ errors }: { errors: ImportRowError[] }) {
  if (!errors.length) return null;
  return (
    <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {errors.length} linha(s) com problema
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCSV(
              errors.map(e => ({ Linha: e.line, Motivo: e.reason })),
              'linhas_com_erro.csv'
            )
          }
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Baixar erros
        </Button>
      </div>
      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
        {errors.slice(0, 50).map(e => (
          <li key={e.line}>
            Linha {e.line}: {e.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportSummaryStep({ preview, result }: Props) {
  if (result) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>
            {result.created} negócio(s) criado(s), {result.updated} atualizado(s) e {result.ignored} ignorado(s).
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Empresas: {result.companies.created} criada(s), {result.companies.reused} reaproveitada(s) · Contatos: {result.contacts.created} criado(s), {result.contacts.reused} reaproveitado(s).
        </p>
        <ErrorList errors={result.failed} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-semibold">{preview.toCreate.length}</p>
          <p className="text-xs text-muted-foreground">Negócios novos</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="flex items-center justify-center gap-1 text-2xl font-semibold">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            {preview.toUpdate.length}
          </p>
          <p className="text-xs text-muted-foreground">A atualizar</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-semibold">{preview.errors.length}</p>
          <p className="text-xs text-muted-foreground">Com erro</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border p-3">
          <p className="font-medium">Empresas</p>
          <p className="text-xs text-muted-foreground">{preview.companies.created} nova(s) · {preview.companies.reused} reaproveitada(s)</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="font-medium">Contatos</p>
          <p className="text-xs text-muted-foreground">{preview.contacts.created} novo(s) · {preview.contacts.reused} reaproveitado(s)</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Negócios: {preview.toCreate.length} a criar, {preview.toUpdate.length} a atualizar, {preview.ignored} ignorado(s).
        Negócios que já existem mantêm a etapa atual e recebem apenas os dados que estavam em branco.
      </p>
      <ErrorList errors={preview.errors} />
    </div>
  );
}
