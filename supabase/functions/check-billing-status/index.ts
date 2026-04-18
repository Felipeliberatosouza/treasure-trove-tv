// Reports the current billing health for the logged-in student so the dashboard
// can display a "past due" alert when the latest charge failed.
//
// Returns:
//   { ok: true, pastDue: boolean, status: string|null,
//     amountDue: number|null, hostedInvoiceUrl: string|null, attemptCount: number|null }
//
// We treat a subscription as "past_due" if Stripe reports any of:
//   - status === "past_due"
//   - status === "unpaid"
//   - status === "incomplete" with a failed latest_invoice
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[check-billing-status] ${s}${d ? " - " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ ok: true, pastDue: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const { data: udata, error: uerr } = await sb.auth.getUser(token);
    if (uerr || !udata.user?.email) {
      return new Response(JSON.stringify({ ok: true, pastDue: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const user = udata.user;

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ ok: true, pastDue: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

    // Look at all non-active statuses that indicate billing trouble
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    const trouble = subs.data.find(
      (s) => s.status === "past_due" || s.status === "unpaid" || s.status === "incomplete",
    );

    if (!trouble) {
      log("no billing trouble", { count: subs.data.length });
      return new Response(JSON.stringify({ ok: true, pastDue: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let amountDue: number | null = null;
    let hostedInvoiceUrl: string | null = null;
    let attemptCount: number | null = null;

    // Pull the latest invoice for context (amount, hosted URL, attempt count)
    const latestInvoiceId =
      typeof trouble.latest_invoice === "string"
        ? trouble.latest_invoice
        : trouble.latest_invoice?.id ?? null;
    if (latestInvoiceId) {
      try {
        const inv = await stripe.invoices.retrieve(latestInvoiceId);
        amountDue = typeof inv.amount_due === "number" ? inv.amount_due / 100 : null;
        hostedInvoiceUrl = inv.hosted_invoice_url ?? null;
        attemptCount = inv.attempt_count ?? null;
      } catch (e) {
        log("invoice retrieve failed", { e: String(e) });
      }
    }

    log("billing trouble detected", {
      status: trouble.status,
      amountDue,
      attemptCount,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        pastDue: true,
        status: trouble.status,
        amountDue,
        hostedInvoiceUrl,
        attemptCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    // 200 OK so a transient Stripe error never breaks the dashboard.
    return new Response(JSON.stringify({ ok: false, pastDue: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
