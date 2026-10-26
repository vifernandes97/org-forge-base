import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { getNotifications, markNotificationsRead, type AppNotification } from '@/services/notifications';

const POLL_MS = 30_000;

export function useNotifications(onOpen: (n: AppNotification) => void) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', orgId],
    queryFn: () => getNotifications(orgId!),
    enabled: !!orgId,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  const markRead = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', orgId] }),
  });

  // With the app open, new arrivals also show as a toast (push covers it closed).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => { seen.current = null; }, [orgId]);
  useEffect(() => {
    const list = query.data;
    if (!list) return;
    if (seen.current) {
      list
        .filter(n => !n.read_at && !seen.current!.has(n.id))
        .slice(0, 3)
        .forEach(n => toast(n.title, {
          description: n.body ?? undefined,
          action: n.lead_id ? { label: 'Abrir', onClick: () => onOpen(n) } : undefined,
        }));
    }
    seen.current = new Set(list.map(n => n.id));
  }, [query.data, onOpen]);

  const items = query.data || [];
  return {
    items,
    unread: items.filter(n => !n.read_at).length,
    isLoading: query.isLoading,
    markRead: (ids: string[]) => markRead.mutate(ids),
  };
}
