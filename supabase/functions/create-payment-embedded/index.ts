import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-PAYMENT-EMBEDDED] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

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
 * Creates a one-off PaymentIntent for unit content purchase, with the
 * payment method already attached and confirmed off-session-ready.
 * The frontend confirms it via Stripe Elements (no Checkout redirect).
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
    const contentId = String(body?.contentId || "").trim();
    const contentType = String(body?.contentType || "").trim();
    const paymentMethodId = String(body?.paymentMethodId || "").trim();
    const billing = (body?.billing || {}) as BillingDetails;

    if (!contentId || !["lesson", "exam_solution"].includes(contentType)) {
      return json({ ok: false, error: "Conteúdo inválido" }, 200);
    }
    if (!paymentMethodId.startsWith("pm_")) {
      return json({ ok: false, error: "Cartão inválido" }, 200);
    }

    // Fetch content with price/title
    const table = contentType === "lesson" ? "lessons" : "exam_solutions";
    const { data: content, error: contentErr } = await sb
      .from(table)
      .select("id, title, price, teacher_id, published, admin_approved")
      .eq("id", contentId)
      .maybeSingle();
    if (contentErr || !content) return json({ ok: false, error: "Aula não encontrada" }, 200);
    if (!content.published || !content.admin_approved) {
      return json({ ok: false, error: "Aula indisponível para compra" }, 200);
    }

    // Min price
    const { data: pricingSetting } = await sb
      .from("platform_settings")
      .select("value")
      .eq("key", "video_pricing")
      .maybeSingle();
    const pricing = (pricingSetting?.value as Record<string, number> | undefined) || {};
    const minPrice =
      Number(
        contentType === "lesson"
          ? pricing.default_lesson_price ?? 0
          : pricing.default_exam_solution_price ?? 0
      ) || 0;

    const teacherPrice = Number(content.price) || 0;
    const finalPrice = Math.max(teacherPrice, minPrice);
    if (finalPrice <= 0) {
      return json({ ok: false, error: "Esta aula não está disponível para compra avulsa" }, 200);
    }

    // Block duplicates
    const { data: existing } = await sb
      .from("video_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .eq("payment_status", "completed")
      .limit(1);
    if (existing && existing.length > 0) {
      return json({ ok: false, error: "Você já comprou esta aula" }, 200);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resolve / create customer
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const created = await stripe.customers.create({ email: user.email! });
      customerId = created.id;
    }

    // Update billing on customer
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

    // Attach PM (idempotent)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already") && !msg.includes("attached")) throw e;
    }

    const amountCents = Math.round(finalPrice * 100);

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "brl",
      customer: customerId,
      payment_method: paymentMethodId,
      payment_method_types: ["card"],
      description: `Compra avulsa — ${content.title}`,
      metadata: {
        user_id: user.id,
        content_id: contentId,
        content_type: contentType,
        teacher_id: content.teacher_id ?? "",
        cpf: billing.cpf || "",
      },
    });

    // Insert pending purchase
    await sb.from("video_purchases").insert({
      user_id: user.id,
      content_id: contentId,
      content_type: contentType,
      amount: finalPrice,
      payment_status: "pending",
      stripe_payment_id: intent.id,
    });

    log("PaymentIntent created", { id: intent.id, status: intent.status, amountCents });

    return json({
      ok: true,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return json({ ok: false, error: msg }, 200);
  }
});
