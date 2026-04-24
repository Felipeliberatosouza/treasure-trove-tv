// Edge Function: enforce-content-protection
//
// Avalia detecções recentes de violação de proteção de conteúdo (registradas
// em `audit_logs` pelo hook `useContentProtection`) e — se um usuário ultrapassa
// o limiar configurado em `platform_settings.security_block_policy` — cria um
// bloqueio temporário em `user_blocks`. Também registra a ação em `audit_logs`.
//
// Idempotência: se o usuário já tem um bloqueio ativo, a função apenas o retorna.
// Configurável: window_minutes, threshold_count, block_duration_minutes,
//               tracked_actions (lista de actions de audit_logs que contam).

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface Policy {
  enabled: boolean;
  window_minutes: number;
  threshold_count: number;
  block_duration_minutes: number;
  tracked_actions: string[];
}

const DEFAULT_POLICY: Policy = {
  enabled: true,
  window_minutes: 1440,
  threshold_count: 10,
  block_duration_minutes: 1440,
  tracked_actions: [
    "content_protection.devtools_opened",
    "content_protection.print_attempt",
    "content_protection.shortcut_blocked",
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Identifica o usuário autenticado a partir do JWT do request.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing_auth" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "invalid_auth" }, 401);
    }
    const userId = userData.user.id;

    // Cliente service_role para bypass RLS.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // 1) Já existe bloqueio ativo? Retornar imediatamente.
    const { data: activeBlocks, error: blockErr } = await admin
      .from("user_blocks")
      .select("id, reason, blocked_at, blocked_until, metadata")
      .eq("user_id", userId)
      .is("unblocked_at", null)
      .gt("blocked_until", new Date().toISOString())
      .order("blocked_until", { ascending: false })
      .limit(1);

    if (blockErr) {
      console.error("[enforce] block lookup failed", blockErr);
      return json({ error: "lookup_failed" }, 500);
    }

    if (activeBlocks && activeBlocks.length > 0) {
      return json({
        blocked: true,
        already_active: true,
        block: activeBlocks[0],
      });
    }

    // 2) Carrega política (com defaults se não existir).
    const { data: policyRow } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "security_block_policy")
      .maybeSingle();
    const policy: Policy = { ...DEFAULT_POLICY, ...((policyRow?.value as Policy | undefined) ?? {}) };

    if (!policy.enabled) {
      return json({ blocked: false, policy_disabled: true });
    }

    // 3) Conta detecções relevantes na janela de tempo.
    const since = new Date(Date.now() - policy.window_minutes * 60_000).toISOString();
    const { count, error: countErr } = await admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("action", policy.tracked_actions)
      .gte("created_at", since);

    if (countErr) {
      console.error("[enforce] count failed", countErr);
      return json({ error: "count_failed" }, 500);
    }

    const detections = count ?? 0;
    if (detections < policy.threshold_count) {
      return json({
        blocked: false,
        detections,
        threshold: policy.threshold_count,
        window_minutes: policy.window_minutes,
      });
    }

    // 4) Cria bloqueio.
    const blockedUntil = new Date(
      Date.now() + policy.block_duration_minutes * 60_000
    ).toISOString();

    const { data: insertedBlock, error: insertErr } = await admin
      .from("user_blocks")
      .insert({
        user_id: userId,
        reason: "content_protection_threshold",
        context: "automated:enforce-content-protection",
        blocked_until: blockedUntil,
        metadata: {
          detections,
          window_minutes: policy.window_minutes,
          threshold: policy.threshold_count,
          block_duration_minutes: policy.block_duration_minutes,
          tracked_actions: policy.tracked_actions,
        },
      })
      .select("id, reason, blocked_at, blocked_until, metadata")
      .single();

    if (insertErr) {
      console.error("[enforce] insert block failed", insertErr);
      return json({ error: "insert_failed", detail: insertErr.message }, 500);
    }

    // 5) Audit log do bloqueio (com identidade do alvo).
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "security.user_blocked_auto",
      target_table: "user_blocks",
      target_id: insertedBlock!.id,
      metadata: {
        reason: "content_protection_threshold",
        detections,
        window_minutes: policy.window_minutes,
        threshold: policy.threshold_count,
        blocked_until: blockedUntil,
      },
    });

    return json({ blocked: true, just_created: true, block: insertedBlock });
  } catch (err) {
    console.error("[enforce] unexpected error", err);
    return json({ error: "unexpected", message: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}