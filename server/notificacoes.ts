import webpush from 'web-push';
import { servico } from './servico.js';

// Central de notificações + Web Push (db/50_notificacoes.sql).
// Chaves VAPID no secrets.env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e
// VAPID_SUBJECT (mailto: do responsável). Sem elas, a notificação fica só na
// central do app e o push é pulado.

let vapidPronto: boolean | null = null;

function vapid(): boolean {
  if (vapidPronto !== null) return vapidPronto;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes: push desligado');
    return (vapidPronto = false);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@neosoluti.com.br', pub, priv);
  return (vapidPronto = true);
}

export const chavePublicaVapid = () => process.env.VAPID_PUBLIC_KEY ?? null;

interface NovoLead {
  organizationId: string;
  leadId: string;
  companyId: string | null;
  contactName: string | null;
}

/** Lead novo pelo webhook de entrada: avisa todos os membros da organização. */
export async function notificarNovoLead({ organizationId, leadId, companyId, contactName }: NovoLead) {
  const [empresa, membros] = await Promise.all([
    companyId
      ? servico.from('companies').select('trade_name, segment_ref:company_segments(label)').eq('id', companyId).maybeSingle()
      : Promise.resolve({ data: null }),
    servico.from('organization_members').select('user_id').eq('organization_id', organizationId),
  ]);

  const negocio: string = empresa.data?.trade_name || contactName || 'Sem nome';
  const segmento: string | null = empresa.data?.segment_ref?.label ?? null;
  const contato = contactName && contactName !== negocio ? contactName : null;

  const title = `Novo lead: ${negocio}`;
  const body = [contato, segmento || 'Sem segmento'].filter(Boolean).join(' · ');
  const userIds: string[] = (membros.data || []).map((m: { user_id: string }) => m.user_id);
  if (!userIds.length) return;

  await servico.from('notifications').insert(
    userIds.map(user_id => ({ organization_id: organizationId, user_id, type: 'new_lead', title, body, lead_id: leadId })),
  );

  if (!vapid()) return;
  const { data: inscricoes } = await servico
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  const payload = JSON.stringify({
    title,
    body,
    tag: `lead-${leadId}`,
    url: `/leads?lead=${leadId}`,
  });

  await Promise.all((inscricoes || []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
      await servico.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // Inscrição expirada ou revogada no aparelho: não adianta tentar de novo.
      if (status === 404 || status === 410) await servico.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('[push] falha ao enviar', status, (err as Error).message);
    }
  }));
}

interface Inscricao {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/**
 * Grava a inscrição do aparelho para o usuário logado. Pelo servidor (e não
 * direto no PostgREST) porque o mesmo navegador pode trocar de conta: o
 * endpoint é único e passa a ser de quem se inscreveu por último.
 */
export async function salvarInscricao(userId: string, inscricao: Inscricao, userAgent: string | null) {
  const { endpoint, keys } = inscricao;
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Inscrição inválida');
  const { error } = await servico.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: userAgent },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error(error.message);
}

export async function removerInscricao(userId: string, endpoint: string) {
  await servico.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
}
