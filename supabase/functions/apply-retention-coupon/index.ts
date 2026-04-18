import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[APPLY-RETENTION-COUPON] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/**
 * Retention flow: when a student is about to cancel, we offer a discount
 * coupon. If they accept, we apply the configured coupon to their active
 * subscription via Stripe and abort the cancellation.
 *
 * Body: { reasonCode?: string }
 *
 * The coupon ID and which reasons are eligible are configured by the admin
 * in the platform_settings table under the 'retention_coupon' key.
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
    const reasonCode: string | undefined = body?.reasonCode;

    // Load admin config
    const { data: row, error: cfgErr } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "retention_coupon")
      .maybeSingle();
    if (cfgErr) throw new Error("Falha ao carregar configuração de retenção.");
    const cfg = (row?.value || {}) as {
      enabled?: boolean;
      coupon_id?: string;
      eligible_reasons?: string[];
      cooldown_months?: number;
    };

    if (!cfg.enabled || !cfg.coupon_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Oferta de retenção indisponível." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    if (
      reasonCode &&
      Array.isArray(cfg.eligible_reasons) &&
      cfg.eligible_reasons.length > 0 &&
      !cfg.eligible_reasons.includes(reasonCode)
    ) {
      return new Response(
        JSON.stringify({ ok: false, error: "Motivo não elegível para esta oferta." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Cooldown / one-shot guard: if this user has already accepted a retention
    // coupon, only re-offer it after `cooldown_months` have elapsed.
    // cooldown_months <= 0 → block forever (one-shot per student).
    const cooldownMonths = Number.isFinite(cfg.cooldown_months) ? Number(cfg.cooldown_months) : 12;
    const { data: prior, error: priorErr } = await sb
      .from("audit_logs")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("action", "retention_coupon_applied")
      .order("created_at", { ascending: false })
      .limit(1);
    if (priorErr) log("prior check failed", { msg: priorErr.message });
    if (prior && prior.length > 0) {
      const lastAt = new Date(prior[0].created_at as string);
      const now = new Date();
      const monthsSince =
        (now.getFullYear() - lastAt.getFullYear()) * 12 +
        (now.getMonth() - lastAt.getMonth()) +
        // partial-month adjustment so "exactly 12 months" counts as elapsed
        (now.getDate() >= lastAt.getDate() ? 0 : -1);

      const stillBlocked = cooldownMonths <= 0 || monthsSince < cooldownMonths;
      if (stillBlocked) {
        log("retention still in cooldown — blocking", {
          userId: user.id,
          cooldownMonths,
          monthsSince,
          lastAt: lastAt.toISOString(),
        });
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              cooldownMonths <= 0
                ? "Esta oferta de retenção já foi utilizada anteriormente."
                : `Você poderá receber esta oferta novamente em ${Math.max(
                    1,
                    cooldownMonths - monthsSince,
                  )} mês(es).`,
            alreadyUsed: true,
            cooldownMonths,
            monthsSince,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      log("prior coupon found but cooldown elapsed — proceeding", {
        cooldownMonths,
        monthsSince,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find active subscription via customer email
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nenhuma assinatura ativa encontrada." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    const subs = await stripe.subscriptions.list({
      customer: customers.data[0].id,
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
    log("applying coupon", { subId: sub.id, couponId: cfg.coupon_id });

    // Apply coupon to subscription
    const updated = await stripe.subscriptions.update(sub.id, {
      coupon: cfg.coupon_id,
      metadata: {
        ...(sub.metadata || {}),
        retention_coupon_applied: cfg.coupon_id,
        retention_applied_at: new Date().toISOString(),
        retention_reason_code: reasonCode || "",
      },
    });
    log("coupon applied", { status: updated.status });

    // Audit
    try {
      await sb.from("audit_logs").insert({
        user_id: user.id,
        action: "retention_coupon_applied",
        target_table: "student_subscriptions",
        target_id: sub.id,
        metadata: {
          coupon_id: cfg.coupon_id,
          reason_code: reasonCode || null,
          email: user.email,
        },
      });
    } catch (e) {
      log("audit log failed", { msg: e instanceof Error ? e.message : String(e) });
    }

    return new Response(
      JSON.stringify({ ok: true, couponId: cfg.coupon_id }),
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
