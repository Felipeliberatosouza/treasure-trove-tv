import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[VERIFY-PAYMENT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
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
    if (!user) return json({ ok: false, error: "Usuário inválido" }, 200);

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "").trim();
    if (!sessionId.startsWith("cs_")) {
      return json({ ok: false, error: "session_id inválido" }, 200);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    log("Session retrieved", { id: session.id, payment_status: session.payment_status });

    // Find the matching pending purchase belonging to this user
    const { data: purchase } = await supabaseAdmin
      .from("video_purchases")
      .select("id, user_id, payment_status, amount")
      .eq("stripe_payment_id", sessionId)
      .maybeSingle();

    if (!purchase) return json({ ok: false, error: "Compra não encontrada" }, 200);
    if (purchase.user_id !== user.id) return json({ ok: false, error: "Não autorizado" }, 200);

    if (session.payment_status === "paid" && purchase.payment_status !== "completed") {
      await supabaseAdmin
        .from("video_purchases")
        .update({ payment_status: "completed" })
        .eq("id", purchase.id);
      log("Purchase marked completed", { purchaseId: purchase.id });

      // Credit cashback (purchase + referral, best-effort)
      try {
        const purchaseAmount = Number(
          purchase.amount ?? (session.amount_total ? session.amount_total / 100 : 0),
        );
        if (purchaseAmount > 0) {
          const { data: cb, error: cbErr } = await supabaseAdmin.rpc(
            "credit_cashback_purchase",
            {
              _user_id: user.id,
              _purchase_amount: purchaseAmount,
              _source_type: "video_purchase",
              _source_reference: sessionId,
            },
          );
          log("Cashback purchase credited", { tx: cb, err: cbErr?.message });

          const { data: ref, error: refErr } = await supabaseAdmin.rpc(
            "credit_cashback_referral",
            {
              _referred_user_id: user.id,
              _purchase_amount: purchaseAmount,
              _source_reference: sessionId,
            },
          );
          log("Cashback referral credited", { tx: ref, err: refErr?.message });
        }
      } catch (e) {
        log("Cashback credit error", { error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({
      ok: true,
      paid: session.payment_status === "paid",
      contentId: (session.metadata as Record<string, string> | null)?.content_id ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("ERROR", { message });
    return json({ ok: false, error: message }, 200);
  }
});
