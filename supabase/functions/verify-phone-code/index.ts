import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const respond = (payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: jsonHeaders,
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return respond({ ok: false, error: "Telefone e código são obrigatórios" });
    }

    const digits = phone.replace(/\D/g, "");
    const e164Phone = `+55${digits}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: verification } = await supabase
      .from("phone_verifications")
      .select("*")
      .eq("phone", e164Phone)
      .eq("verified", false)
      .eq("invalidated", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!verification) {
      return respond({ ok: false, error: "Código inválido ou expirado" });
    }

    // Brute-force protection: cap at 5 attempts per code, then invalidate.
    if ((verification.failed_attempts ?? 0) >= 5) {
      await supabase
        .from("phone_verifications")
        .update({ invalidated: true })
        .eq("id", verification.id);
      return respond({ ok: false, error: "Muitas tentativas. Solicite um novo código." });
    }

    if (verification.code !== code) {
      const next = (verification.failed_attempts ?? 0) + 1;
      await supabase
        .from("phone_verifications")
        .update({
          failed_attempts: next,
          invalidated: next >= 5,
        })
        .eq("id", verification.id);
      return respond({ ok: false, error: "Código inválido ou expirado" });
    }

    await supabase
      .from("phone_verifications")
      .update({ verified: true })
      .eq("id", verification.id);

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await supabase
          .from("profiles")
          .update({ phone_verified: true, phone: digits })
          .eq("user_id", user.id);
      }
    }

    return respond({ ok: true, success: true, verified: true });
  } catch (error) {
    console.error("verify-phone-code error:", error);
    return respond({ ok: false, error: "Erro interno" });
  }
});
