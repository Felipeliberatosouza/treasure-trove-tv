import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** POST { lesson_id, seconds_watched } — registra incremento de minutos para o pool */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { lesson_id, seconds_watched } = await req.json();
    const seconds = Math.max(0, Math.min(3600, Math.floor(Number(seconds_watched) || 0)));
    if (!lesson_id || seconds <= 0) {
      return new Response(JSON.stringify({ error: "invalid params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // deno-lint-ignore no-explicit-any
    const admin: any = createClient(url, service);
    const { data: lesson } = await admin.from("lessons").select("teacher_id").eq("id", lesson_id).maybeSingle();
    if (!lesson) return new Response(JSON.stringify({ error: "lesson not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: sub } = await admin.from("student_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    const via_subscription = !!sub;

    await admin.from("video_watch_log").insert({
      user_id: user.id, teacher_id: lesson.teacher_id, lesson_id,
      seconds_watched: seconds, via_subscription,
    });
    return new Response(JSON.stringify({ ok: true, seconds_logged: seconds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
