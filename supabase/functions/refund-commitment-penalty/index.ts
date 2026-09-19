import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[REFUND-COMMITMENT-PENALTY] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

interface RefundBody {
  user_id: string;
  refund_amount: number; // in BRL units (e.g. 49.90)
  original_penalty_amount?: number;
  reason?: string;
  stripe_subscription_id?: string;
  stripe_charge_id?: string;
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

    // Authenticate caller and require admin
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No authorization header");
    const token = auth.replace("Bearer ", "");
    const { data: ud, error: ue } = await sb.auth.getUser(token);
    if (ue || !ud.user) throw new Error("Auth failed");
    const adminUser = ud.user;

    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: adminUser.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem reembolsar multas");

    const body = (await req.json()) as RefundBody;
    if (!body.user_id) throw new Error("user_id obrigatório");
    if (!body.refund_amount || body.refund_amount <= 0)
      throw new Error("Valor de reembolso inválido");

    // Fetch student email to locate Stripe customer
    const { data: profile, error: pe } = await sb
      .from("profiles")
      .select("email, name")
      .eq("user_id", body.user_id)
      .maybeSingle();
    if (pe || !profile?.email) throw new Error("Aluno não encontrado");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
    if (customers.data.length === 0) throw new Error("Cliente Stripe não encontrado");
    const customerId = customers.data[0].id;

    // Locate the charge to refund: prefer explicit stripe_charge_id, otherwise
    // pick the most recent succeeded charge for this customer.
    let chargeId = body.stripe_charge_id ?? null;
    if (!chargeId) {
      const charges = await stripe.charges.list({ customer: customerId, limit: 10 });
      const succeeded = charges.data.find((c) => c.status === "succeeded" && !c.refunded);
      if (!succeeded) throw new Error("Nenhuma cobrança recente encontrada para reembolso");
      chargeId = succeeded.id;
    }

    const amountCents = Math.round(body.refund_amount * 100);

    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amountCents,
      reason: "requested_by_customer",
      metadata: {
        type: "commitment_penalty_refund",
        admin_id: adminUser.id,
        user_id: body.user_id,
        original_penalty: String(body.original_penalty_amount ?? ""),
        notes: body.reason ?? "",
      },
    });

    const refundType =
      body.original_penalty_amount && body.refund_amount >= body.original_penalty_amount
        ? "total"
        : "partial";

    // Persist refund record
    const { data: inserted, error: ie } = await sb
      .from("commitment_penalty_refunds")
      .insert({
        user_id: body.user_id,
        admin_id: adminUser.id,
        stripe_subscription_id: body.stripe_subscription_id ?? null,
        stripe_charge_id: chargeId,
        stripe_refund_id: refund.id,
        original_penalty_amount: body.original_penalty_amount ?? 0,
        refund_amount: body.refund_amount,
        refund_type: refundType,
        reason: body.reason ?? null,
        status: refund.status ?? "succeeded",
        metadata: { stripe_status: refund.status, currency: refund.currency },
      })
      .select()
      .single();
    if (ie) log("DB insert failed", { ie });

    // Send transactional email to the student notifying about the refund
    try {
      const fmtBRL = (v: number) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const processedAt = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      await sb.functions.invoke("send-app-email", {
        body: {
          templateName: "commitment-penalty-refunded",
          recipientEmail: profile.email,
          idempotencyKey: `penalty-refund-${refund.id}`,
          templateData: {
            name: profile.name ?? undefined,
            refundAmount: fmtBRL(body.refund_amount),
            originalPenaltyAmount: body.original_penalty_amount
              ? fmtBRL(body.original_penalty_amount)
              : undefined,
            refundType,
            reason: body.reason ?? undefined,
            processedAt,
          },
        },
      });
    } catch (mailErr) {
      log("Email dispatch failed", { mailErr: String(mailErr) });
    }

    // Audit log
    await sb.from("audit_logs").insert({
      user_id: adminUser.id,
      action: "commitment_penalty_refund",
      target_table: "commitment_penalty_refunds",
      target_id: inserted?.id ?? refund.id,
      metadata: {
        target_user_id: body.user_id,
        target_user_email: profile.email,
        target_user_name: profile.name,
        stripe_charge_id: chargeId,
        stripe_refund_id: refund.id,
        refund_amount: body.refund_amount,
        original_penalty_amount: body.original_penalty_amount ?? null,
        refund_type: refundType,
        reason: body.reason ?? null,
        notification_email_sent: true,
      },
    });

    log("Refund OK", { refundId: refund.id, amount: body.refund_amount });

    return new Response(
      JSON.stringify({
        ok: true,
        refund_id: refund.id,
        record_id: inserted?.id ?? null,
        status: refund.status,
        amount: body.refund_amount,
        refund_type: refundType,
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
