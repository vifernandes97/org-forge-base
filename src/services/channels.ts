/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas novas ainda fora de integrations/supabase/types.ts */
import { supabase } from '@/integrations/supabase/client';

// Canais de mensagem (WhatsApp pela Evolution). Leitura pelo PostgREST (RLS);
// criar, QR, atualizar status e remover passam pelo servidor (/api/channels),
// porque mexem na Evolution e no token do webhook, que o navegador nunca vê.

export type ChannelStatus = 'pending' | 'qr' | 'connected' | 'disconnected' | 'error';

export interface ChannelConnection {
  id: string;
  organization_id: string;
  instance_name: string;
  display_name: string;
  managed: boolean;
  phone_number: string | null;
  status: ChannelStatus;
  status_detail: string | null;
  actor_user_id: string | null;
  funnel_id: string | null;
  is_active: boolean;
  last_event_at: string | null;
  created_at: string;
}

export type ChatStatus = 'pending' | 'linked' | 'unmatched' | 'ignored';

export interface ChannelChat {
  id: string;
  connection_id: string;
  remote_jid: string;
  phone_digits: string | null;
  push_name: string | null;
  status: ChatStatus;
  matched_by: string | null;
  message_count: number;
  last_message_at: string | null;
  contact: { id: string; name: string } | null;
  lead: { id: string; name: string; company: { trade_name: string } | null } | null;
}

// Coluna a coluna: o token do webhook não é legível pelo navegador.
const COLUNAS_CONEXAO = 'id, organization_id, instance_name, display_name, managed, phone_number, status, status_detail, actor_user_id, funnel_id, is_active, last_event_at, created_at';

export async function getChannelConnections(orgId: string): Promise<ChannelConnection[]> {
  const { data, error } = await supabase
    .from('channel_connections' as any)
    .select(COLUNAS_CONEXAO)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as ChannelConnection[];
}

export async function updateChannelConnection(id: string, payload: Partial<Pick<ChannelConnection, 'display_name' | 'funnel_id' | 'is_active' | 'actor_user_id'>>) {
  const { error } = await supabase.from('channel_connections' as any).update(payload).eq('id', id);
  if (error) throw error;
}

export async function getChannelChats(orgId: string, opts: { status?: ChatStatus | null; limit?: number } = {}): Promise<ChannelChat[]> {
  let q = supabase
    .from('channel_chats' as any)
    .select('id, connection_id, remote_jid, phone_digits, push_name, status, matched_by, message_count, last_message_at, contact:contacts(id, name), lead:leads(id, name, company:companies(trade_name))')
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 50);
  if (opts.status) q = q.eq('status', opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as unknown as ChannelChat[];
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/channels${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const createChannelConnection = (payload: {
  organization_id: string;
  display_name: string;
  existing: boolean;
  instance_name?: string;
  funnel_id?: string | null;
}) => api<{ id: string }>('POST', '/connections', payload);

export const connectChannel = (id: string) =>
  api<{ status: ChannelStatus; qrCode: string | null; pairingCode: string | null }>('POST', `/connections/${id}/connect`);

export const refreshChannel = (id: string) =>
  api<{ status: ChannelStatus; phoneNumber: string | null }>('POST', `/connections/${id}/refresh`);

export const deleteChannelConnection = (id: string) => api<{ ok: true }>('DELETE', `/connections/${id}`);
