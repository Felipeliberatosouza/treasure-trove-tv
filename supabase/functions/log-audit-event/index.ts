import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

const ALLOWED_ACTIONS = new Set([
  "mfa_enabled",
  "mfa_disabled",
  "plan_changed",
  "subscription_cancelled",
  "profile_update",
  "approve_profile_change",
  "reject_profile_change",
  "content_approved",
  "content_rejected",
  "content_revoked",
  "user_activated",
  "user_deactivated",
  "user_deleted",
  "password_reset_link_sent",
  "admin_video_download",
  "admin_video_storage_deleted",
  "admin_video_url_replaced",
  "material_approved",
  "material_rejected",
  "material_approved_all",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ ok: false, error: "Método inválido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return respond({ ok: false, error: "Autenticação obrigatória" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return respond({ ok: false, error: "Sessão inválida" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    if (!ALLOWED_ACTIONS.has(action)) {
      return respond({ ok: false, error: "Ação de auditoria inválida" }, 400);
    }

    const targetTable = typeof body?.targetTable === "string" ? body.targetTable.slice(0, 120) : null;
    const targetId = typeof body?.targetId === "string" ? body.targetId.slice(0, 120) : null;
    const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const { error } = await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      action,
      target_table: targetTable,
      target_id: targetId,
      metadata,
    });

    if (error) throw error;
    return respond({ ok: true });
  } catch (error) {
    console.error("log-audit-event error:", error);
    return respond({ ok: false, error: "Erro interno" });
  }
});