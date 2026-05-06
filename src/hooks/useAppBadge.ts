import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const POLL_MS = 30_000;
const COMMERCIAL_FUNNEL_NAME = 'Comercial';

async function setBadge(count: number) {
  try {
    const nav: any = navigator;
    if (count > 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(count);
    } else if (typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge();
    }
  } catch {
    // Badging API unavailable or blocked — silently ignore
  }
}

/**
 * Polls the count of open leads in the first stage (position 0) of the
 * "Comercial" funnel for the current organization and reflects it as a
 * badge on the installed PWA / dock icon.
 */
export function useAppBadge() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  useEffect(() => {
    if (!orgId) {
      setBadge(0);
      return;
    }

    let cancelled = false;
    let stageId: string | null = null;

    async function resolveStageId(): Promise<string | null> {
      if (stageId) return stageId;
      const { data: funnel } = await supabase
        .from('funnels')
        .select('id')
        .eq('organization_id', orgId)
        .eq('name', COMMERCIAL_FUNNEL_NAME)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!funnel) return null;

      const { data: stage } = await supabase
        .from('stages')
        .select('id')
        .eq('funnel_id', funnel.id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();
      stageId = stage?.id ?? null;
      return stageId;
    }

    async function tick() {
      const sid = await resolveStageId();
      if (!sid || cancelled) return;
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('stage_id', sid)
        .eq('status', 'open');
      if (cancelled) return;
      setBadge(count || 0);
    }

    tick();
    const interval = setInterval(tick, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      setBadge(0);
    };
  }, [orgId]);
}
