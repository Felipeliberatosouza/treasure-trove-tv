import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CHARGE-LATE-CANCELLATION-FEE] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

interface ReqBody {
  lesson_id: string;
}

interface AulaCfg {
  lesson_duration_minutes: number;
  free_cancel_window_hours: number;
  late_cancel_fee_type: "percentage" | "fixed";
  late_cancel_fee_value: number;
  fee_split_platform_pct: number;
  fee_split_teacher_pct: number;
}

const DEFAULT_CFG: AulaCfg = {
  lesson_duration_minutes: 50,
  free_cancel_window_hours: 3,
  late_cancel_fee_type: "percentage",
  late_cancel_fee_value: 50,
  fee_split_platform_pct: 30,
  fee_split_teacher_pct: 70,
};

const round2 = (n: number) => Number(n.toFixed(2));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Auth: must be the student who owns the booking
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No authorization header");
    const token = auth.replace("Bearer ", "");
    const { data: ud, error: ue } = await sb.auth.getUser(token);
    if (ue || !ud.user) throw new Error("Auth failed");
    const user = ud.user;

    const body = (await req.json()) as ReqBody;
    if (!body.lesson_id) throw new Error("lesson_id obrigatório");

    // 1) Load lesson and ensure ownership + cancellable status
    const { data: lesson, error: le } = await sb
      .from("scheduled_lessons")
      .select("id, student_id, teacher_id, scheduled_at, price, status")
      .eq("id", body.lesson_id)
      .maybeSingle();
    if (le || !lesson) throw new Error("Aula não encontrada");
    if (lesson.student_id !== user.id) throw new Error("Aula pertence a outro aluno");
    if (!["pending", "confirmed"].includes(lesson.status))
      throw new Error("Aula já foi cancelada ou finalizada");

    // 2) Load admin config and recompute window/fee/split server-side
    const { data: cfgRow } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "aula_particular_config")
      .maybeSingle();
    const cfg: AulaCfg = (cfgRow?.value as AulaCfg) ?? DEFAULT_CFG;

    const scheduledMs = new Date(lesson.scheduled_at).getTime();
    const hoursUntil = (scheduledMs - Date.now()) / (1000 * 60 * 60);
    const isLate = hoursUntil < cfg.free_cancel_window_hours;

    if (!isLate) {
      throw new Error(
        `Aula ainda está dentro da janela gratuita (${cfg.free_cancel_window_hours}h). Use o cancelamento sem custo.`,
      );
    }

    const price = Number(lesson.price ?? 0);
    const fee =
      cfg.late_cancel_fee_type === "fixed"
        ? Math.min(cfg.late_cancel_fee_value, price)
        : round2((price * cfg.late_cancel_fee_value) / 100);

    const platformShare = round2((fee * cfg.fee_split_platform_pct) / 100);
    const teacherShare = round2((fee * cfg.fee_split_teacher_pct) / 100);
    const amountCents = Math.round(fee * 100);

    log("computed fee", { fee, platformShare, teacherShare, hoursUntil });

    // 3) Locate Stripe customer + default payment method
    const { data: profile } = await sb
      .from("profiles")
      .select("email, name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.email) throw new Error("Perfil sem e-mail cadastrado");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
    if (customers.data.length === 0)
      throw new Error("Nenhum método de pagamento encontrado. Cadastre um cartão antes.");
    const customerId = customers.data[0].id;

    const customer = await stripe.customers.retrieve(customerId);
    const defaultPm =
      typeof customer !== "string" && !customer.deleted
        ? (customer.invoice_settings?.default_payment_method as string | null)
        : null;

    let pmId = defaultPm;
    if (!pmId) {
      const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
      pmId = pms.data[0]?.id ?? null;
    }
    if (!pmId) throw new Error("Nenhum cartão cadastrado. Adicione um método de pagamento.");

    // 4) Charge fee via off-session PaymentIntent
    let charge;
    try {
      charge = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "brl",
        customer: customerId,
        payment_method: pmId,
        off_session: true,
        confirm: true,
        description: `Taxa de cancelamento tardio - Aula ${lesson.id}`,
        metadata: {
          lesson_id: lesson.id,
          student_id: user.id,
          teacher_id: lesson.teacher_id,
          fee_type: "late_cancel",
          platform_share: String(platformShare),
          teacher_share: String(teacherShare),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log("Stripe charge failed", { msg });
      return new Response(
        JSON.stringify({ error: `Falha ao cobrar taxa: ${msg}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 },
      );
    }

    if (charge.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: `Pagamento não confirmado: ${charge.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 },
      );
    }

    // 5) Persist cancellation with computed values
    const reason = `Cancelado pelo aluno fora da janela de ${cfg.free_cancel_window_hours}h. ` +
      `Taxa cobrada: R$ ${fee.toFixed(2)} (plataforma R$ ${platformShare.toFixed(2)} / ` +
      `professor R$ ${teacherShare.toFixed(2)}). PaymentIntent: ${charge.id}.`;

    const { error: upErr } = await sb
      .from("scheduled_lessons")
      .update({
        status: "cancelled_late",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq("id", lesson.id);
    if (upErr) log("Failed to update lesson", { upErr });

    return new Response(
      JSON.stringify({
        success: true,
        fee,
        platform_share: platformShare,
        teacher_share: teacherShare,
        payment_intent_id: charge.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});