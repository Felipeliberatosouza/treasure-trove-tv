import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const DEFAULT_GRANTS: Record<string, number> = {
  revisao: 1,
  resumo: 1,
  simulado: 1,
  top_questoes: 1,
  colinha: 1,
  duvida: 0,
  aula_particular: 0,
  ai_credits: 1,
};

const CONTENT_KEYS = ["revisao", "resumo", "simulado", "top_questoes", "colinha", "duvida", "aula_particular"];

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function makeToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    const { data: cfgRow } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "cashback_program")
      .maybeSingle();
    const cfg = (cfgRow?.value ?? {}) as Record<string, unknown>;
    const accessEnabled = cfg.referral_access_enabled !== false;
    const grants = { ...DEFAULT_GRANTS, ...((cfg.referral_access_grants as Record<string, number>) ?? {}) };
    const maxRewards = Number(cfg.referral_access_max_rewards ?? 0);

    /* ---------------- CLAIM (público) ---------------- */
    if (action === "claim") {
      const token = String(body?.token ?? "").trim().toUpperCase();
      if (!token) return respond({ ok: false, error: "Convite inválido." });

      const { data: invite } = await admin
        .from("referral_invites")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (!invite) return respond({ ok: false, error: "Convite não encontrado." });

      const { data: account } = await admin
        .from("cashback_accounts")
        .select("referral_code")
        .eq("user_id", invite.referrer_user_id)
        .maybeSingle();
      const referralCode = account?.referral_code ?? null;

      if (invite.status === "rewarded" || invite.rewarded_at) {
        return respond({ ok: true, alreadyClaimed: true, referralCode });
      }
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        await admin.from("referral_invites").update({ status: "expired" }).eq("id", invite.id);
        return respond({ ok: true, expired: true, referralCode });
      }

      // marca visita
      await admin
        .from("referral_invites")
        .update({ status: "visited", visited_at: new Date().toISOString() })
        .eq("id", invite.id);

      if (!accessEnabled) return respond({ ok: true, rewarded: false, referralCode });

      // limite de indicações premiadas
      if (maxRewards > 0) {
        const { count } = await admin
          .from("referral_invites")
          .select("id", { count: "exact", head: true })
          .eq("referrer_user_id", invite.referrer_user_id)
          .eq("status", "rewarded");
        if ((count ?? 0) >= maxRewards) {
          return respond({ ok: true, rewarded: false, limitReached: true, referralCode });
        }
      }

      // credita acessos por conteúdo
      for (const key of CONTENT_KEYS) {
        const qty = Number(grants[key] ?? 0);
        if (qty <= 0) continue;
        const { data: existing } = await admin
          .from("referral_content_credits")
          .select("id, granted")
          .eq("user_id", invite.referrer_user_id)
          .eq("resource_type", key)
          .maybeSingle();
        if (existing) {
          await admin
            .from("referral_content_credits")
            .update({ granted: existing.granted + qty })
            .eq("id", existing.id);
        } else {
          await admin
            .from("referral_content_credits")
            .insert({ user_id: invite.referrer_user_id, resource_type: key, granted: qty });
        }
      }

      // créditos de IA
      const aiQty = Number(grants.ai_credits ?? 0);
      if (aiQty > 0) {
        const { data: credits } = await admin
          .from("ai_revision_credits")
          .select("user_id, balance")
          .eq("user_id", invite.referrer_user_id)
          .maybeSingle();
        const newBalance = (credits?.balance ?? 0) + aiQty;
        if (credits) {
          await admin
            .from("ai_revision_credits")
            .update({ balance: newBalance })
            .eq("user_id", invite.referrer_user_id);
        } else {
          await admin
            .from("ai_revision_credits")
            .insert({ user_id: invite.referrer_user_id, balance: newBalance, signup_granted: false });
        }
        await admin.from("ai_revision_credit_ledger").insert({
          user_id: invite.referrer_user_id,
          delta: aiQty,
          reason: "referral_access",
          balance_after: newBalance,
        });
      }

      await admin
        .from("referral_invites")
        .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
        .eq("id", invite.id);

      return respond({ ok: true, rewarded: true, referralCode });
    }

    /* ---------------- SEND / RESEND (autenticado) ---------------- */
    if (action !== "send" && action !== "resend") return respond({ ok: false, error: "Ação inválida." }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return respond({ ok: false, error: "Faça login para enviar convites." }, 401);
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return respond({ ok: false, error: "Sessão expirada. Entre novamente." }, 401);

    const channel = String(body?.channel ?? "email");
    if (!["email", "whatsapp", "sms", "link"].includes(channel)) {
      return respond({ ok: false, error: "Canal inválido." });
    }
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phoneDigits = String(body?.phone ?? "").replace(/\D/g, "");
    const origin = String(body?.origin ?? "https://revisaofacil.com.br").replace(/\/$/, "");

    if (channel === "email" && !isEmail(email)) return respond({ ok: false, error: "Informe um e-mail válido." });
    if ((channel === "whatsapp" || channel === "sms") && phoneDigits.length !== 11) {
      return respond({ ok: false, error: "Informe um celular válido com DDD." });
    }

    let token: string;
    if (action === "resend") {
      const inviteId = String(body?.inviteId ?? "");
      const { data: existing } = await admin
        .from("referral_invites")
        .select("id, token, referrer_user_id, status")
        .eq("id", inviteId)
        .maybeSingle();
      if (!existing || existing.referrer_user_id !== userId) {
        return respond({ ok: false, error: "Convite não encontrado." });
      }
      if (existing.status === "rewarded") {
        return respond({ ok: false, error: "Este convite já foi usado pelo seu amigo." });
      }
      token = existing.token;
      const { error: updError } = await admin
        .from("referral_invites")
        .update({
          channel,
          contact_email: email || null,
          contact_phone: phoneDigits || null,
          status: "sent",
          sent_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        })
        .eq("id", existing.id);
      if (updError) throw updError;
    } else {
      token = makeToken();
      const { error: insertError } = await admin.from("referral_invites").insert({
        referrer_user_id: userId,
        channel,
        contact_email: email || null,
        contact_phone: phoneDigits || null,
        token,
      });
      if (insertError) throw insertError;
    }

    const inviteLink = `${origin}/convite/${token}`;

    const { data: profile } = await admin
      .from("profiles")
      .select("name")
      .eq("user_id", userId)
      .maybeSingle();
    const referrerName = profile?.name ?? "";

    const { data: brandingRow } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "branding")
      .maybeSingle();
    const platformName =
      ((brandingRow?.value as Record<string, string>)?.platform_name) || "Revisão Fácil";

    const template =
      (typeof cfg.referral_invite_message === "string" && cfg.referral_invite_message.trim()) ||
      "{nome} te convidou para estudar na {plataforma}! Revisões, resumos, simulados, colinhas e aulas com professores em um só lugar. Acesse pelo link: {link}";

    const message = template
      .replaceAll("{nome}", referrerName || "Um amigo")
      .replaceAll("{plataforma}", platformName)
      .replaceAll("{link}", inviteLink);

    if (channel === "link") {
      return respond({ ok: true, token, inviteLink, message });
    }

    if (channel === "email") {
      const { error } = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "cashback-referral-share",
          recipientEmail: email,
          idempotencyKey: `referral-invite-${token}`,
          templateData: {
            name: referrerName,
            referral_code: token,
            referral_link: inviteLink,
            share_text: message,
            referralCode: token,
            referralLink: inviteLink,
            shareText: message,
          },
        },
      });
      if (error) {
        console.error("email invite failed", error);
        return respond({ ok: false, error: "Não foi possível enviar o e-mail agora." });
      }
      return respond({ ok: true, token, inviteLink, message });
    }

    // whatsapp / sms via Twilio
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return respond({ ok: false, error: "Envio por celular não configurado. Contate o administrador.", inviteLink });
    }

    const { data: twilioRow } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "twilio_config")
      .maybeSingle();
    const twilioConfig = (twilioRow?.value ?? {}) as Record<string, string>;
    const from = channel === "whatsapp" ? twilioConfig.whatsapp_from_number : twilioConfig.sms_from_number;
    if (!from) {
      return respond({ ok: false, error: "Número de envio não configurado. Contate o administrador.", inviteLink });
    }

    const e164 = `+55${phoneDigits}`;
    const twilioResp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: channel === "whatsapp" ? `whatsapp:${e164}` : e164,
        From: channel === "whatsapp" ? `whatsapp:${from}` : from,
        Body: message,
      }),
    });

    if (!twilioResp.ok) {
      const details = await twilioResp.text();
      console.error(`twilio invite failed [${twilioResp.status}]: ${details}`);
      return respond({ ok: false, error: "Não foi possível enviar a mensagem agora.", inviteLink });
    }

    return respond({ ok: true, token, inviteLink, message });
  } catch (e) {
    console.error("referral-invite error", e);
    return respond({ ok: false, error: "Erro inesperado ao processar o convite." });
  }
});
