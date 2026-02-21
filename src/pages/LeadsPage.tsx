import { useState } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { useOrganization } from '@/contexts/OrganizationContext';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { LeadCard } from '@/components/leads/LeadCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';

export default function LeadsPage() {
  const { isOwner, isAdmin, isMember } = useOrganization();
  const { data: leads, isLoading } = useLeads();
  const canCreate = isOwner || isAdmin || isMember;

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">Gerencie os leads da sua organização.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lead
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[72px]" />)}
        </div>
      ) : leads?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground mb-4">Nenhum lead criado ainda.</p>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro lead
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {leads?.map((lead: any) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLeadId(lead.id)} />
          ))}
        </div>
      )}

      <LeadFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <LeadDetailSheet leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
    </div>
  );
}
