import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  connectChannel,
  createChannelConnection,
  deleteChannelConnection,
  getChannelChats,
  getChannelConnections,
  refreshChannel,
  updateChannelConnection,
  type ChatStatus,
} from '@/services/channels';

export function useChannelConnections() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['channel-connections', orgId],
    queryFn: () => getChannelConnections(orgId!),
    enabled: !!orgId,
    // O status muda por evento da Evolution (conectou, caiu).
    refetchInterval: 15_000,
  });
}

export function useChannelChats(status: ChatStatus | null) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ['channel-chats', orgId, status],
    queryFn: () => getChannelChats(orgId!, { status }),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });
}

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['channel-connections'] });
    qc.invalidateQueries({ queryKey: ['channel-chats'] });
  };
}

export function useCreateChannelConnection() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: createChannelConnection, onSuccess: invalidar });
}

export function useUpdateChannelConnection() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Parameters<typeof updateChannelConnection>[1]) => updateChannelConnection(id, data),
    onSuccess: invalidar,
  });
}

export function useRefreshChannel() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: refreshChannel, onSuccess: invalidar });
}

export function useDeleteChannelConnection() {
  const invalidar = useInvalidar();
  return useMutation({ mutationFn: deleteChannelConnection, onSuccess: invalidar });
}

export { connectChannel };
