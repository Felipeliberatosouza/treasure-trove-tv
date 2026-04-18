import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CANCEL-SUBSCRIPTION] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/**
 * Cancels the user's active subscription directly via the payment provider's
 * API — no portal redirect, no external screens. The user stays on our UI
 * the entire time.
 *
 * Flow:
 *  1. Look up the active Stripe subscription by customer email.
 *  2. Cancel it immediately (`subscriptions.cancel`) — Stripe will issue
 *     final pro-rated invoice handling on its side via the existing
 *     plan/usage rules. We don't open the billing portal.
 *  3. Mirror the cancellation in our local `student_subscriptions` table
 *     (status=cancelled, expires_at=now).
 *
 * Returns `{ ok: true }` on success.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Chave de pagamento não configurada");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No authorization header");
    const token = auth.replace("Bearer ", "");
    const { data: ud, error: ue } = await sb.auth.getUser(token);
    if (ue || !ud.user?.email) throw new Error("Não autenticado");
    const user = ud.user;
    log("auth ok", { userId: user.id });

    // Optional cancellation reason from the in-app modal.
    let reasonCode: string | null = null;
    let reasonDetails: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        if (typeof body.reasonCode === "string") reasonCode = body.reasonCode.slice(0, 50) || null;
        if (typeof body.reasonDetails === "string") reasonDetails = body.reasonDetails.slice(0, 500) || null;
      }
    } catch { /* no body is fine */ }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nenhuma assinatura ativa encontrada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subs.data.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nenhuma assinatura ativa encontrada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const sub = subs.data[0];
    log("cancelling subscription", { id: sub.id, reasonCode });

    // Persist reason on the subscription metadata BEFORE cancellation so it's
    // attached to the canceled record in the provider as well.
    if (reasonCode || reasonDetails) {
      try {
        await stripe.subscriptions.update(sub.id, {
          metadata: {
            ...(sub.metadata || {}),
            cancellation_reason_code: reasonCode || "",
            cancellation_reason_details: reasonDetails || "",
            cancellation_requested_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        log("metadata update failed", { msg: e instanceof Error ? e.message : String(e) });
      }
    }

    // Immediate cancellation — no portal, no extra UI.
    const cancelled = await stripe.subscriptions.cancel(sub.id, {
      invoice_now: true,
      prorate: true,
    });
    log("cancelled in provider", { status: cancelled.status });

    // Mirror in local DB so UI updates instantly without waiting for webhook.
    const nowIso = new Date().toISOString();
    const { error: updErr } = await sb
      .from("student_subscriptions")
      .update({ status: "cancelled", expires_at: nowIso, updated_at: nowIso })
      .eq("user_id", user.id)
      .eq("status", "active");
    if (updErr) log("local mirror update failed", { msg: updErr.message });

    // Audit log so admins can see WHY users cancel — drives the stats panel.
    try {
      await sb.from("audit_logs").insert({
        user_id: user.id,
        action: "subscription_cancelled",
        target_table: "student_subscriptions",
        target_id: sub.id,
        metadata: {
          reason_code: reasonCode,
          reason_details: reasonDetails,
          stripe_subscription_id: sub.id,
          email: user.email,
        },
      });
    } catch (e) {
      log("audit log failed", { msg: e instanceof Error ? e.message : String(e) });
    }

    return new Response(
      JSON.stringify({ ok: true, cancelledAt: nowIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
