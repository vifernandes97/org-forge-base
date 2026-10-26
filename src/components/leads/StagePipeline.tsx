import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { Stage } from '@/types';

interface StagePipelineProps {
  stages: Stage[];
  currentStageId: string;
  onStageChange: (stageId: string) => void;
  disabled?: boolean;
}

export function StagePipeline({ stages, currentStageId, onStageChange, disabled }: StagePipelineProps) {
  const currentIndex = stages.findIndex(s => s.id === currentStageId);
  const currentRef = useRef<HTMLButtonElement>(null);

  // On narrow screens the pipeline scrolls: keep the current stage centered in view.
  useEffect(() => {
    const btn = currentRef.current;
    const viewport = btn?.closest<HTMLElement>('[data-radix-scroll-area-viewport]');
    if (btn && viewport) viewport.scrollLeft = btn.offsetLeft - (viewport.clientWidth - btn.offsetWidth) / 2;
  }, [currentStageId, stages.length]);

  return (
    <ScrollArea className="w-full">
      <div className="flex items-stretch min-w-max">
        {stages.map((stage, index) => {
          const isCurrent = stage.id === currentStageId;
          const isPast = index < currentIndex;
          const isFuture = index > currentIndex;

          return (
            <button
              key={stage.id}
              ref={isCurrent ? currentRef : undefined}
              disabled={disabled || isCurrent}
              onClick={() => onStageChange(stage.id)}
              className={cn(
                'relative flex items-center justify-center px-4 py-2 text-xs font-medium transition-all whitespace-nowrap',
                'min-w-[100px] flex-1',
                // Clip-path for arrow/chevron shape
                index < stages.length - 1 ? 'mr-[-8px]' : '',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                disabled || isCurrent ? 'cursor-default' : 'cursor-pointer hover:brightness-110',
              )}
              style={{
                backgroundColor: isCurrent
                  ? stage.color
                  : isPast
                    ? `${stage.color}66`
                    : 'hsl(var(--muted))',
                color: isCurrent
                  ? '#fff'
                  : isPast
                    ? stage.color
                    : 'hsl(var(--muted-foreground))',
                clipPath: index === 0
                  ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                  : index === stages.length - 1
                    ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)'
                    : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)',
                paddingLeft: index === 0 ? '16px' : '20px',
                paddingRight: index === stages.length - 1 ? '16px' : '20px',
              }}
              title={stage.name}
            >
              <span className="relative z-10 truncate max-w-[120px]">{stage.name}</span>
            </button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
