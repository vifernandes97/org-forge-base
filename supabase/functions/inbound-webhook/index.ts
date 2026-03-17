import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[-_\s]/g, "");
}

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "nome", "fullname", "nomecompleto", "yourname"],
  email: ["email", "youremail", "emailaddress"],
  phone: ["phone", "telefone", "tel", "yourphone", "whatsapp", "celular"],
  company: ["company", "empresa", "companyname"],
  company_name: ["companyname", "razaosocial", "razao", "nomeempresa", "razãosocial"],
  company_instagram: ["companyinstagram", "instagram", "ig"],
  media_de_festas: ["mediadefestas", "mediafestas", "mediafesta", "mediadefestasmedia"],
  value: ["value", "valor", "budget", "orcamento"],
  notes: ["notes", "message", "mensagem", "yourmessage", "observacoes"],
};

function findFieldValue(
  payload: Record<string, any>,
  fieldMapping: Record<string, any>,
  crmField: string
): string | null {
  // 1. Check explicit mapping
  const mappedKey = fieldMapping[crmField];
  if (mappedKey && typeof mappedKey === "string") {
    // Try exact match first, then normalized
    if (payload[mappedKey] !== undefined) return String(payload[mappedKey]);
    const normalizedMapped = normalizeFieldName(mappedKey);
    for (const [key, val] of Object.entries(payload)) {
      if (normalizeFieldName(key) === normalizedMapped) return String(val);
    }
  }

  // 2. Auto-detect via aliases
  const aliases = FIELD_ALIASES[crmField];
  if (!aliases) return null;

  for (const [key, val] of Object.entries(payload)) {
    const normalized = normalizeFieldName(key);
    if (aliases.includes(normalized)) return String(val);
  }
  return null;
}

function flattenPayload(rawData: Record<string, any>): Record<string, any> {
  // If form_fields exists (Elementor pattern), extract it
  if (rawData.form_fields && typeof rawData.form_fields === "object") {
    return { ...rawData.form_fields };
  }
  // Handle nested form_fields[] pattern from form-data
  const flat: Record<string, any> = {};
  for (const [key, val] of Object.entries(rawData)) {
    const match = key.match(/^form_fields\[(.+)\]$/);
    if (match) {
      flat[match[1]] = val;
    } else if (key !== "api_key") {
      flat[key] = val;
    }
  }
  return Object.keys(flat).length > 0 ? flat : rawData;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let rawPayload: Record<string, any> = {};
  let webhookRecord: any = null;
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

  try {
    // 1. Parse body
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      rawPayload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      rawPayload = Object.fromEntries(new URLSearchParams(text));
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") rawPayload[key] = value;
      }
    } else {
      // Try JSON as fallback
      try {
        rawPayload = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Unsupported content type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. Extract API key
    const apiKey =
      req.headers.get("x-api-key") ||
      new URL(req.url).searchParams.get("api_key") ||
      rawPayload.api_key ||
      null;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Lookup webhook
    const { data: webhook, error: webhookErr } = await supabase
      .from("inbound_webhooks")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (webhookErr || !webhook) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!webhook.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webhookRecord = webhook;

    // 4. Rate limiting
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { count: recentCount } = await supabase
      .from("inbound_webhook_logs")
      .select("id", { count: "exact", head: true })
      .eq("inbound_webhook_id", webhook.id)
      .gte("created_at", oneMinuteAgo);

    if ((recentCount || 0) >= 100) {
      await logInbound(supabase, webhook, null, "error", rawPayload, null, null, "Rate limit exceeded", ipAddress);
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Flatten payload
    const payload = flattenPayload(rawPayload);

    // 6. Apply field mapping
    const fieldMapping = (webhook.field_mapping || {}) as Record<string, any>;
    const mappedData: Record<string, any> = {};

    for (const crmField of ["name", "email", "phone", "company", "company_name", "company_instagram", "media_de_festas", "value", "notes"]) {
      const val = findFieldValue(payload, fieldMapping, crmField);
      if (val && val.trim()) mappedData[crmField] = val.trim();
    }

    // Custom fields mapping
    const customFieldMapping = fieldMapping.custom_fields || {};
    const mappedCustomFields: Record<string, string> = {};
    for (const [cfKey, formKey] of Object.entries(customFieldMapping)) {
      if (formKey && typeof formKey === "string" && payload[formKey] !== undefined) {
        mappedCustomFields[cfKey] = String(payload[formKey]);
      }
    }

    // Collect unmapped fields into notes
    const allMappedFormKeys = new Set<string>();
    for (const crmField of ["name", "email", "phone", "company", "company_name", "company_instagram", "media_de_festas", "value", "notes"]) {
      const mk = fieldMapping[crmField];
      if (mk) allMappedFormKeys.add(mk);
      // Also add auto-detected keys
      const aliases = FIELD_ALIASES[crmField] || [];
      for (const pk of Object.keys(payload)) {
        if (aliases.includes(normalizeFieldName(pk))) allMappedFormKeys.add(pk);
      }
    }
    for (const formKey of Object.values(customFieldMapping)) {
      if (formKey && typeof formKey === "string") allMappedFormKeys.add(formKey);
    }
    allMappedFormKeys.add("api_key");

    const extraNotes: string[] = [];
    for (const [key, val] of Object.entries(payload)) {
      if (!allMappedFormKeys.has(key) && val && String(val).trim()) {
        extraNotes.push(`${key}: ${val}`);
      }
    }
    if (extraNotes.length > 0) {
      mappedData.notes = (mappedData.notes || "") + (mappedData.notes ? "\n" : "") + extraNotes.join("\n");
    }

    // 7. Validate
    if (!mappedData.name && !mappedData.email) {
      await logInbound(supabase, webhook, null, "error", rawPayload, mappedData, null, "At least name or email is required", ipAddress);
      return new Response(
        JSON.stringify({ success: false, error: "At least name or email is required" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Resolve funnel and first stage
    let funnelId = webhook.funnel_id;
    if (!funnelId) {
      const { data: defaultFunnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("organization_id", webhook.organization_id)
        .eq("is_default", true)
        .single();
      if (!defaultFunnel) {
        const { data: anyFunnel } = await supabase
          .from("funnels")
          .select("id")
          .eq("organization_id", webhook.organization_id)
          .limit(1)
          .single();
        funnelId = anyFunnel?.id;
      } else {
        funnelId = defaultFunnel.id;
      }
    }

    if (!funnelId) {
      await logInbound(supabase, webhook, null, "error", rawPayload, mappedData, null, "No funnel available", ipAddress);
      return new Response(
        JSON.stringify({ success: false, error: "No funnel configured for this organization" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: firstStage } = await supabase
      .from("stages")
      .select("*")
      .eq("funnel_id", funnelId)
      .eq("organization_id", webhook.organization_id)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    if (!firstStage) {
      await logInbound(supabase, webhook, null, "error", rawPayload, mappedData, null, "No stages in funnel", ipAddress);
      return new Response(
        JSON.stringify({ success: false, error: "No stages configured in funnel" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Deduplication
    const strategy = webhook.duplicate_strategy || "update";
    let existingLead: any = null;

    if (mappedData.email && strategy !== "create_new") {
      const { data: found } = await supabase
        .from("leads")
        .select("*")
        .eq("organization_id", webhook.organization_id)
        .eq("email", mappedData.email)
        .limit(1)
        .single();
      existingLead = found;
    }

    // === IGNORE strategy ===
    if (existingLead && strategy === "ignore") {
      await logInbound(supabase, webhook, existingLead.id, "ignored", rawPayload, mappedData, null, null, ipAddress);
      return new Response(
        JSON.stringify({ success: true, action: "ignored", lead_id: existingLead.id, reason: "duplicate_email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === UPDATE strategy ===
    if (existingLead && strategy === "update") {
      const changes: Array<{ field: string; old_value: any; new_value: any }> = [];
      const updateData: Record<string, any> = {};

      for (const field of ["name", "email", "phone", "company", "company_name", "company_instagram", "media_de_festas", "notes"]) {
        if (mappedData[field] && mappedData[field] !== existingLead[field]) {
          changes.push({ field, old_value: existingLead[field], new_value: mappedData[field] });
          updateData[field] = mappedData[field];
        }
      }

      if (mappedData.value) {
        const numVal = Number(mappedData.value);
        if (!isNaN(numVal) && numVal > 0 && numVal !== existingLead.value) {
          changes.push({ field: "value", old_value: existingLead.value, new_value: numVal });
          updateData.value = numVal;
        }
      }

      // Merge tags
      const newTags = webhook.default_tags || [];
      if (newTags.length > 0) {
        const existingTags = existingLead.tags || [];
        const merged = [...new Set([...existingTags, ...newTags])];
        if (merged.length !== existingTags.length) {
          changes.push({ field: "tags", old_value: existingTags, new_value: merged });
          updateData.tags = merged;
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.last_activity_at = new Date().toISOString();
        await supabase.from("leads").update(updateData).eq("id", existingLead.id);
      }

      // Update custom fields
      for (const [cfName, cfValue] of Object.entries(mappedCustomFields)) {
        // Find definition by field_name
        const { data: cfDef } = await supabase
          .from("custom_field_definitions")
          .select("id")
          .eq("organization_id", webhook.organization_id)
          .eq("field_name", cfName)
          .eq("is_active", true)
          .single();

        if (cfDef) {
          const { data: existingCfv } = await supabase
            .from("custom_field_values")
            .select("*")
            .eq("lead_id", existingLead.id)
            .eq("field_definition_id", cfDef.id)
            .single();

          if (existingCfv) {
            if (cfValue && cfValue !== existingCfv.value) {
              await supabase.from("custom_field_values").update({ value: cfValue }).eq("id", existingCfv.id);
              changes.push({ field: `custom:${cfName}`, old_value: existingCfv.value, new_value: cfValue });
            }
          } else if (cfValue) {
            await supabase.from("custom_field_values").insert({
              lead_id: existingLead.id,
              field_definition_id: cfDef.id,
              value: cfValue,
            });
            changes.push({ field: `custom:${cfName}`, old_value: null, new_value: cfValue });
          }
        }
      }

      // Log activity
      if (changes.length > 0) {
        const changeDesc = changes.map((c) => `${c.field}: "${c.old_value || ""}" → "${c.new_value}"`).join("; ");
        await supabase.from("lead_activities").insert({
          organization_id: webhook.organization_id,
          lead_id: existingLead.id,
          user_id: webhook.default_assigned_to || existingLead.assigned_to || (await getAnyOrgUser(supabase, webhook.organization_id)),
          activity_type: "field_update",
          title: "Lead atualizado via formulário",
          description: changeDesc,
          metadata: { source: "inbound_webhook", webhook_name: webhook.name, changes },
        });
      }

      await logInbound(supabase, webhook, existingLead.id, "updated", rawPayload, mappedData, changes.length > 0 ? changes : null, null, ipAddress);

      return new Response(
        JSON.stringify({ success: true, action: "updated", lead_id: existingLead.id, changes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CREATE new lead ===
    const leadData: Record<string, any> = {
      organization_id: webhook.organization_id,
      funnel_id: funnelId,
      stage_id: firstStage.id,
      name: mappedData.name || mappedData.email || "Lead sem nome",
      email: mappedData.email || null,
      phone: mappedData.phone || null,
      company: mappedData.company || null,
      company_name: mappedData.company_name || null,
      company_instagram: mappedData.company_instagram || null,
      media_de_festas: mappedData.media_de_festas || null,
      value: mappedData.value ? Number(mappedData.value) || 0 : 0,
      notes: mappedData.notes || null,
      source: webhook.default_source || "formulário",
      assigned_to: webhook.default_assigned_to || null,
      tags: webhook.default_tags || [],
      priority: "medium",
      stage_entered_at: new Date().toISOString(),
    };

    const { data: newLead, error: leadErr } = await supabase
      .from("leads")
      .insert(leadData)
      .select()
      .single();

    if (leadErr || !newLead) {
      const errMsg = leadErr?.message || "Failed to create lead";
      await logInbound(supabase, webhook, null, "error", rawPayload, mappedData, null, errMsg, ipAddress);
      return new Response(
        JSON.stringify({ success: false, error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert custom field values
    for (const [cfName, cfValue] of Object.entries(mappedCustomFields)) {
      if (!cfValue) continue;
      const { data: cfDef } = await supabase
        .from("custom_field_definitions")
        .select("id")
        .eq("organization_id", webhook.organization_id)
        .eq("field_name", cfName)
        .eq("is_active", true)
        .single();

      if (cfDef) {
        await supabase.from("custom_field_values").insert({
          lead_id: newLead.id,
          field_definition_id: cfDef.id,
          value: cfValue,
        });
      }
    }

    // Log activity
    const activityUserId = webhook.default_assigned_to || (await getAnyOrgUser(supabase, webhook.organization_id));
    await supabase.from("lead_activities").insert({
      organization_id: webhook.organization_id,
      lead_id: newLead.id,
      user_id: activityUserId,
      activity_type: "note",
      title: "Lead captado via formulário",
      description: `Origem: ${webhook.name}`,
      metadata: { source: "inbound_webhook", webhook_name: webhook.name },
    });

    // Fire outbound webhook if stage has one
    if (firstStage.webhook_url) {
      try {
        const functionUrl = `${supabaseUrl}/functions/v1/fire-webhook`;
        await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            webhook_url: firstStage.webhook_url,
            payload: {
              event: "lead.created",
              timestamp: new Date().toISOString(),
              lead: {
                id: newLead.id,
                name: newLead.name,
                email: newLead.email,
                phone: newLead.phone,
                company: newLead.company,
                value: newLead.value,
                source: newLead.source,
              },
              organization: { id: webhook.organization_id },
            },
            organization_id: webhook.organization_id,
            stage_id: firstStage.id,
            lead_id: newLead.id,
          }),
        });
      } catch {
        // Silent fail for outbound webhook
      }
    }

    // Create SLA task if stage has sla_hours
    if (firstStage.sla_hours && firstStage.sla_hours > 0) {
      const dueDate = new Date(Date.now() + firstStage.sla_hours * 3600000).toISOString();
      await supabase.from("tasks").insert({
        organization_id: webhook.organization_id,
        lead_id: newLead.id,
        assigned_to: webhook.default_assigned_to || activityUserId,
        title: `Follow-up: ${newLead.name}`,
        description: `SLA de ${firstStage.sla_hours}h para a etapa "${firstStage.name}"`,
        task_type: "follow_up",
        due_date: dueDate,
        priority: "medium",
      });
    }

    await logInbound(supabase, webhook, newLead.id, "created", rawPayload, mappedData, null, null, ipAddress);

    return new Response(
      JSON.stringify({ success: true, action: "created", lead_id: newLead.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Log error
    if (webhookRecord) {
      try {
        const supabase2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await logInbound(supabase2, webhookRecord, null, "error", rawPayload, null, null, err.message, ipAddress);
      } catch { /* silent */ }
    }
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logInbound(
  supabase: any,
  webhook: any,
  leadId: string | null,
  action: string,
  rawPayload: any,
  mappedData: any,
  changesApplied: any,
  errorMessage: string | null,
  ipAddress: string | null
) {
  try {
    await supabase.from("inbound_webhook_logs").insert({
      organization_id: webhook.organization_id,
      inbound_webhook_id: webhook.id,
      lead_id: leadId,
      action,
      raw_payload: rawPayload,
      mapped_data: mappedData,
      changes_applied: changesApplied,
      error_message: errorMessage,
      ip_address: ipAddress,
    });
  } catch { /* silent */ }
}

async function getAnyOrgUser(supabase: any, orgId: string): Promise<string> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .single();
  return data?.user_id || "00000000-0000-0000-0000-000000000000";
}
