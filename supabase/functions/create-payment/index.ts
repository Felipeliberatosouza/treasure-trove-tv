import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[CREATE-PAYMENT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Não autenticado" }, 200);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAnon.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) return json({ ok: false, error: "Usuário sem e-mail válido" }, 200);

    const body = await req.json().catch(() => ({}));
    const contentId = String(body?.contentId || "").trim();
    const contentType = String(body?.contentType || "").trim();
    if (!contentId || !["lesson", "exam_solution"].includes(contentType)) {
      return json({ ok: false, error: "Conteúdo inválido" }, 200);
    }

    // Fetch content (lesson or exam_solution) to get price + title + teacher
    const table = contentType === "lesson" ? "lessons" : "exam_solutions";
    const { data: content, error: contentErr } = await supabaseAdmin
      .from(table)
      .select("id, title, price, teacher_id, published, admin_approved")
      .eq("id", contentId)
      .maybeSingle();
    if (contentErr || !content) return json({ ok: false, error: "Aula não encontrada" }, 200);
    if (!content.published || !content.admin_approved) {
      return json({ ok: false, error: "Aula indisponível para compra" }, 200);
    }

    // Fetch platform minimum price
    const { data: pricingSetting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "video_pricing")
      .maybeSingle();
    const pricing = (pricingSetting?.value as Record<string, number> | undefined) || {};
    const minPrice = Number(
      contentType === "lesson"
        ? pricing.default_lesson_price ?? 0
        : pricing.default_exam_solution_price ?? 0,
    ) || 0;

    const teacherPrice = Number(content.price) || 0;
    const finalPrice = Math.max(teacherPrice, minPrice);
    if (finalPrice <= 0) {
      return json({ ok: false, error: "Esta aula não está disponível para compra avulsa" }, 200);
    }

    // Block duplicate completed purchase
    const { data: existing } = await supabaseAdmin
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
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const amountCents = Math.round(finalPrice * 100);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: amountCents,
            product_data: {
              name: content.title,
              description: `Compra avulsa — ${contentType === "lesson" ? "Aula" : "Resolução de Prova"}`,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&content_id=${contentId}`,
      cancel_url: `${origin}/video/${contentId}`,
      metadata: {
        user_id: user.id,
        content_id: contentId,
        content_type: contentType,
        teacher_id: content.teacher_id ?? "",
      },
    });
    log("Checkout session created", { sessionId: session.id, amountCents });

    // Insert pending purchase record
    await supabaseAdmin.from("video_purchases").insert({
      user_id: user.id,
      content_id: contentId,
      content_type: contentType,
      amount: finalPrice,
      payment_status: "pending",
      stripe_payment_id: session.id,
    });

    return json({ ok: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return json({ ok: false, error: message }, 200);
  }
});
