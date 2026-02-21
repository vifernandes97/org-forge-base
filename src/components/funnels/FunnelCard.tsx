import { useNavigate } from 'react-router-dom';
import type { Funnel } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FunnelCardProps {
  funnel: Funnel;
  stageCount?: number;
}

export function FunnelCard({ funnel, stageCount }: FunnelCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/settings/funnels/${funnel.id}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{funnel.name}</CardTitle>
          {funnel.is_default && (
            <Badge variant="secondary" className="text-xs">Padrão</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {funnel.description && (
          <p className="text-sm text-muted-foreground mb-2">{funnel.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {stageCount !== undefined ? `${stageCount} etapas` : ''}
        </p>
      </CardContent>
    </Card>
  );
}
