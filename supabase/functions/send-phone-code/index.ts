import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, channel = "sms" } = await req.json();

    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ error: "Número de telefone é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["sms", "whatsapp"].includes(channel)) {
      return new Response(JSON.stringify({ error: "Canal inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format phone to E.164
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) {
      return new Response(JSON.stringify({ error: "Telefone inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const e164Phone = `+55${digits}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: max 3 codes per phone per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("phone_verifications")
      .select("*", { count: "exact", head: true })
      .eq("phone", e164Phone)
      .gte("created_at", tenMinutesAgo);

    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Get Twilio from number from platform settings
    const { data: settingsData } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "twilio_config")
      .single();

    const twilioConfig = settingsData?.value as Record<string, string> | null;
    const smsFrom = twilioConfig?.sms_from_number;
    const whatsappFrom = twilioConfig?.whatsapp_from_number;

    if (channel === "sms" && !smsFrom) {
      return new Response(JSON.stringify({ error: "Número de SMS não configurado. Contate o administrador." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "whatsapp" && !whatsappFrom) {
      return new Response(JSON.stringify({ error: "WhatsApp não configurado. Contate o administrador." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromNumber = channel === "whatsapp" ? `whatsapp:${whatsappFrom}` : smsFrom;
    const toNumber = channel === "whatsapp" ? `whatsapp:${e164Phone}` : e164Phone;

    // Send via Twilio gateway
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

    const twilioData = await twilioResp.json();
    if (!twilioResp.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      return new Response(JSON.stringify({ error: "Erro ao enviar código. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally get user_id from auth header
    let userId = "00000000-0000-0000-0000-000000000000";
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Store verification record
    await supabase.from("phone_verifications").insert({
      user_id: userId,
      phone: e164Phone,
      code,
      channel,
      verified: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify({ success: true, message: "Código enviado!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-phone-code error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
