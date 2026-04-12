import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ subscribed: false, error: "No authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } =
      await supabaseClient.auth.getUser(token);
    if (userError) {
      return new Response(
        JSON.stringify({ subscribed: false, error: "Session expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find Stripe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(
        JSON.stringify({ subscribed: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd: string | null = null;
    let priceId: string | null = null;
    let productId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      stripeSubscriptionId = subscription.id;
      subscriptionEnd = new Date(
        subscription.current_period_end * 1000
      ).toISOString();
      priceId = subscription.items.data[0].price.id;
      productId = subscription.items.data[0].price.product as string;
      logStep("Active subscription found", {
        subscriptionId: subscription.id,
        priceId,
        productId,
        endDate: subscriptionEnd,
      });

      // Sync to local DB: find matching plan and upsert student_subscriptions
      const { data: plans } = await supabaseClient
        .from("subscription_plans")
        .select("id, checkout_url")
        .eq("active", true);

      // Match plan by checking if its checkout_url contains the price_id or product
      // For simplicity, we'll pick the first active plan (admin can configure)
      let matchedPlanId: string | null = null;

      if (plans && plans.length > 0) {
        // Try to match by Stripe price to known plans
        // Map price IDs to plan IDs
        const PRICE_PLAN_MAP: Record<string, string> = {};
        // We'll do a simpler approach: check existing subscription in DB
        const { data: existingSub } = await supabaseClient
          .from("student_subscriptions")
          .select("id, plan_id")
          .eq("user_id", user.id)
          .eq("stripe_subscription_id", stripeSubscriptionId)
          .maybeSingle();

        if (existingSub) {
          // Update expiry
          await supabaseClient
            .from("student_subscriptions")
            .update({
              status: "active",
              expires_at: subscriptionEnd,
            })
            .eq("id", existingSub.id);
          matchedPlanId = existingSub.plan_id;
          logStep("Updated existing local subscription");
        } else {
          // Create new local subscription - use first plan as default
          matchedPlanId = plans[0].id;
          
          // Deactivate old subscriptions
          await supabaseClient
            .from("student_subscriptions")
            .update({ status: "expired" })
            .eq("user_id", user.id)
            .eq("status", "active");

          await supabaseClient
            .from("student_subscriptions")
            .insert({
              user_id: user.id,
              plan_id: matchedPlanId,
              status: "active",
              stripe_subscription_id: stripeSubscriptionId,
              expires_at: subscriptionEnd,
            });
          logStep("Created local subscription record");
        }
      }
    } else {
      logStep("No active subscription found");

      // Check if there were active subs that we're now expiring
      const { data: activeSubs } = await supabaseClient
        .from("student_subscriptions")
        .select("id, plan_id, expires_at, subscription_plans(name)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (activeSubs && activeSubs.length > 0) {
        // Mark as expired
        await supabaseClient
          .from("student_subscriptions")
          .update({ status: "expired" })
          .eq("user_id", user.id)
          .eq("status", "active");

        // Send cancellation email for the first expired sub
        const expiredSub = activeSubs[0];
        const planData = expiredSub.subscription_plans as any;
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("name, email")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.email) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

          await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              templateName: "subscription-cancelled",
              recipientEmail: profile.email,
              idempotencyKey: `sub-cancelled-${expiredSub.id}`,
              templateData: {
                name: profile.name || "Aluno(a)",
                planName: planData?.name || "Plano",
                expiryDate: expiredSub.expires_at
                  ? new Date(expiredSub.expires_at).toLocaleDateString("pt-BR")
                  : "",
                reason: "expirada",
                renewLink: "https://revisaofacil.com/#pricing",
              },
            }),
          });
          logStep("Sent subscription cancelled email", { email: profile.email });
        }
      } else {
        // No active subs to expire
        await supabaseClient
          .from("student_subscriptions")
          .update({ status: "expired" })
          .eq("user_id", user.id)
          .eq("status", "active");
      }
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        price_id: priceId,
        product_id: productId,
        subscription_end: subscriptionEnd,
        stripe_subscription_id: stripeSubscriptionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
