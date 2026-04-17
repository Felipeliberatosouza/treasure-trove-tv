import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[PREVIEW-PLAN-CHANGE] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No authorization header");
    const token = auth.replace("Bearer ", "");
    const { data: ud, error: ue } = await sb.auth.getUser(token);
    if (ue || !ud.user?.email) throw new Error("Auth failed");
    const user = ud.user;

    const { newPlanId } = await req.json();
    if (!newPlanId) throw new Error("newPlanId required");

    const { data: newPlan } = await sb
      .from("subscription_plans")
      .select("id, name, price, stripe_price_id")
      .eq("id", newPlanId)
      .maybeSingle();
    if (!newPlan?.stripe_price_id)
      throw new Error("Plano destino sem stripe_price_id configurado");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) throw new Error("Cliente Stripe não encontrado");
    const customerId = customers.data[0].id;

    const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
    if (subs.data.length === 0) throw new Error("Sem assinatura ativa no Stripe");
    const sub = subs.data[0];
    const currentPriceId = sub.items.data[0].price.id;
    const currentAmount = (sub.items.data[0].price.unit_amount ?? 0) / 100;
    const newAmount = newPlan.price;
    const isUpgrade = newAmount > currentAmount;

    log("Computing upcoming invoice preview", { isUpgrade });

    // Use upcoming invoice to get accurate proration
    let proratedTotal = 0;
    let creditAmount = 0;
    let chargeAmount = 0;
    let nextInvoiceTotal = 0;
    let currency = "brl";
    try {
      // @ts-ignore stripe types
      const upcoming = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
        subscription: sub.id,
        subscription_items: [
          { id: sub.items.data[0].id, price: newPlan.stripe_price_id },
        ],
        subscription_proration_behavior: isUpgrade ? "always_invoice" : "create_prorations",
      });
      currency = upcoming.currency || "brl";
      const lines = upcoming.lines?.data || [];
      for (const l of lines) {
        const amt = (l.amount ?? 0) / 100;
        if (l.proration) {
          proratedTotal += amt;
          if (amt < 0) creditAmount += -amt;
          else chargeAmount += amt;
        }
      }
      nextInvoiceTotal = (upcoming.amount_due ?? 0) / 100;
    } catch (e) {
      log("upcoming invoice failed, fallback to manual estimate", { error: String(e) });
      // Fallback: manual estimate
      const periodStart = (sub.current_period_start ?? 0) * 1000;
      const periodEnd = (sub.current_period_end ?? 0) * 1000;
      const now = Date.now();
      const totalMs = periodEnd - periodStart;
      const remainingMs = Math.max(0, periodEnd - now);
      const remainRatio = totalMs > 0 ? remainingMs / totalMs : 0;
      const credit = currentAmount * remainRatio;
      const charge = newAmount * remainRatio;
      creditAmount = credit;
      chargeAmount = charge;
      proratedTotal = charge - credit;
      nextInvoiceTotal = isUpgrade ? Math.max(0, proratedTotal) : 0;
    }

    return new Response(
      JSON.stringify({
        isUpgrade,
        currentAmount,
        newAmount,
        creditAmount: Number(creditAmount.toFixed(2)),
        chargeAmount: Number(chargeAmount.toFixed(2)),
        proratedTotal: Number(proratedTotal.toFixed(2)),
        nextInvoiceTotal: Number(nextInvoiceTotal.toFixed(2)),
        currency,
        currentPriceId,
        newPriceId: newPlan.stripe_price_id,
        currentPeriodEnd: sub.current_period_end,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
