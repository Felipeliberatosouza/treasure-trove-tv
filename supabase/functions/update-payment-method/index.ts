import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[UPDATE-PAYMENT-METHOD] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/**
 * Updates the user's default payment method — used after the student saves a
 * new card in-app via Stripe Elements (SetupIntent).
 *
 * Body: { paymentMethodId: string, removeOthers?: boolean }
 *
 * Steps:
 *  1. Look up (or create) the customer for the authenticated email.
 *  2. Attach the PM to the customer (idempotent — Stripe ignores re-attach).
 *  3. Set it as the customer's default invoice PM.
 *  4. If the user has an active subscription, set it as the subscription's
 *     default PM so the next invoice charges the new card.
 *  5. Optionally detach all other saved cards (when removeOthers=true).
 *
 * Returns 200 OK with `{ ok: true }` on success or `{ ok: false, error }`
 * for business errors so the frontend can show a friendly toast.
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

    const body = await req.json().catch(() => ({}));
    const paymentMethodId: string | undefined = body?.paymentMethodId;
    const removeOthers: boolean = body?.removeOthers === true;

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "paymentMethodId é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // 1. Resolve customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    const customerId =
      customers.data[0]?.id ??
      (await stripe.customers.create({ email: user.email! })).id;
    log("customer", { customerId });

    // 2. Attach PM (safe if already attached — Stripe throws "already attached"
    //    which we ignore).
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already") && !msg.includes("attached")) throw e;
      log("attach skipped (already attached)");
    }

    // 3. Default for invoices
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    log("set default on customer");

    // 4. Update active subscription's default PM (if any)
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subs.data.length > 0) {
      await stripe.subscriptions.update(subs.data[0].id, {
        default_payment_method: paymentMethodId,
      });
      log("set default on subscription", { id: subs.data[0].id });
    }

    // 5. Optional: detach all other saved cards
    if (removeOthers) {
      const all = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
      for (const pm of all.data) {
        if (pm.id !== paymentMethodId) {
          try {
            await stripe.paymentMethods.detach(pm.id);
          } catch (e) {
            log("detach failed", { id: pm.id, msg: e instanceof Error ? e.message : String(e) });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
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
