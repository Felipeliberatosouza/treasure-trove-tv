import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CREATE-SETUP-INTENT] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

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
    let customerId: string;
    if (customers.data.length === 0) {
      const created = await stripe.customers.create({ email: user.email! });
      customerId = created.id;
    } else {
      customerId = customers.data[0].id;
    }

    // List saved cards
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPmId =
      typeof customer !== "string" && !customer.deleted
        ? (customer.invoice_settings?.default_payment_method as string | null) ?? null
        : null;
    const savedCards = pms.data.map((p) => ({
      id: p.id,
      brand: p.card?.brand,
      last4: p.card?.last4,
      exp_month: p.card?.exp_month,
      exp_year: p.card?.exp_year,
      isDefault: p.id === defaultPmId,
    }));

    // Create SetupIntent for new card collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    log("Created", { customerId, savedCount: savedCards.length });

    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        customerId,
        savedCards,
        defaultPaymentMethodId: defaultPmId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
