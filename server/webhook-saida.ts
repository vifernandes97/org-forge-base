/* eslint-disable @typescript-eslint/no-explicit-any -- portado da edge function, sem tipos do banco */
import { createHmac } from 'node:crypto';
import { servico as supabase } from './servico.js';
import { servicePool } from './db.js';

// Webhooks de saída — porte da edge function fire-webhook (supabase/functions/
// fire-webhook), com o mesmo payload, cabeçalhos, log e 3 tentativas.
// Diferenças: a fila 'pending_dispatch' (gravada pelas automações no banco) é
// lida por um cron aqui, no lugar do pg_net; e a assinatura X-CRM-Signature
// usa um segredo derivado do BETTER_AUTH_SECRET (antes era a service role
// key do Supabase, que nenhum destino conhecia).

export interface EnvioWebhook {
  webhook_url: string;
  payload: any;
  organization_id: string;
  stage_id: string;
  lead_id?: string | null;
  attempt_number?: number;
}

function assinar(corpo: string): string {
  const segredo = process.env.BETTER_AUTH_SECRET;
  if (!segredo) throw new Error('BETTER_AUTH_SECRET ausente');
  return createHmac('sha256', `webhook:${segredo}`).update(corpo).digest('hex');
}

function parseCustomValue(raw: unknown) {
  if (typeof raw !== 'string') return raw ?? null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Enriches the outbound payload with the full lead record, human readable
 * stage/funnel names and the organization's custom fields (keyed by label).
 * Runs BEFORE the HMAC signature so the signed body matches what is sent.
 */
async function enrichPayload(
  payload: any,
  ctx: { organization_id: string; stage_id?: string | null; lead_id?: string | null },
) {
  if (!payload || typeof payload !== 'object') return payload;

  const nested = payload.lead && typeof payload.lead === 'object';
  const leadId = ctx.lead_id || payload.lead_id || (nested ? payload.lead?.id : null);
  if (!leadId) return payload;

  try {
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();

    if (!lead) return payload;

    const stageId = payload.stage_id ?? lead.stage_id ?? ctx.stage_id ?? null;
    const previousStageId = payload.previous_stage_id ?? null;
    const funnelId = payload.funnel_id ?? lead.funnel_id ?? null;

    // Empresa e contatos pelas novas tabelas
    const [companyRes, linksRes] = await Promise.all([
      lead.company_id
        ? supabase
            .from('companies')
            .select('id, trade_name, legal_name, cnpj, instagram, segment_ref:company_segments(label)')
            .eq('id', lead.company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('lead_contacts')
        .select('is_primary, created_at, contact:contacts(id, name, email, phone)')
        .eq('lead_id', leadId)
        .order('created_at'),
    ]);
    const rawCompany = (companyRes as any).data || null;
    const company = rawCompany
      ? {
          id: rawCompany.id,
          trade_name: rawCompany.trade_name,
          legal_name: rawCompany.legal_name,
          cnpj: rawCompany.cnpj,
          instagram: rawCompany.instagram,
          segment: rawCompany.segment_ref?.label ?? null,
        }
      : null;
    const contacts = ((linksRes as any).data || [])
      .filter((l: any) => l.contact)
      .sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))
      .map((l: any) => ({ id: l.contact.id, name: l.contact.name, email: l.contact.email, phone: l.contact.phone, is_primary: l.is_primary }));
    const primary = contacts.find((c: any) => c.is_primary) || contacts[0] || null;
    // DEPRECATED (remover quando os workflows migrarem para company/contacts):
    // campos planos mantidos com o significado que os workflows do n8n já usam
    // (company = segmento, company_name = nome fantasia).
    const legacyFlat = {
      name: primary?.name ?? null,
      email: primary?.email ?? null,
      phone: primary?.phone ?? null,
      company: company?.segment ?? company?.trade_name ?? null,
      company_name: company?.trade_name ?? null,
      company_instagram: company?.instagram ?? null,
    };
    const relations = { company_data: company, contacts };

    const stageIds = [stageId, previousStageId].filter(Boolean);
    const [stagesRes, funnelRes, valuesRes, defsRes] = await Promise.all([
      stageIds.length ? supabase.from('stages').select('id, name').in('id', stageIds) : Promise.resolve({ data: [] }),
      funnelId ? supabase.from('funnels').select('id, name').eq('id', funnelId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('custom_field_values').select('value, field_definition_id').eq('lead_id', leadId),
      supabase
        .from('custom_field_definitions')
        .select('id, field_name, field_label, is_active, position')
        .eq('organization_id', lead.organization_id)
        .order('position'),
    ]);

    const stageMap = new Map<string, string>(((stagesRes as any).data || []).map((s: any) => [s.id, s.name]));

    const valueMap = new Map<string, unknown>(
      ((valuesRes as any).data || []).map((v: any) => [v.field_definition_id, parseCustomValue(v.value)]),
    );

    // Always include every active custom field of the org (null when empty),
    // so downstream consumers get a stable payload shape.
    const customFields: Record<string, unknown> = {};
    const customFieldsByName: Record<string, unknown> = {};
    for (const def of (defsRes as any).data || []) {
      if (def.is_active === false) continue;
      const value = valueMap.has(def.id) ? valueMap.get(def.id) : null;
      customFields[def.field_label] = value ?? null;
      customFieldsByName[def.field_name] = value ?? null;
    }

    const enrichment = {
      stage_name: stageId ? (stageMap.get(stageId) ?? null) : null,
      previous_stage_name: previousStageId ? (stageMap.get(previousStageId) ?? null) : null,
      funnel_name: (funnelRes as any).data?.name ?? null,
      custom_fields: customFields,
      custom_fields_by_name: customFieldsByName,
    };

    if (nested) {
      return {
        ...payload,
        lead: {
          ...lead,
          ...payload.lead,
          ...legacyFlat,
          ...relations,
          custom_fields: customFields,
          custom_fields_by_name: customFieldsByName,
        },
        transition: {
          ...payload.transition,
          previous_stage: {
            ...(payload.transition?.previous_stage || {}),
            name: payload.transition?.previous_stage?.name ?? enrichment.previous_stage_name,
          },
          new_stage: {
            ...(payload.transition?.new_stage || {}),
            name: payload.transition?.new_stage?.name ?? enrichment.stage_name,
          },
          funnel: {
            ...(payload.transition?.funnel || {}),
            name: payload.transition?.funnel?.name ?? enrichment.funnel_name,
          },
        },
      };
    }

    // Flat payload: full lead record first, existing keys win (backwards compat)
    return { ...lead, ...enrichment, ...payload, ...legacyFlat, lead_name: legacyFlat.name, ...relations };
  } catch (err) {
    console.error('enrichPayload failed:', err);
    return payload;
  }
}

/** Envia um webhook, grava o resultado e agenda nova tentativa (até 3). */
export async function enviarWebhook(envio: EnvioWebhook): Promise<{ success: boolean; attempt_number: number; response_status: number | null }> {
  const { webhook_url, payload, organization_id, stage_id, lead_id } = envio;
  const attempt_number = envio.attempt_number ?? 1;

  const enrichedPayload = await enrichPayload(payload, { organization_id, stage_id, lead_id });

  const body = JSON.stringify(enrichedPayload);
  const signature = assinar(body);

  let success = false;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CRM-Event': 'lead.stage_changed',
        'X-CRM-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;
    responseBody = await response.text();
    success = response.status >= 200 && response.status < 300;
  } catch (err: any) {
    errorMessage = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'Timeout after 10s' : err?.message;
  }

  // Log to webhook_logs
  await supabase.from('webhook_logs').insert({
    organization_id,
    stage_id,
    lead_id: lead_id || null,
    webhook_url,
    payload: enrichedPayload,
    response_status: responseStatus,
    response_body: responseBody?.substring(0, 5000),
    success,
    attempt_number,
    error_message: errorMessage,
  });

  // Log to lead_activities timeline (only on success first time, or final failure)
  if (lead_id) {
    const shouldLogActivity = (success && attempt_number === 1) || (!success && attempt_number >= 3);

    if (shouldLogActivity) {
      let activityUserId: string | null = payload?.transition?.moved_by?.id || null;

      if (!activityUserId) {
        const { data: leadRow } = await supabase.from('leads').select('assigned_to').eq('id', lead_id).maybeSingle();
        activityUserId = leadRow?.assigned_to || null;
      }

      if (activityUserId) {
        let host = webhook_url;
        try {
          host = new URL(webhook_url).host;
        } catch {
          // keep raw
        }

        const description = success
          ? `POST ${host} → ${responseStatus}${attempt_number > 1 ? ` (após ${attempt_number} tentativas)` : ''}`
          : `POST ${host} falhou após ${attempt_number} tentativas${
              errorMessage ? ` — ${errorMessage}` : responseStatus ? ` (HTTP ${responseStatus})` : ''
            }`;

        await supabase.from('lead_activities').insert({
          organization_id,
          lead_id,
          user_id: activityUserId,
          activity_type: success ? 'webhook_sent' : 'webhook_failed',
          title: success ? 'Webhook enviado' : 'Webhook falhou',
          description,
          metadata: {
            webhook_url,
            response_status: responseStatus,
            attempt_number,
            stage_id,
            error_message: errorMessage,
          },
        });

        await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', lead_id);
      }
    }
  }

  // Retry logic: if failed and attempt < 3, re-send with short delays
  if (!success && attempt_number < 3) {
    const delays = [1000, 5000, 10000];
    const delay = delays[attempt_number - 1] || 10000;
    setTimeout(() => {
      enviarWebhook({ ...envio, attempt_number: attempt_number + 1 }).catch((e) => console.error('retry de webhook falhou:', e));
    }, delay);
  }

  return { success, attempt_number, response_status: responseStatus };
}

/**
 * Fila: as automações do banco gravam webhook_logs com error_message =
 * 'pending_dispatch'. Pega as não despachadas, marca dispatched_at na mesma
 * transação (skip locked: duas instâncias nunca pegam a mesma) e envia.
 */
export async function despacharFila(limite = 20): Promise<number> {
  const { rows } = await servicePool().query(
    `update public.webhook_logs set dispatched_at = now()
       where id in (select id from public.webhook_logs
                     where error_message = 'pending_dispatch' and dispatched_at is null
                     order by created_at limit $1 for update skip locked)
     returning webhook_url, payload, organization_id, stage_id, lead_id`,
    [limite],
  );
  for (const r of rows) {
    enviarWebhook({
      webhook_url: r.webhook_url,
      payload: r.payload,
      organization_id: r.organization_id,
      stage_id: r.stage_id,
      lead_id: r.lead_id,
    }).catch((e) => console.error('envio de webhook da fila falhou:', e));
  }
  return rows.length;
}

/** Cron da fila: a cada 10 s (o pg_net disparava na hora; 10 s é o atraso máximo). */
export function iniciarFilaDeWebhooks(intervaloMs = 10_000) {
  let rodando = false;
  setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const n = await despacharFila();
      if (n) console.log(`fila de webhooks: ${n} despachado(s)`);
    } catch (e) {
      console.error('fila de webhooks falhou:', e);
    } finally {
      rodando = false;
    }
  }, intervaloMs);
}
