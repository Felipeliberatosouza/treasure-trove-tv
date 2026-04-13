import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

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
    const { phone, channel = "sms" } = await req.json();

    if (!phone || typeof phone !== "string") {
      return respond({ ok: false, error: "Número de telefone é obrigatório" });
    }

    if (!["sms", "whatsapp"].includes(channel)) {
      return respond({ ok: false, error: "Canal inválido" });
    }

    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) {
      return respond({ ok: false, error: "Telefone inválido" });
    }
    const e164Phone = `+55${digits}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("phone_verifications")
      .select("*", { count: "exact", head: true })
      .eq("phone", e164Phone)
      .gte("created_at", tenMinutesAgo);

    if ((count ?? 0) >= 3) {
      return respond({
        ok: false,
        error: "Muitas tentativas. Aguarde alguns minutos.",
        diagnostics: { rateLimit: true },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    const { data: settingsData } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "twilio_config")
      .single();

    const twilioConfig = settingsData?.value as Record<string, string> | null;
    const smsFrom = twilioConfig?.sms_from_number;
    const whatsappFrom = twilioConfig?.whatsapp_from_number;

    if (channel === "sms" && !smsFrom) {
      return respond({ ok: false, error: "Número de SMS não configurado. Contate o administrador." });
    }

    if (channel === "whatsapp" && !whatsappFrom) {
      return respond({ ok: false, error: "WhatsApp não configurado. Contate o administrador." });
    }

    const fromNumber = channel === "whatsapp" ? `whatsapp:${whatsappFrom}` : smsFrom;
    const toNumber = channel === "whatsapp" ? `whatsapp:${e164Phone}` : e164Phone;

    const twilioResp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: toNumber,
        From: fromNumber!,
        Body: `Revisão Fácil: Seu código de verificação é ${code}. Válido por 10 minutos.`,
      }),
    });

    const twilioData = await twilioResp.json().catch(() => null);
    if (!twilioResp.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      return respond({ ok: false, error: "Erro ao enviar código. Tente novamente." });
    }

    let userId = "00000000-0000-0000-0000-000000000000";
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    await supabase.from("phone_verifications").insert({
      user_id: userId,
      phone: e164Phone,
      code,
      channel,
      verified: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return respond({ ok: true, success: true, message: "Código enviado!" });
  } catch (error) {
    console.error("send-phone-code error:", error);
    return respond({ ok: false, error: "Erro interno" });
  }
});
