import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseCustomValue(raw: unknown) {
  if (typeof raw !== "string") return raw ?? null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
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
  supabase: any,
  payload: any,
  ctx: { organization_id: string; stage_id?: string | null; lead_id?: string | null }
) {
  if (!payload || typeof payload !== "object") return payload;

  const nested = payload.lead && typeof payload.lead === "object";
  const leadId =
    ctx.lead_id || payload.lead_id || (nested ? payload.lead?.id : null);
  if (!leadId) return payload;

  try {
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) return payload;

    const stageId = payload.stage_id ?? lead.stage_id ?? ctx.stage_id ?? null;
    const previousStageId = payload.previous_stage_id ?? null;
    const funnelId = payload.funnel_id ?? lead.funnel_id ?? null;

    const stageIds = [stageId, previousStageId].filter(Boolean);
    const [stagesRes, funnelRes, valuesRes] = await Promise.all([
      stageIds.length
        ? supabase.from("stages").select("id, name").in("id", stageIds)
        : Promise.resolve({ data: [] }),
      funnelId
        ? supabase.from("funnels").select("id, name").eq("id", funnelId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("custom_field_values")
        .select("value, custom_field_definitions!inner(field_label, organization_id)")
        .eq("lead_id", leadId),
    ]);

    const stageMap = new Map<string, string>(
      (stagesRes.data || []).map((s: any) => [s.id, s.name])
    );

    const customFields: Record<string, unknown> = {};
    for (const row of valuesRes.data || []) {
      const def = (row as any).custom_field_definitions;
      if (!def) continue;
      if (def.organization_id !== lead.organization_id) continue;
      customFields[def.field_label] = parseCustomValue((row as any).value);
    }

    const enrichment = {
      stage_name: stageId ? stageMap.get(stageId) ?? null : null,
      previous_stage_name: previousStageId
        ? stageMap.get(previousStageId) ?? null
        : null,
      funnel_name: (funnelRes as any).data?.name ?? null,
      custom_fields: customFields,
    };

    if (nested) {
      return {
        ...payload,
        lead: { ...lead, ...payload.lead, custom_fields: customFields },
        transition: {
          ...payload.transition,
          previous_stage: {
            ...(payload.transition?.previous_stage || {}),
            name:
              payload.transition?.previous_stage?.name ??
              enrichment.previous_stage_name,
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
    return { ...lead, ...enrichment, ...payload };
  } catch (err) {
    console.error("enrichPayload failed:", err);
    return payload;
  }
}

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const {
      webhook_url,
      payload,
      organization_id,
      stage_id,
      lead_id,
      attempt_number = 1,
    } = await req.json();

    if (!webhook_url || !payload || !organization_id || !stage_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const enrichedPayload = await enrichPayload(supabase, payload, {
      organization_id,
      stage_id,
      lead_id,
    });

    const body = JSON.stringify(enrichedPayload);
    const signature = await hmacSign(body, serviceRoleKey);


    let success = false;
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CRM-Event": "lead.stage_changed",
          "X-CRM-Signature": signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseStatus = response.status;
      responseBody = await response.text();
      success = response.status >= 200 && response.status < 300;
    } catch (err: any) {
      errorMessage =
        err.name === "AbortError" ? "Timeout after 10s" : err.message;
    }

    // Log to webhook_logs
    await supabase.from("webhook_logs").insert({
      organization_id,
      stage_id,
      lead_id: lead_id || null,
      webhook_url,
      payload,
      response_status: responseStatus,
      response_body: responseBody?.substring(0, 5000),
      success,
      attempt_number,
      error_message: errorMessage,
    });

    // Log to lead_activities timeline (only on success first time, or final failure)
    if (lead_id) {
      const shouldLogActivity =
        (success && attempt_number === 1) ||
        (!success && attempt_number >= 3);

      if (shouldLogActivity) {
        let activityUserId: string | null =
          payload?.transition?.moved_by?.id || null;

        if (!activityUserId) {
          const { data: leadRow } = await supabase
            .from("leads")
            .select("assigned_to")
            .eq("id", lead_id)
            .maybeSingle();
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
            ? `POST ${host} → ${responseStatus}${
                attempt_number > 1 ? ` (após ${attempt_number} tentativas)` : ""
              }`
            : `POST ${host} falhou após ${attempt_number} tentativas${
                errorMessage ? ` — ${errorMessage}` : responseStatus ? ` (HTTP ${responseStatus})` : ""
              }`;

          await supabase.from("lead_activities").insert({
            organization_id,
            lead_id,
            user_id: activityUserId,
            activity_type: success ? "webhook_sent" : "webhook_failed",
            title: success ? "Webhook enviado" : "Webhook falhou",
            description,
            metadata: {
              webhook_url,
              response_status: responseStatus,
              attempt_number,
              stage_id,
              error_message: errorMessage,
            },
          });

          await supabase
            .from("leads")
            .update({ last_activity_at: new Date().toISOString() })
            .eq("id", lead_id);
        }
      }
    }

    // Retry logic: if failed and attempt < 3, re-invoke with short delays
    if (!success && attempt_number < 3) {
      const delays = [1000, 5000, 10000];
      const delay = delays[attempt_number - 1] || 10000;

      // Fire-and-forget retry
      setTimeout(async () => {
        try {
          const functionUrl = `${supabaseUrl}/functions/v1/fire-webhook`;
          await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              webhook_url,
              payload,
              organization_id,
              stage_id,
              lead_id,
              attempt_number: attempt_number + 1,
            }),
          });
        } catch {
          // Retry failed silently
        }
      }, delay);
    }

    return new Response(
      JSON.stringify({ success, attempt_number, response_status: responseStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
