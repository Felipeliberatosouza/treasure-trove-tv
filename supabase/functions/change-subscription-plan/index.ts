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

type PayResult =
  | { kind: "paid" }
  | { kind: "requires_action"; clientSecret: string; invoiceId: string; paymentIntentId: string }
  | { kind: "failed"; message: string };

/**
 * Pays an open invoice and detects 3DS / requires_action so the frontend
 * can run stripe.confirmCardPayment(clientSecret) and re-call this function
 * with retryInvoiceId.
 */
async function payInvoiceWithSCA(stripe: Stripe, invoiceId: string): Promise<PayResult> {
  try {
    const paid = await stripe.invoices.pay(invoiceId, {
      // Expand PI so we can read its status and client_secret
      expand: ["payment_intent"],
    });
    if (paid.status === "paid") return { kind: "paid" };

    // Inspect underlying PaymentIntent
    const pi = (paid as unknown as { payment_intent?: Stripe.PaymentIntent | string })
      .payment_intent;
    const piObj =
      typeof pi === "string" ? await stripe.paymentIntents.retrieve(pi) : pi ?? null;

    if (piObj && piObj.status === "requires_action" && piObj.client_secret) {
      log("Invoice requires_action (3DS)", { invoiceId, piId: piObj.id });
      return {
        kind: "requires_action",
        clientSecret: piObj.client_secret,
        invoiceId,
        paymentIntentId: piObj.id,
      };
    }

    return { kind: "failed", message: "Pagamento da diferença não foi concluído." };
  } catch (e) {
    // Stripe throws on invoice_payment_failed or card errors.
    // If a PI was created and is in requires_action, surface it for SCA.
    const err = e as Stripe.errors.StripeError & { payment_intent?: Stripe.PaymentIntent };
    const pi = err.payment_intent;
    if (pi && pi.status === "requires_action" && pi.client_secret) {
      log("Stripe error → 3DS required", { piId: pi.id });
      return {
        kind: "requires_action",
        clientSecret: pi.client_secret,
        invoiceId,
        paymentIntentId: pi.id,
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    log("Pay invoice failed", { msg });
    return { kind: "failed", message: msg };
  }
}

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

    const { newPlanId, paymentMethodId, retryInvoiceId } = await req.json();
    if (!newPlanId && !retryInvoiceId)
      throw new Error("newPlanId or retryInvoiceId required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // ===== RETRY BRANCH =====
    // Frontend already ran stripe.confirmCardPayment(clientSecret) after 3DS.
    // We just verify the invoice is now paid and sync local DB.
    if (retryInvoiceId) {
      log("Retry branch", { retryInvoiceId });
      const inv = await stripe.invoices.retrieve(retryInvoiceId, {
        expand: ["payment_intent", "subscription"],
      });

      // If still open, attempt one more pay (PI may already be succeeded after SCA)
      let invoice = inv;
      if (invoice.status !== "paid") {
        const result = await payInvoiceWithSCA(stripe, retryInvoiceId);
        if (result.kind === "requires_action") {
          return new Response(
            JSON.stringify({
              ok: false,
              requiresAction: true,
              clientSecret: result.clientSecret,
              invoiceId: result.invoiceId,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        if (result.kind === "failed") {
          return new Response(
            JSON.stringify({ ok: false, error: result.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        invoice = await stripe.invoices.retrieve(retryInvoiceId);
      }

      // Sync local DB based on the subscription tied to this invoice
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      if (!subId) {
        return new Response(
          JSON.stringify({ ok: true, isUpgrade: true, status: "paid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      const updated = await stripe.subscriptions.retrieve(subId);
      await syncLocalSubscription(sb, user.id, updated);

      return new Response(
        JSON.stringify({
          ok: true,
          isUpgrade: true,
          subscriptionId: updated.id,
          status: updated.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ===== NORMAL BRANCH =====
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

    // Attach newly tokenized PM (no-op if already attached)
    if (paymentMethodId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      } catch (e) {
        log("attach pm warn (may be already attached)", { e: String(e) });
      }
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      await stripe.subscriptions.update(sub.id, {
        default_payment_method: paymentMethodId,
      });
      log("Default PM updated", { paymentMethodId });
    }

    // Perform the swap
    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: currentItem.id, price: newPlan.stripe_price_id }],
      proration_behavior: isUpgrade ? "always_invoice" : "create_prorations",
      payment_behavior: "error_if_incomplete",
    });
    log("Subscription updated", { id: updated.id, status: updated.status });

    // For upgrades: pay the newly-created invoice (handle 3DS)
    if (isUpgrade) {
      const invs = await stripe.invoices.list({
        customer: customerId,
        subscription: sub.id,
        limit: 3,
      });
      const open = invs.data.find((i) => i.status === "open");
      if (open) {
        const result = await payInvoiceWithSCA(stripe, open.id);
        if (result.kind === "requires_action") {
          // Tell frontend to run 3DS, then retry with retryInvoiceId
          return new Response(
            JSON.stringify({
              ok: false,
              requiresAction: true,
              clientSecret: result.clientSecret,
              invoiceId: result.invoiceId,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
        if (result.kind === "failed") {
          return new Response(
            JSON.stringify({ ok: false, error: result.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }
      }
    }

    // Sync local DB
    await syncLocalSubscription(sb, user.id, updated, newPlan.id);

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

/**
 * Archives the previous local subscription row (if plan changed) and
 * inserts/updates the active row to match the Stripe subscription.
 */
async function syncLocalSubscription(
  sb: ReturnType<typeof createClient>,
  userId: string,
  updated: Stripe.Subscription,
  newPlanLocalId?: string,
) {
  const { data: existingLocal } = await sb
    .from("student_subscriptions")
    .select("id, plan_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newPeriodEnd = updated.current_period_end
    ? new Date(updated.current_period_end * 1000).toISOString()
    : null;

  if (existingLocal && newPlanLocalId && existingLocal.plan_id !== newPlanLocalId) {
    await sb
      .from("student_subscriptions")
      .update({
        status: "expired",
        expires_at: new Date().toISOString(),
        stripe_subscription_id: `${updated.id}:prev:${existingLocal.id}`,
      })
      .eq("id", existingLocal.id);

    await sb.from("student_subscriptions").insert({
      user_id: userId,
      plan_id: newPlanLocalId,
      status: "active",
      stripe_subscription_id: updated.id,
      expires_at: newPeriodEnd,
    });
  } else if (existingLocal) {
    await sb
      .from("student_subscriptions")
      .update({
        expires_at: newPeriodEnd,
        stripe_subscription_id: updated.id,
      })
      .eq("id", existingLocal.id);
  }
}
