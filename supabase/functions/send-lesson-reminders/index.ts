import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

/** Window tolerance: the cron fires every 5 min, so we consider a lesson
 *  "eligible" for a reminder when the gap between now and its start is within
 *  [hours * 3600s, hours * 3600s + TOLERANCE]. TOLERANCE = 6 minutes to cover
 *  cron drift without re-firing (idempotency is also enforced by the unique
 *  index on scheduled_lesson_reminders). */
const TOLERANCE_MS = 6 * 60 * 1000;

type Recipient = {
  lessonId: string;
  lessonTitle: string;
  scheduledAt: string;
  recipientType: "student" | "teacher";
  userId: string;
  name: string;
  phone: string | null;
  reminderHours: number;
};

const BR_PHONE_RE = /^\+?55?\s*\D*(\d{10,11})$/;

/** Normalises a stored phone into E.164 Brazilian format (+55DDDNNNNNNNNN). */
const toE164BR = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  const m = String(raw).match(BR_PHONE_RE);
  if (m) return `+55${m[1]}`;
  return null;
};

const formatBR = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const time = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} às ${time}`;
};

const buildMessage = (r: Recipient) => {
  const when = formatBR(r.scheduledAt);
  if (r.recipientType === "student") {
    return `Revisão Fácil: Olá, ${r.name.split(" ")[0]}! Lembrete: sua aula particular "${r.lessonTitle}" começa em ${r.reminderHours}h (${when}). Acesse: https://revisaofacil.com.br/minhas-aulas-agendadas`;
  }
  return `Revisão Fácil: Olá, Prof. ${r.name.split(" ")[0]}! Lembrete: sua aula "${r.lessonTitle}" com o aluno começa em ${r.reminderHours}h (${when}).`;
};

type SendOutcome = {
  ok: boolean;
  channel: "whatsapp" | "sms";
  sid?: string;
  error?: string;
};

/** Sends via WhatsApp first; on Twilio failure falls back to SMS. */
const sendWithFallback = async (
  phoneE164: string,
  body: string,
  smsFrom: string | null,
  whatsappFrom: string | null,
  lovableKey: string,
  twilioKey: string,
): Promise<SendOutcome> => {
  const tryChannel = async (channel: "whatsapp" | "sms"): Promise<SendOutcome> => {
    const from = channel === "whatsapp" ? whatsappFrom : smsFrom;
    if (!from) return { ok: false, channel, error: `${channel}_from_not_configured` };
    const to = channel === "whatsapp" ? `whatsapp:${phoneE164}` : phoneE164;
    const fromNumber = channel === "whatsapp" ? `whatsapp:${from}` : from;
    const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      return {
        ok: false,
        channel,
        error: `twilio_${resp.status}: ${JSON.stringify(data)?.slice(0, 400)}`,
      };
    }
    return { ok: true, channel, sid: (data as { sid?: string })?.sid };
  };

  // WhatsApp first
  const wa = await tryChannel("whatsapp");
  if (wa.ok) return wa;
  // Fallback to SMS
  const sms = await tryChannel("sms");
  if (sms.ok) return sms;
  // Both failed: surface SMS error (more likely to be the actionable one)
  return { ok: false, channel: "sms", error: `wa=${wa.error} | sms=${sms.error}` };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      console.error("Missing LOVABLE_API_KEY or TWILIO_API_KEY");
      return new Response(
        JSON.stringify({ ok: false, error: "twilio_not_configured" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // 1) Read windows from aula_particular_config (default: 24h, 2h)
    const { data: cfgRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "aula_particular_config")
      .maybeSingle();
    const cfg = (cfgRow?.value as Record<string, unknown> | null) ?? {};
    const rawWindows = Array.isArray(cfg.reminder_windows_hours)
      ? (cfg.reminder_windows_hours as unknown[])
      : [24, 2];
    const windows = rawWindows
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 168)
      .map((n) => Math.round(n));
    if (windows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_windows_configured" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // 2) Twilio "from" numbers
    const { data: tw } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "twilio_config")
      .maybeSingle();
    const twCfg = (tw?.value as Record<string, string> | null) ?? {};
    const smsFrom = twCfg.sms_from_number || null;
    const whatsappFrom = twCfg.whatsapp_from_number || null;

    if (!smsFrom && !whatsappFrom) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_twilio_numbers" }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // 3) Collect lessons whose start time is within any window (+ tolerance)
    const now = Date.now();
    const maxWindow = Math.max(...windows);
    const lowerMs = now + windows.reduce((m, w) => Math.min(m, w * 3600_000), maxWindow * 3600_000);
    const upperMs = now + maxWindow * 3600_000 + TOLERANCE_MS;
    const { data: lessons, error: lessonsErr } = await supabase
      .from("scheduled_lessons")
      .select("id, title, scheduled_at, status, student_id, teacher_id")
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date(lowerMs - TOLERANCE_MS).toISOString())
      .lte("scheduled_at", new Date(upperMs).toISOString());

    if (lessonsErr) {
      console.error("Failed to load lessons:", lessonsErr);
      return new Response(
        JSON.stringify({ ok: false, error: lessonsErr.message }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const candidates: Array<{
      lesson: NonNullable<typeof lessons>[number];
      reminderHours: number;
    }> = [];
    for (const lesson of lessons ?? []) {
      const startMs = new Date(lesson.scheduled_at).getTime();
      const deltaMs = startMs - now;
      for (const w of windows) {
        const target = w * 3600_000;
        if (deltaMs >= target - TOLERANCE_MS && deltaMs <= target + TOLERANCE_MS) {
          candidates.push({ lesson, reminderHours: w });
        }
      }
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // 4) Filter out already-sent reminders (idempotency belt; the unique index
    //    is the braces, but avoiding a round-trip to Twilio saves money)
    const lessonIds = Array.from(new Set(candidates.map((c) => c.lesson.id)));
    const { data: existing } = await supabase
      .from("scheduled_lesson_reminders")
      .select("lesson_id, recipient_type, reminder_hours")
      .in("lesson_id", lessonIds);
    const sentKey = new Set(
      (existing ?? []).map(
        (e) => `${e.lesson_id}|${e.recipient_type}|${e.reminder_hours}`,
      ),
    );

    // 5) Hydrate profiles (phone + name) for student + teacher
    const userIds = Array.from(
      new Set(
        candidates.flatMap((c) => [c.lesson.student_id, c.lesson.teacher_id].filter(Boolean) as string[]),
      ),
    );
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, phone, phone_verified")
      .in("user_id", userIds);
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, p]),
    );

    // 6) Build recipient list
    const recipients: Recipient[] = [];
    for (const { lesson, reminderHours } of candidates) {
      for (const recipientType of ["student", "teacher"] as const) {
        const userId = recipientType === "student" ? lesson.student_id : lesson.teacher_id;
        if (!userId) continue;
        const key = `${lesson.id}|${recipientType}|${reminderHours}`;
        if (sentKey.has(key)) continue;
        const prof = profileMap.get(userId);
        if (!prof) continue;
        const phone = toE164BR(prof.phone);
        recipients.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          scheduledAt: lesson.scheduled_at,
          recipientType,
          userId,
          name: prof.name || "usuário",
          phone,
          reminderHours,
        });
      }
    }

    // 7) Send + log
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const r of recipients) {
      if (!r.phone) {
        await supabase.from("scheduled_lesson_reminders").insert({
          lesson_id: r.lessonId,
          recipient_type: r.recipientType,
          recipient_user_id: r.userId,
          reminder_hours: r.reminderHours,
          channel: "sms",
          status: "skipped",
          error_message: "phone_missing_or_invalid",
        }).then(() => {}, () => {});
        skipped++;
        continue;
      }
      const outcome = await sendWithFallback(
        r.phone,
        buildMessage(r),
        smsFrom,
        whatsappFrom,
        LOVABLE_API_KEY,
        TWILIO_API_KEY,
      );
      const { error: logErr } = await supabase.from("scheduled_lesson_reminders").insert({
        lesson_id: r.lessonId,
        recipient_type: r.recipientType,
        recipient_user_id: r.userId,
        reminder_hours: r.reminderHours,
        channel: outcome.channel,
        status: outcome.ok ? "sent" : "failed",
        twilio_sid: outcome.sid ?? null,
        error_message: outcome.error ?? null,
      });
      // If unique violation (race with a concurrent cron tick), treat as already sent.
      if (logErr && !logErr.message?.includes("duplicate")) {
        console.error("Failed to log reminder:", logErr);
      }
      if (outcome.ok) sent++;
      else failed++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        candidates: candidates.length,
        recipients: recipients.length,
        sent,
        failed,
        skipped,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error("send-lesson-reminders error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 200, headers: jsonHeaders },
    );
  }
});