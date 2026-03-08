import { ArrowRight, Pencil, Trash2, Zap, CheckSquare, Globe, ArrowRightLeft } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface AutomationCardProps {
  template: StageTaskTemplate;
  stage?: Stage;
  funnel?: Funnel;
  targetFunnel?: Funnel;
  targetStage?: Stage;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}

export function AutomationCard({ template, stage, funnel, targetFunnel, targetStage, onEdit, onDelete, onToggle }: AutomationCardProps) {
  const isWebhook = template.action_type === 'send_webhook';
  const isMoveLead = template.action_type === 'move_lead';

  const actionIcon = isWebhook
    ? <Globe className="h-4 w-4" />
    : isMoveLead
    ? <ArrowRightLeft className="h-4 w-4" />
    : <CheckSquare className="h-4 w-4" />;

  const actionIconBg = isWebhook
    ? 'bg-emerald-500/10 text-emerald-500'
    : isMoveLead
    ? 'bg-violet-500/10 text-violet-500'
    : 'bg-primary/10 text-primary';

  const actionLabel = isWebhook ? 'Webhook' : isMoveLead ? 'Mover Lead' : 'Criar Tarefa';

  return (
    <div className="group relative rounded-xl border bg-card p-0 overflow-hidden transition-shadow hover:shadow-md">
      {/* Flow visualization */}
      <div className="flex items-stretch">
        {/* Trigger block */}
        <div className="flex-1 p-4 border-r border-dashed">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Quando</span>
          </div>
          <p className="text-sm font-medium">Lead entra na etapa</p>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {funnel && (
              <Badge variant="outline" className="text-[10px]">{funnel.name}</Badge>
            )}
            {stage && (
              <Badge
                className="text-[10px] text-white"
                style={{ backgroundColor: stage.color }}
              >
                {stage.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Arrow connector */}
        <div className="flex items-center justify-center w-10 shrink-0 bg-muted/30">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Action block */}
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${actionIconBg}`}>
              {actionIcon}
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {actionLabel}
            </span>
          </div>
          {isWebhook ? (
            <>
              <p className="text-sm font-medium truncate">{template.title}</p>
              <div className="mt-1.5">
                <Badge variant="secondary" className="text-[10px] font-mono truncate max-w-[200px]">
                  {template.webhook_url}
                </Badge>
              </div>
            </>
          ) : isMoveLead ? (
            <>
              <p className="text-sm font-medium truncate">{template.title}</p>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {targetFunnel && (
                  <Badge variant="outline" className="text-[10px]">{targetFunnel.name}</Badge>
                )}
                {targetStage && (
                  <Badge
                    className="text-[10px] text-white"
                    style={{ backgroundColor: targetStage.color }}
                  >
                    {targetStage.name}
                  </Badge>
                )}
                {!targetStage && (
                  <Badge variant="secondary" className="text-[10px]">Primeira etapa</Badge>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium truncate">{template.title}</p>
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px]">{taskTypeLabels[template.task_type] || template.task_type}</Badge>
                <Badge variant="secondary" className="text-[10px]">{priorityLabels[template.priority] || template.priority}</Badge>
                <Badge variant="outline" className="text-[10px]">{template.due_hours}h prazo</Badge>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-2 bg-muted/20">
        <Switch
          checked={template.is_active}
          onCheckedChange={onToggle}
          aria-label="Ativar/desativar automação"
        />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
