import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Stage } from '@/types';

interface StagePipelineProps {
  stages: Stage[];
  currentStageId: string;
  onStageChange: (stageId: string) => void;
  disabled?: boolean;
}

export function StagePipeline({ stages, currentStageId, onStageChange, disabled }: StagePipelineProps) {
  const currentIndex = stages.findIndex(stage => stage.id === currentStageId);
  const trackRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const current = currentRef.current;
    if (track && current) {
      track.scrollLeft = current.offsetLeft - (track.clientWidth - current.offsetWidth) / 2;
    }
  }, [currentIndex, currentStageId, stages.length]);

  return (
    <ol ref={trackRef} aria-label="Etapas do funil" className="relative flex gap-1.5 overflow-x-auto px-0.5 pb-2 pt-0.5">
      {stages.map((stage, index) => {
        const isCurrent = index === currentIndex;
        const isPast = index < currentIndex;

        return (
          <li key={stage.id} className="min-w-max flex-1">
            <button
              type="button"
              ref={isCurrent ? currentRef : undefined}
              aria-current={isCurrent ? 'step' : undefined}
              disabled={disabled || isCurrent}
              onClick={() => onStageChange(stage.id)}
              className={cn(
                'flex min-h-9 w-full items-center gap-2 rounded-md border px-3 text-left text-xs font-medium',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isCurrent
                  ? 'border-primary/40 bg-primary/10 font-semibold text-foreground'
                  : 'border-transparent bg-muted/70 text-muted-foreground enabled:hover:bg-accent enabled:hover:text-accent-foreground',
              )}
            >
              {isPast
                ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                : <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border border-foreground/20" style={{ backgroundColor: stage.color }} />}
              {stage.name}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
