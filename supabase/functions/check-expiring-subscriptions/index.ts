import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-EXPIRING-SUBS] ${step}${d}`);
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
    logStep("Function started");

    // Require cron-secret header (compared against platform_settings.cron_secret)
    const cronHeader = req.headers.get("x-cron-secret") || "";
    const { data: secretRow } = await supabase
      .from("platform_settings").select("value").eq("key", "cron_secret").maybeSingle();
    const expected = (secretRow?.value as any)?.token || "";
    if (!expected || cronHeader !== expected) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const reminderDays = [7, 3, 1]; // Send reminders 7, 3, and 1 day(s) before expiry

    let totalSent = 0;

    for (const days of reminderDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      logStep(`Checking subscriptions expiring in ${days} day(s)`, {
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
      });

      // Find active subscriptions expiring on that day
      const { data: subs, error: subsError } = await supabase
        .from("student_subscriptions")
        .select("id, user_id, plan_id, expires_at, subscription_plans(name, price)")
        .eq("status", "active")
        .gte("expires_at", startOfDay.toISOString())
        .lte("expires_at", endOfDay.toISOString());

      if (subsError) {
        logStep(`Error fetching subscriptions for ${days}d`, { error: subsError.message });
        continue;
      }

      if (!subs || subs.length === 0) {
        logStep(`No subscriptions expiring in ${days} day(s)`);
        continue;
      }

      logStep(`Found ${subs.length} subscription(s) expiring in ${days} day(s)`);

      for (const sub of subs) {
        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, email")
          .eq("user_id", sub.user_id)
          .maybeSingle();

        if (!profile?.email) {
          logStep("Skipping - no profile/email", { userId: sub.user_id });
          continue;
        }

        const planData = sub.subscription_plans as any;
        const planName = planData?.name || "Plano";
        const expiryDate = sub.expires_at
          ? new Date(sub.expires_at).toLocaleDateString("pt-BR")
          : "—";

        // Check if we already sent a reminder for this subscription + day combo today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const { data: alreadySent } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("template_name", "subscription-expiring")
          .eq("recipient_email", profile.email)
          .gte("created_at", todayStart.toISOString())
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          logStep("Already sent reminder today", { email: profile.email });
          continue;
        }

        // Send transactional email
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-app-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            templateName: "subscription-expiring",
            recipientEmail: profile.email,
            templateData: {
              name: profile.name || "Aluno(a)",
              plan_name: planName,
              days_remaining: String(days),
              expiry_date: expiryDate,
              subscription_status: "active",
              renew_link: "https://revisaofacil.com.br/dashboard/student",
            },
          }),
        });

        const emailBody = await emailRes.text();
        logStep(`Email sent to ${profile.email}`, {
          status: emailRes.status,
          days,
        });

        totalSent++;
      }
    }

    logStep("Finished", { totalSent });

    return new Response(
      JSON.stringify({ success: true, totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
