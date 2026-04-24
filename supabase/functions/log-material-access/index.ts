import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** POST { lesson_id, material_type } — registra acesso único por dia */
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

    const { lesson_id, material_type } = await req.json();
    if (!lesson_id || !["resumo", "colinhas", "simulado", "top_questoes"].includes(material_type)) {
      return new Response(JSON.stringify({ error: "invalid params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // deno-lint-ignore no-explicit-any
    const admin: any = createClient(url, service);
    const { data: lesson } = await admin.from("lessons").select("teacher_id").eq("id", lesson_id).maybeSingle();
    if (!lesson) return new Response(JSON.stringify({ error: "lesson not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // detect via_subscription
    const { data: sub } = await admin.from("student_subscriptions").select("id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    const via_subscription = !!sub;

    const { error } = await admin.from("material_access_log").insert({
      user_id: user.id, teacher_id: lesson.teacher_id, lesson_id, material_type, via_subscription,
    });
    // ignora violação de unique (mesmo dia)
    if (error && !/duplicate key|unique/i.test(error.message)) {
      throw error;
    }
    return new Response(JSON.stringify({ ok: true, deduped: !!error }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
