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

    const body = JSON.stringify(payload);
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
