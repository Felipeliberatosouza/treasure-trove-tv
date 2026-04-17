import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CHANGE-SUB-PLAN] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

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

    const { newPlanId, paymentMethodId } = await req.json();
    if (!newPlanId) throw new Error("newPlanId required");

    const { data: newPlan } = await sb
      .from("subscription_plans")
      .select("id, name, price, stripe_price_id")
      .eq("id", newPlanId)
      .maybeSingle();
    if (!newPlan?.stripe_price_id)
      return new Response(
        JSON.stringify({ ok: false, error: "Plano destino sem stripe_price_id." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0)
      return new Response(
        JSON.stringify({ ok: false, error: "Cliente Stripe não encontrado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    const customerId = customers.data[0].id;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subs.data.length === 0)
      return new Response(
        JSON.stringify({ ok: false, error: "Sem assinatura ativa." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    const sub = subs.data[0];
    const currentItem = sub.items.data[0];
    const currentAmount = (currentItem.price.unit_amount ?? 0) / 100;
    const isUpgrade = newPlan.price > currentAmount;

    // If a payment method was provided (newly tokenized via Elements), attach it
    if (paymentMethodId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      } catch (e) {
        log("attach pm warn (may be already attached)", { e: String(e) });
      }
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      // Also set as default on the subscription itself
      await stripe.subscriptions.update(sub.id, { default_payment_method: paymentMethodId });
      log("Default PM updated", { paymentMethodId });
    }

    // Perform the swap
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: currentItem.id, price: newPlan.stripe_price_id }],
      proration_behavior: isUpgrade ? "always_invoice" : "create_prorations",
      payment_behavior: "error_if_incomplete",
    });
    log("Subscription updated", { id: updated.id, status: updated.status });

    // For upgrades: try to pay any newly-created invoice immediately
    let paid = true;
    let failureMessage: string | null = null;
    if (isUpgrade) {
      try {
        const invs = await stripe.invoices.list({
          customer: customerId,
          subscription: sub.id,
          limit: 3,
        });
        const open = invs.data.find((i) => i.status === "open");
        if (open) {
          const finalized = await stripe.invoices.pay(open.id);
          if (finalized.status !== "paid") {
            paid = false;
            failureMessage = "Pagamento da diferença não foi concluído.";
          }
        }
      } catch (e) {
        paid = false;
        failureMessage = e instanceof Error ? e.message : String(e);
        log("Pay invoice failed", { failureMessage });
      }
    }

    if (!paid) {
      return new Response(
        JSON.stringify({ ok: false, error: failureMessage || "Falha no pagamento." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Sync local DB: archive old, insert new
    const { data: existingLocal } = await sb
      .from("student_subscriptions")
      .select("id, plan_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPeriodEnd = updated.current_period_end
      ? new Date(updated.current_period_end * 1000).toISOString()
      : null;

    if (existingLocal && existingLocal.plan_id !== newPlan.id) {
      await sb
        .from("student_subscriptions")
        .update({
          status: "expired",
          expires_at: new Date().toISOString(),
          stripe_subscription_id: `${updated.id}:prev:${existingLocal.id}`,
        })
        .eq("id", existingLocal.id);

      await sb.from("student_subscriptions").insert({
        user_id: user.id,
        plan_id: newPlan.id,
        status: "active",
        stripe_subscription_id: updated.id,
        expires_at: newPeriodEnd,
      });
    } else if (existingLocal) {
      await sb
        .from("student_subscriptions")
        .update({ expires_at: newPeriodEnd, stripe_subscription_id: updated.id })
        .eq("id", existingLocal.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        isUpgrade,
        subscriptionId: updated.id,
        status: updated.status,
        newPlanId: newPlan.id,
        newPlanName: newPlan.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
