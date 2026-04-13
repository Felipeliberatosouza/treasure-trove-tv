import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user from JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "Code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Hash the provided code the same way we stored it
    const encoder = new TextEncoder();
    const data = encoder.encode(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const codeHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Find matching unused code
    const { data: codes, error: fetchError } = await adminClient
      .from("mfa_recovery_codes")
      .select("id")
      .eq("user_id", user.id)
      .eq("code_hash", codeHash)
      .eq("used", false)
      .limit(1);

    if (fetchError || !codes || codes.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid recovery code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark code as used
    await adminClient
      .from("mfa_recovery_codes")
      .update({ used: true })
      .eq("id", codes[0].id);

    // Unenroll all TOTP factors using admin API
    const { data: factorsData } = await adminClient.auth.admin.mfa.listFactors({
      userId: user.id,
    });

    if (factorsData?.factors) {
      for (const factor of factorsData.factors) {
        if (factor.factor_type === "totp" && factor.status === "verified") {
          await adminClient.auth.admin.mfa.deleteFactor({
            userId: user.id,
            factorId: factor.id,
          });
        }
      }
    }

    // Log the recovery
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      action: "mfa_recovery_used",
      metadata: { recovery_code_id: codes[0].id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
