import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    // Check if user wants to query cancellation eligibility only
    let actionQuery = "portal";
    try {
      const body = await req.json();
      if (body?.action) actionQuery = body.action;
    } catch {
      // No body or invalid JSON — default to portal
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Get active subscription from local DB to check plan commitment rules
    const { data: subData } = await supabaseClient
      .from("student_subscriptions")
      .select("id, started_at, plan_id, subscription_plans(allow_free_cancel, min_commitment_days)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let canCancelFreely = true;
    let daysRemaining = 0;
    let minDays = 0;

    if (subData?.subscription_plans) {
      const plan = subData.subscription_plans as any;
      const allowFree = plan.allow_free_cancel ?? true;
      minDays = plan.min_commitment_days ?? 0;

      if (!allowFree && minDays > 0) {
        const startedAt = new Date(subData.started_at);
        const now = new Date();
        const daysSinceStart = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
        daysRemaining = Math.max(0, minDays - daysSinceStart);
        canCancelFreely = daysSinceStart >= minDays;
        logStep("Commitment check", { daysSinceStart, minDays, canCancelFreely, daysRemaining });
      }
    }

    // If action is just checking eligibility, return info without opening portal
    if (actionQuery === "check") {
      return new Response(JSON.stringify({
        can_cancel_freely: canCancelFreely,
        days_remaining: daysRemaining,
        min_commitment_days: minDays,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Open portal session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/student`,
    });
    logStep("Portal session created", { url: portalSession.url });

    return new Response(JSON.stringify({
      url: portalSession.url,
      can_cancel_freely: canCancelFreely,
      days_remaining: daysRemaining,
      min_commitment_days: minDays,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
