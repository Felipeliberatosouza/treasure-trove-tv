import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-SUB-EMBEDDED] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface BillingDetails {
  name?: string;
  cpf?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

/**
 * Creates an "incomplete" subscription that returns a PaymentIntent
 * client_secret. The frontend confirms it with Stripe Elements — no
 * external Checkout page is shown to the user.
 *
 * Body: { priceId: string, paymentMethodId: string, billing: BillingDetails }
 * Returns: { ok, clientSecret?, subscriptionId?, status?, error? }
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
    if (!auth) return json({ ok: false, error: "Não autenticado" }, 200);
    const token = auth.replace("Bearer ", "");
    const { data: ud, error: ue } = await sb.auth.getUser(token);
    if (ue || !ud.user?.email) return json({ ok: false, error: "Não autenticado" }, 200);
    const user = ud.user;

    const body = await req.json().catch(() => ({}));
    const priceId = String(body?.priceId || "").trim();
    const paymentMethodId = String(body?.paymentMethodId || "").trim();
    const billing = (body?.billing || {}) as BillingDetails;
    const requestedCashback = Number(body?.cashbackAmount || 0);

    if (!priceId.startsWith("price_")) return json({ ok: false, error: "Plano inválido" }, 200);
    if (!paymentMethodId.startsWith("pm_")) return json({ ok: false, error: "Cartão inválido" }, 200);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // 1. Resolve / create customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;

      // Block duplicate active subscription
      const existing = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      if (existing.data.length > 0) {
        return json(
          { ok: false, error: "Você já possui uma assinatura ativa. Gerencie-a pelo painel." },
          200
        );
      }
    } else {
      const created = await stripe.customers.create({ email: user.email! });
      customerId = created.id;
    }

    // 2. Update customer billing details (name + address)
    await stripe.customers.update(customerId, {
      name: billing.name || undefined,
      address: billing.line1
        ? {
            line1: billing.line1,
            line2: billing.line2 || undefined,
            city: billing.city || undefined,
            state: billing.state || undefined,
            postal_code: billing.postal_code || undefined,
            country: billing.country || "BR",
          }
        : undefined,
      metadata: { cpf: billing.cpf || "" },
    });

    // 3. Attach PM (idempotent)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already") && !msg.includes("attached")) throw e;
    }

    // 4. Set as customer default
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // 4b. Apply cashback as a one-shot Stripe coupon on the first invoice.
    let cashbackApplied = 0;
    let discountId: string | undefined;
    if (requestedCashback > 0) {
      // Resolve the price's recurring amount to compute cap
      const price = await stripe.prices.retrieve(priceId);
      const cartAmount = (price.unit_amount ?? 0) / 100;
      const { data: previewData, error: previewErr } = await sb.rpc("preview_cashback_usage", {
        _user_id: user.id,
        _cart_amount: cartAmount,
      });
      if (previewErr) {
        log("Cashback preview error", { err: previewErr.message });
        return json(
          { ok: false, error: "Não foi possível validar seu saldo de cashback. Tente novamente." },
          200,
        );
      }
      const maxUsable = Number(
        (previewData as Record<string, number> | null)?.max_usable ?? 0,
      );
      // Strict validation: reject if user tries to apply more than allowed.
      if (requestedCashback - maxUsable > 0.01) {
        log("Cashback request exceeds cap", { requestedCashback, maxUsable });
        return json(
          {
            ok: false,
            error: `Saldo de cashback insuficiente. Máximo aplicável: R$ ${maxUsable
              .toFixed(2)
              .replace(".", ",")}.`,
          },
          200,
        );
      }
      cashbackApplied = Math.max(Math.min(requestedCashback, maxUsable), 0);
      if (cashbackApplied > 0) {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(cashbackApplied * 100),
          currency: "brl",
          duration: "once",
          name: `Cashback R$ ${cashbackApplied.toFixed(2).replace(".", ",")}`,
          metadata: { user_id: user.id, kind: "cashback" },
        });
        discountId = coupon.id;
        log("Cashback coupon created", { id: coupon.id, amount: cashbackApplied });
      }
    }

    // 5. Create subscription with default_incomplete → returns PI client_secret
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      ...(discountId ? { discounts: [{ coupon: discountId }] } : {}),
      metadata: {
        user_id: user.id,
        cpf: billing.cpf || "",
        cashback_applied: String(cashbackApplied),
      },
    });

    if (cashbackApplied > 0) {
      const consumed = await sb.rpc("consume_cashback", {
        _user_id: user.id,
        _requested_amount: cashbackApplied,
        _source_reference: subscription.id,
      });
      log("Cashback consumed", { amount: consumed.data });
    }

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice & {
      payment_intent?: Stripe.PaymentIntent | string;
    } | null;
    const pi = latestInvoice?.payment_intent;
    const clientSecret =
      typeof pi === "object" && pi !== null ? pi.client_secret : null;

    log("Subscription created", {
      id: subscription.id,
      status: subscription.status,
      hasClientSecret: !!clientSecret,
    });

    return json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret,
      cashbackApplied,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return json({ ok: false, error: msg }, 200);
  }
});
