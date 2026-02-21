import { useFunnels } from '@/hooks/useFunnels';
import { useStages } from '@/hooks/useStages';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CreateFunnelDialog } from '@/components/funnels/CreateFunnelDialog';
import { FunnelCard } from '@/components/funnels/FunnelCard';
import { Skeleton } from '@/components/ui/skeleton';
import type { Funnel } from '@/types';

function FunnelCardWithCount({ funnel }: { funnel: Funnel }) {
  const { data: stages } = useStages(funnel.id);
  return <FunnelCard funnel={funnel} stageCount={stages?.length} />;
}

export default function FunnelsPage() {
  const { isOwner, isAdmin } = useOrganization();
  const { data: funnels, isLoading } = useFunnels();
  const canEdit = isOwner || isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funis</h1>
          <p className="text-muted-foreground">Gerencie os funis de vendas da sua organização.</p>
        </div>
        {canEdit && <CreateFunnelDialog />}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : funnels?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">Nenhum funil criado ainda.</p>
          {canEdit && <CreateFunnelDialog />}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funnels?.map(f => <FunnelCardWithCount key={f.id} funnel={f} />)}
        </div>
      )}
    </div>
  );
}
