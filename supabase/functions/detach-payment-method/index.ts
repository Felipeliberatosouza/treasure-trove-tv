import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[DETACH-PAYMENT-METHOD] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

/**
 * Detaches a single saved card from the authenticated user's customer record.
 *
 * Body: { paymentMethodId: string }
 *
 * Safety checks:
 *  - The PM must be attached to the customer that matches the auth user's email.
 *  - The PM must NOT be the customer's default invoice PM.
 *  - The PM must NOT be the active subscription's default PM.
 * These prevent the user from removing the card that's about to be charged.
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
    const paymentMethodId: string | undefined = body?.paymentMethodId;
    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "paymentMethodId é obrigatório" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resolve customer for this user
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Cliente não encontrado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    const customer = customers.data[0];

    // Verify ownership
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== customer.id) {
      return new Response(
        JSON.stringify({ ok: false, error: "Cartão não pertence a este usuário." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Block removal of default card
    const defaultPm =
      (customer.invoice_settings?.default_payment_method as string | null) || null;
    if (defaultPm === paymentMethodId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Não é possível remover o cartão padrão. Defina outro como padrão primeiro.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Block removal of any active subscription's default card
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 5,
    });
    const inUse = subs.data.some(
      (s) => (s.default_payment_method as string | null) === paymentMethodId
    );
    if (inUse) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Este cartão está vinculado a uma assinatura ativa e não pode ser removido.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    log("detached", { id: paymentMethodId });

    return new Response(
      JSON.stringify({ ok: true }),
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
