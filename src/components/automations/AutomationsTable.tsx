import { ArrowRight, Pencil, Trash2, Zap, CheckSquare, Globe, ArrowRightLeft, CircleDot } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { StageTaskTemplate, Stage, Funnel } from '@/types';

const taskTypeLabels: Record<string, string> = {
  follow_up: 'Follow-up',
  call: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
  other: 'Outro',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const statusLabels: Record<string, string> = {
  open: 'Aberto',
  won: 'Ganho',
  inactive: 'Inativo',
};

const statusDot: Record<string, string> = {
  open: 'bg-blue-500',
  won: 'bg-green-500',
  inactive: 'bg-gray-500',
};

const actionMeta = {
  send_webhook: { label: 'Webhook', icon: Globe, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  move_lead: { label: 'Mover negócio', icon: ArrowRightLeft, className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  create_task: { label: 'Criar tarefa', icon: CheckSquare, className: 'bg-primary/10 text-primary' },
} as const;

function StagePill({ funnel, stage }: { funnel?: Funnel; stage?: Stage }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
      {stage && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />}
      <span className="truncate font-medium">{stage?.name || 'Primeira etapa'}</span>
      {funnel && <span className="truncate text-xs text-muted-foreground">· {funnel.name}</span>}
    </span>
  );
}

interface AutomationsTableProps {
  templates: StageTaskTemplate[];
  stageMap: Record<string, Stage>;
  funnelMap: Record<string, Funnel>;
  onEdit: (t: StageTaskTemplate) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export function AutomationsTable({ templates, stageMap, funnelMap, onEdit, onDelete, onToggle }: AutomationsTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-16">Ativa</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead className="w-8" />
            <TableHead>Então</TableHead>
            <TableHead>Destino / detalhes</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map(t => {
            const stage = t.stage_id ? stageMap[t.stage_id] : undefined;
            const funnel = stage ? funnelMap[stage.funnel_id] : undefined;
            const action = actionMeta[t.action_type as keyof typeof actionMeta] || actionMeta.create_task;
            const ActionIcon = action.icon;

            return (
              <TableRow
                key={t.id}
                className={cn('cursor-pointer', !t.is_active && 'text-muted-foreground [&_td]:opacity-70')}
                onClick={() => onEdit(t)}
              >
                <TableCell onClick={e => e.stopPropagation()}>
                  <Switch
                    checked={t.is_active}
                    onCheckedChange={active => onToggle(t.id, active)}
                    aria-label="Ativar/desativar automação"
                  />
                </TableCell>

                <TableCell className="max-w-[260px]">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    {t.trigger_type === 'status_change' ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <span className={cn('h-2 w-2 rounded-full', statusDot[t.trigger_status || ''] || 'bg-gray-500')} />
                        <span className="font-medium">{statusLabels[t.trigger_status || ''] || t.trigger_status}</span>
                      </span>
                    ) : (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 text-sm text-muted-foreground">Entra em</span>
                        <StagePill funnel={funnel} stage={stage} />
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="px-0">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </TableCell>

                <TableCell className="max-w-[280px]">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', action.className)}>
                      <ActionIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{action.label}</p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="max-w-[320px]">
                  {t.action_type === 'send_webhook' ? (
                    <code className="block truncate text-xs text-muted-foreground" title={t.webhook_url || ''}>
                      {t.webhook_url}
                    </code>
                  ) : t.action_type === 'move_lead' ? (
                    <StagePill
                      funnel={t.target_funnel_id ? funnelMap[t.target_funnel_id] : undefined}
                      stage={t.target_stage_id ? stageMap[t.target_stage_id] : undefined}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{taskTypeLabels[t.task_type] || t.task_type}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{priorityLabels[t.priority] || t.priority}</Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleDot className="h-3 w-3" />{t.due_hours}h de prazo
                      </span>
                    </div>
                  )}
                </TableCell>

                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                  <div className="inline-flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(t)} aria-label="Editar automação">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(t.id)} aria-label="Excluir automação">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
