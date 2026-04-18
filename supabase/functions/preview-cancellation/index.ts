import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[PREVIEW-CANCELLATION] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/**
 * Returns the authoritative cancellation breakdown for the user's currently
 * active Stripe subscription, with the ENGINE OF TRUTH being Stripe itself:
 *
 *   - currentAmount      → Stripe price unit_amount of current item
 *   - dailyRate          → currentAmount / cycleDays (Stripe period)
 *   - daysUsed           → derived from Stripe current_period_start → now
 *   - cycleDays          → Stripe current_period_end − current_period_start (in days)
 *   - usedAmount         → dailyRate * daysUsed (Stripe-derived)
 *   - minCharge          → DB min_usage_charge_pct% of currentAmount
 *   - proRataAmount      → max(usedAmount, minCharge)
 *   - commitmentPenalty  → DB-driven penalty (only when plan disallows free cancel
 *                          AND user is still inside min_commitment_days)
 *   - chargeAmount       → proRataAmount + commitmentPenalty
 *
 * The pro-rata uses Stripe's clock, not the local DB's started_at, so the
 * value matches what Stripe will actually invoice on cancellation.
 */
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) throw new Error("Cliente Stripe não encontrado");
    const customerId = customers.data[0].id;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    if (subs.data.length === 0) throw new Error("Sem assinatura ativa no Stripe");
    const sub = subs.data[0];
    const item = sub.items.data[0];
    const currentAmount = (item.price.unit_amount ?? 0) / 100;
    const currency = item.price.currency || "brl";

    // Stripe's authoritative period
    const periodStartSec = sub.current_period_start ?? 0;
    const periodEndSec = sub.current_period_end ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const cycleSeconds = Math.max(1, periodEndSec - periodStartSec);
    const usedSeconds = Math.max(0, Math.min(cycleSeconds, nowSec - periodStartSec));
    const cycleDays = Math.max(1, Math.round(cycleSeconds / 86400));
    const daysUsed = Math.max(0, Math.min(cycleDays, Math.floor(usedSeconds / 86400)));

    // Pro-rata directly from Stripe pricing + Stripe clock
    const dailyRate = currentAmount / cycleDays;
    const usedAmount = dailyRate * daysUsed;

    // Plan policy comes from local DB (Stripe doesn't model these business rules)
    const stripePriceId = item.price.id;
    const { data: planRow } = await sb
      .from("subscription_plans")
      .select(
        "id, name, price, allow_free_cancel, min_commitment_days, min_usage_charge_pct, stripe_price_id"
      )
      .eq("stripe_price_id", stripePriceId)
      .maybeSingle();

    const minUsageChargePct = planRow?.min_usage_charge_pct ?? 0;
    const allowFreeCancel = planRow?.allow_free_cancel ?? true;
    const minCommitmentDays = planRow?.min_commitment_days ?? 0;
    const planName = planRow?.name ?? "Plano";

    const minCharge = (minUsageChargePct / 100) * currentAmount;
    const proRataAmount = Math.max(usedAmount, minCharge);

    // Commitment penalty: only when plan forbids free cancel AND we're still
    // inside the commitment window. "totalSubscriptionDays" = days since the
    // ORIGINAL Stripe subscription start (not the current cycle).
    const subStartSec = sub.start_date ?? sub.created ?? periodStartSec;
    const totalSubscriptionDays = Math.max(
      0,
      Math.floor((nowSec - subStartSec) / 86400)
    );
    const isInCommitment = !allowFreeCancel && totalSubscriptionDays < minCommitmentDays;
    const commitmentDaysRemaining = isInCommitment
      ? Math.max(0, minCommitmentDays - totalSubscriptionDays)
      : 0;
    const commitmentPenalty = isInCommitment ? dailyRate * commitmentDaysRemaining : 0;

    const chargeAmount = proRataAmount + commitmentPenalty;

    const round2 = (n: number) => Number(n.toFixed(2));

    log("Computed", {
      currentAmount,
      cycleDays,
      daysUsed,
      dailyRate: round2(dailyRate),
      usedAmount: round2(usedAmount),
      minCharge: round2(minCharge),
      proRataAmount: round2(proRataAmount),
      isInCommitment,
      commitmentDaysRemaining,
      commitmentPenalty: round2(commitmentPenalty),
      chargeAmount: round2(chargeAmount),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        // Plan / policy
        planName,
        allowFreeCancel,
        minCommitmentDays,
        minUsageChargePct,
        // Stripe-derived figures
        currency,
        currentAmount: round2(currentAmount),
        cycleDays,
        daysUsed,
        totalSubscriptionDays,
        dailyRate: round2(dailyRate),
        usedAmount: round2(usedAmount),
        // Computed totals
        minCharge: round2(minCharge),
        proRataAmount: round2(proRataAmount),
        isInCommitment,
        commitmentDaysRemaining,
        commitmentPenalty: round2(commitmentPenalty),
        chargeAmount: round2(chargeAmount),
        // Raw Stripe context (useful for debugging / receipts)
        stripeSubscriptionId: sub.id,
        stripePriceId,
        currentPeriodStart: periodStartSec,
        currentPeriodEnd: periodEndSec,
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
