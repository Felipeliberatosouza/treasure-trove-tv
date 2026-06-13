import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server-side writer for `security_notifications`. The table no longer
 * accepts anon/authenticated INSERTs — this function uses the service role
 * to validate the payload and insert the row, so attackers can't flood the
 * queue with arbitrary entries.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const templateKey = String(body?.template_key ?? "").trim();
    const subject = String(body?.subject ?? "").trim().slice(0, 255);
    const userAgent = String(body?.user_agent ?? req.headers.get("user-agent") ?? "").slice(0, 500);

    if (!email || !EMAIL_RE.test(email) || email.length > 255) {
      return json({ ok: false, error: "invalid email" }, 200);
    }
    if (!templateKey || templateKey.length > 100) {
      return json({ ok: false, error: "invalid template_key" }, 200);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { error } = await sb.from("security_notifications").insert({
      email,
      template_key: templateKey,
      subject,
      ip_address: ip,
      user_agent: userAgent,
      status: "pending",
    });

    if (error) {
      console.error("[report-security-notification] insert error", error.message);
      return json({ ok: false, error: "insert failed" }, 200);
    }
    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[report-security-notification] ERROR", msg);
    return json({ ok: false, error: msg }, 200);
  }
});