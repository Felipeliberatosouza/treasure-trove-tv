import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { error: msg });
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${msg}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle subscription events
    if (
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.updated"
    ) {
      const subscription = event.data.object as Stripe.Subscription;

      // Only act on cancelled/expired subscriptions
      const isCancelled =
        event.type === "customer.subscription.deleted" ||
        (event.type === "customer.subscription.updated" &&
          (subscription.status === "canceled" ||
            subscription.status === "unpaid" ||
            subscription.status === "past_due"));

      if (!isCancelled) {
        logStep("Subscription update - not a cancellation, skipping", {
          status: subscription.status,
        });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const customerId = subscription.customer as string;
      logStep("Processing cancellation", {
        subscriptionId: subscription.id,
        customerId,
        status: subscription.status,
      });

      // Get customer email from Stripe
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted || !("email" in customer) || !customer.email) {
        logStep("Customer deleted or no email, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const customerEmail = customer.email;
      logStep("Customer email found", { email: customerEmail });

      // Find user by email in profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .eq("email", customerEmail)
        .maybeSingle();

      if (!profile) {
        logStep("No profile found for email", { email: customerEmail });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Update local subscription status (fetch full plan + cycle info for receipt)
      const { data: activeSubs } = await supabase
        .from("student_subscriptions")
        .select(
          "id, plan_id, started_at, expires_at, subscription_plans(name, price, min_usage_charge_pct)",
        )
        .eq("user_id", profile.user_id)
        .eq("status", "active");

      let planName = "Plano";
      let expiryDate = "";
      let receiptUrl: string | undefined;

      if (activeSubs && activeSubs.length > 0) {
        const sub = activeSubs[0];
        const planData = sub.subscription_plans as {
          name?: string;
          price?: number;
          min_usage_charge_pct?: number;
        } | null;
        planName = planData?.name || "Plano";
        expiryDate = sub.expires_at
          ? new Date(sub.expires_at).toLocaleDateString("pt-BR")
          : new Date().toLocaleDateString("pt-BR");

        // Mark all active subs as expired/cancelled
        await supabase
          .from("student_subscriptions")
          .update({ status: "expired" })
          .eq("user_id", profile.user_id)
          .eq("status", "active");

        logStep("Local subscriptions marked as expired");

        // Build cancellation receipt PDF (best-effort).
        try {
          const startDate = new Date(sub.started_at);
          const now = new Date();
          const totalDays = 30;
          const cycleStart = new Date(startDate);
          while (cycleStart.getTime() + totalDays * 86400000 < now.getTime()) {
            cycleStart.setDate(cycleStart.getDate() + totalDays);
          }
          const daysUsed = Math.max(
            0,
            Math.min(
              totalDays,
              Math.floor((now.getTime() - cycleStart.getTime()) / 86400000),
            ),
          );

          const recRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-cancellation-receipt`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                userId: profile.user_id,
                studentName: profile.name || "",
                studentEmail: profile.email,
                planName,
                planPrice: Number(planData?.price ?? 0),
                totalDays,
                daysUsed,
                minUsageChargePct: Number(planData?.min_usage_charge_pct ?? 0),
                effectiveDate: new Date().toLocaleDateString("pt-BR"),
              }),
            },
          );
          if (recRes.ok) {
            const recJson = (await recRes.json()) as { url?: string };
            receiptUrl = recJson.url;
            logStep("Cancellation receipt generated", { hasUrl: !!receiptUrl });
          } else {
            logStep("Receipt generation failed", { status: recRes.status });
          }
        } catch (e) {
          logStep("Receipt generation error", {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      // Determine reason
      const reason =
        event.type === "customer.subscription.deleted"
          ? "cancelada"
          : subscription.status === "unpaid" || subscription.status === "past_due"
            ? "suspensa por falta de pagamento"
            : "cancelada";

      // Send cancellation email
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

      const emailRes = await fetch(
        `${supabaseUrl}/functions/v1/send-transactional-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            templateName: "subscription-cancelled",
            recipientEmail: profile.email,
            idempotencyKey: `stripe-webhook-cancel-${subscription.id}-${event.id}`,
            templateData: {
              name: profile.name || "Aluno(a)",
              planName,
              expiryDate,
              reason,
              renewLink: "https://revisaofacil.com/#pricing",
              receiptUrl,
            },
          }),
        }
      );

      const emailBody = await emailRes.text();
      logStep("Cancellation email sent", {
        email: profile.email,
        status: emailRes.status,
        reason,
      });
    } else if (event.type === "invoice.payment_failed") {
      // Handle payment failure - notify user
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && "email" in customer && customer.email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, name, email")
          .eq("email", customer.email)
          .maybeSingle();

        if (profile) {
          logStep("Payment failed for user", { email: profile.email });
          // Could add a payment-failed email template here in the future
        }
      }
    } else {
      logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
