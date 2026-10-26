import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, BellOff, BellRing, CheckCheck, Share } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';
import type { AppNotification } from '@/services/notifications';

function PushRow({ state, busy, onEnable, onDisable }: {
  state: PushState | null;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (state === null || state === 'unsupported') return null;

  if (state === 'needs-install') {
    return (
      <div className="flex gap-2.5 border-b bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <Share className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Para receber notificações no iPhone, toque em <strong className="text-foreground">Compartilhar</strong> →{' '}
          <strong className="text-foreground">Adicionar à Tela de Início</strong> e abra o Org Connect por lá.
        </p>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="flex gap-2.5 border-b bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Notificações bloqueadas para este app. Libere nos ajustes do sistema ou do navegador.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
      {state === 'on' ? <BellRing className="h-4 w-4 shrink-0 text-primary" /> : <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <p className="flex-1 text-xs text-muted-foreground">
        {state === 'on' ? 'Notificações ativas neste aparelho' : 'Receba um alerta a cada lead novo'}
      </p>
      {state === 'on' ? (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onDisable} disabled={busy}>Desativar</Button>
      ) : (
        <Button size="sm" className="h-7 text-xs" onClick={onEnable} disabled={busy}>Ativar</Button>
      )}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [pushState, setPushState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const openLead = useCallback((n: AppNotification) => {
    if (!n.lead_id) return;
    const next = new URLSearchParams(searchParams);
    next.set('lead', n.lead_id);
    setSearchParams(next);
    setOpen(false);
  }, [searchParams, setSearchParams]);

  const { items, unread, isLoading, markRead } = useNotifications(openLead);

  useEffect(() => {
    if (open) getPushState().then(setPushState).catch(() => setPushState('unsupported'));
  }, [open]);

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    try {
      const s = await fn();
      setPushState(s);
      if (s === 'on') toast.success('Notificações ativadas neste aparelho');
    } catch (err) {
      toast.error((err as Error).message || 'Não foi possível alterar as notificações');
    } finally {
      setBusy(false);
    }
  };

  const unreadIds = items.filter(n => !n.read_at).map(n => n.id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `Notificações (${unread} novas)` : 'Notificações'}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground tabular-nums">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-1rem)] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadIds.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => markRead(unreadIds)}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </Button>
          )}
        </div>

        <PushRow state={pushState} busy={busy} onEnable={() => run(enablePush)} onDisable={() => run(disablePush)} />

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-6 w-6 opacity-40" />
              Nenhuma notificação ainda
            </div>
          ) : (
            <ul className="divide-y">
              {items.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => { if (!n.read_at) markRead([n.id]); openLead(n); }}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50', !n.read_at && 'bg-primary/5')}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', !n.read_at && 'font-semibold')}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground/80">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
