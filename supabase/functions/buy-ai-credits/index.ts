import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[BUY-AI-CREDITS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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
    if (!stripeKey) return json({ ok: false, error: "Pagamentos indisponíveis no momento." });

    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Não autenticado" });
    const { data: userData } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = userData.user;
    if (!user?.email) return json({ ok: false, error: "Usuário sem e-mail válido" });

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "verify" ? "verify" : "checkout";
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    if (action === "checkout") {
      const packageId = String(body?.packageId || "").trim();
      const { data: pkg } = await admin
        .from("ai_credit_packages")
        .select("id, name, credits, price, active")
        .eq("id", packageId)
        .maybeSingle();
      if (!pkg || !pkg.active) return json({ ok: false, error: "Pacote de Créditos de IA indisponível." });
      const price = Number(pkg.price) || 0;
      const credits = Number(pkg.credits) || 0;
      if (price <= 0 || credits <= 0) {
        return json({ ok: false, error: "Pacote de Créditos de IA sem preço ou quantidade válida." });
      }

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const origin = req.headers.get("origin") || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        customer: customers.data[0]?.id,
        customer_email: customers.data[0]?.id ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: Math.round(price * 100),
              product_data: {
                name: `${pkg.name} — ${credits} Créditos de IA`,
                description: "Compra de Créditos de IA",
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&ai_credits=1`,
        cancel_url: `${origin}/creditos-ia`,
        metadata: { user_id: user.id, package_id: pkg.id, credits: String(credits) },
      });

      await admin.from("ai_credit_purchases").insert({
        user_id: user.id,
        package_id: pkg.id,
        package_name: pkg.name,
        credits,
        amount: price,
        payment_status: "pending",
        stripe_payment_id: session.id,
      });

      log("Checkout criado", { sessionId: session.id, credits });
      return json({ ok: true, url: session.url });
    }

    // --- verify ---
    const sessionId = String(body?.sessionId || "").trim();
    if (!sessionId.startsWith("cs_")) return json({ ok: false, error: "session_id inválido" });

    const { data: purchase } = await admin
      .from("ai_credit_purchases")
      .select("id, user_id, credits, amount, payment_status")
      .eq("stripe_payment_id", sessionId)
      .maybeSingle();
    if (!purchase) return json({ ok: false, error: "Compra não encontrada" });
    if (purchase.user_id !== user.id) return json({ ok: false, error: "Não autorizado" });
    if (purchase.payment_status === "completed") {
      return json({ ok: true, paid: true, credits: purchase.credits });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return json({ ok: true, paid: false });
    }

    await admin
      .from("ai_credit_purchases")
      .update({ payment_status: "completed" })
      .eq("id", purchase.id);

    await admin.rpc("add_ai_credits", {
      _user_id: user.id,
      _amount: purchase.credits,
      _reason: "purchase",
    });

    try {
      const amount = Number(purchase.amount) || 0;
      if (amount > 0) {
        await admin.rpc("credit_cashback_purchase", {
          _user_id: user.id,
          _purchase_amount: amount,
          _source_type: "ai_credits",
          _source_reference: sessionId,
        });
        await admin.rpc("credit_cashback_referral", {
          _referred_user_id: user.id,
          _purchase_amount: amount,
          _source_reference: sessionId,
        });
      }
    } catch (e) {
      log("Cashback error", { error: e instanceof Error ? e.message : String(e) });
    }

    log("Créditos de IA creditados", { credits: purchase.credits });
    return json({ ok: true, paid: true, credits: purchase.credits });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return json({ ok: false, error: message });
  }
});
