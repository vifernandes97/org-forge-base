import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { Stage } from '@/types';
import { StagePipeline } from './StagePipeline';

const stages: Stage[] = ['Novo lead', 'Proposta'].map((name, position) => ({
  id: String(position), name, position, color: '#ffcc00',
  funnel_id: 'funnel', organization_id: 'org', sla_hours: null,
  webhook_url: null, created_at: '', updated_at: '',
}));

it('identifica a etapa atual e permite mudar para outra etapa', () => {
  const onStageChange = vi.fn();
  const container = document.createElement('div');
  const root = createRoot(container);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  try {
    act(() => root.render(
      <StagePipeline stages={stages} currentStageId="0" onStageChange={onStageChange} />,
    ));

    const [current, next] = container.querySelectorAll('button');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).toBeDisabled();
    next.click();
    expect(onStageChange).toHaveBeenCalledWith('1');

    act(() => root.render(
      <StagePipeline stages={stages} currentStageId="0" onStageChange={onStageChange} disabled />,
    ));
    expect(next).toBeDisabled();
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
