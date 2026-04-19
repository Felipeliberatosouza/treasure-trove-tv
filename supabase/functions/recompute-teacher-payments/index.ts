// Recompute teacher_payments from real video_purchases
// Aggregates per teacher + period (month) using per-resource prices and platform_percentage
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RecomputeBody {
  period_start?: string; // YYYY-MM-DD
  period_end?: string; // YYYY-MM-DD
  teacher_id?: string; // optional filter
  dry_run?: boolean;
}

const RESOURCE_TO_PRICE_COL: Record<string, string> = {
  revisao: "price_revisoes",
  resumo: "price_resumos",
  simulado: "price_simulados",
  top_questoes: "price_top_questoes",
  colinha: "price_colinhas",
  // aula_particular and duvidas fall back to base price
};

function monthKey(dateIso: string): string {
  // Returns YYYY-MM
  return dateIso.slice(0, 7);
}

function monthBounds(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Allow scheduled cron invocations: caller passes service role key as Bearer
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isCron = bearer && bearer === SERVICE_ROLE;

    if (!isCron) {
      // Validate caller is admin
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const user = userData?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Acesso negado: somente administradores" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = (await req.json().catch(() => ({}))) as RecomputeBody;
    const dryRun = !!body.dry_run;

    // Default period: last 12 months
    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 12);
    const defaultStart = startDate.toISOString().slice(0, 10);

    const periodStart = body.period_start || defaultStart;
    const periodEnd = body.period_end || defaultEnd;

    // 1. Fetch all paid purchases in period
    let purchasesQuery = admin
      .from("video_purchases")
      .select("id, content_id, content_type, amount, user_id, created_at, payment_status")
      .eq("payment_status", "paid")
      .gte("created_at", `${periodStart}T00:00:00Z`)
      .lte("created_at", `${periodEnd}T23:59:59Z`);

    const { data: purchases, error: purchaseErr } = await purchasesQuery;
    if (purchaseErr) throw purchaseErr;

    // 2. Fetch lessons + exam_solutions to map content -> teacher + per-resource prices
    const [lessonsRes, examsRes, resourcePricesRes] = await Promise.all([
      admin.from("lessons").select(
        "id, teacher_id, price, platform_percentage, price_revisoes, price_resumos, price_simulados, price_top_questoes, price_colinhas",
      ),
      admin.from("exam_solutions").select(
        "id, teacher_id, price, platform_percentage, price_revisoes, price_resumos, price_simulados, price_top_questoes, price_colinhas",
      ),
      admin.from("resource_prices").select("resource_type, price, platform_percentage").eq("active", true),
    ]);

    if (lessonsRes.error) throw lessonsRes.error;
    if (examsRes.error) throw examsRes.error;

    type ContentRow = {
      id: string;
      teacher_id: string;
      price: number | null;
      platform_percentage: number | null;
      price_revisoes: number | null;
      price_resumos: number | null;
      price_simulados: number | null;
      price_top_questoes: number | null;
      price_colinhas: number | null;
    };
    const contentMap = new Map<string, ContentRow>();
    (lessonsRes.data || []).forEach((r) => contentMap.set(r.id, r as ContentRow));
    (examsRes.data || []).forEach((r) => contentMap.set(r.id, r as ContentRow));

    const defaultResourceMap = new Map<string, { price: number; platform_percentage: number }>();
    (resourcePricesRes.data || []).forEach((r: any) => {
      defaultResourceMap.set(r.resource_type, {
        price: Number(r.price) || 0,
        platform_percentage: Number(r.platform_percentage) || 30,
      });
    });

    // 3. Aggregate by teacher + month
    type Bucket = {
      teacher_id: string;
      ym: string;
      gross: number;
      fee: number;
      net: number;
      count: number;
      breakdown: Record<string, { count: number; gross: number }>;
    };
    const buckets = new Map<string, Bucket>();
    let skipped = 0;

    for (const p of purchases || []) {
      const content = contentMap.get(p.content_id);
      if (!content) {
        skipped++;
        continue;
      }
      const teacherId = content.teacher_id;
      if (body.teacher_id && teacherId !== body.teacher_id) continue;

      const resourceType = (p.content_type || "revisao") as string;

      // Resolve per-resource price (priority: per-content per-resource > content base price > resource_prices default > purchase amount)
      const colName = RESOURCE_TO_PRICE_COL[resourceType];
      let unitPrice: number | null = null;
      if (colName && (content as any)[colName] != null) {
        unitPrice = Number((content as any)[colName]);
      }
      if (unitPrice == null || unitPrice <= 0) {
        unitPrice = Number(content.price) || 0;
      }
      if (unitPrice <= 0) {
        const def = defaultResourceMap.get(resourceType);
        if (def) unitPrice = def.price;
      }
      // Fallback: use the actual purchase amount paid
      const grossUnit = unitPrice > 0 ? unitPrice : Number(p.amount) || 0;

      // Resolve platform_percentage (priority: content > resource_prices default > 30)
      let pct = content.platform_percentage != null ? Number(content.platform_percentage) : NaN;
      if (!Number.isFinite(pct)) {
        const def = defaultResourceMap.get(resourceType);
        pct = def?.platform_percentage ?? 30;
      }
      const feeUnit = grossUnit * (pct / 100);
      const netUnit = grossUnit - feeUnit;

      const ym = monthKey(p.created_at);
      const key = `${teacherId}:${ym}`;
      let b = buckets.get(key);
      if (!b) {
        b = { teacher_id: teacherId, ym, gross: 0, fee: 0, net: 0, count: 0, breakdown: {} };
        buckets.set(key, b);
      }
      b.gross += grossUnit;
      b.fee += feeUnit;
      b.net += netUnit;
      b.count += 1;
      if (!b.breakdown[resourceType]) b.breakdown[resourceType] = { count: 0, gross: 0 };
      b.breakdown[resourceType].count += 1;
      b.breakdown[resourceType].gross += grossUnit;
    }

    const results: Array<{
      teacher_id: string;
      period_start: string;
      period_end: string;
      gross_amount: number;
      platform_fee: number;
      net_amount: number;
      purchases: number;
      action?: string;
    }> = [];

    if (!dryRun) {
      for (const b of buckets.values()) {
        const { start, end } = monthBounds(b.ym);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const gross_amount = round2(b.gross);
        const platform_fee = round2(b.fee);
        const net_amount = round2(b.net);
        const notes = `Recalculado automaticamente (${b.count} compra(s)). Detalhe: ` +
          Object.entries(b.breakdown)
            .map(([k, v]) => `${k}=${v.count}×R$${round2(v.gross).toFixed(2)}`)
            .join(", ");

        // Find existing pending/processing payment for this teacher+period to update;
        // never overwrite a 'paid' payment.
        const { data: existing } = await admin
          .from("teacher_payments")
          .select("id, status")
          .eq("teacher_id", b.teacher_id)
          .eq("period_start", start)
          .eq("period_end", end)
          .eq("payment_type", "single_purchase")
          .maybeSingle();

        if (existing && existing.status === "paid") {
          results.push({
            teacher_id: b.teacher_id,
            period_start: start,
            period_end: end,
            gross_amount,
            platform_fee,
            net_amount,
            purchases: b.count,
            action: "skipped_paid",
          });
          continue;
        }

        if (existing) {
          await admin
            .from("teacher_payments")
            .update({
              gross_amount,
              platform_fee,
              net_amount,
              total_views: b.count,
              notes,
            })
            .eq("id", existing.id);
          results.push({
            teacher_id: b.teacher_id,
            period_start: start,
            period_end: end,
            gross_amount,
            platform_fee,
            net_amount,
            purchases: b.count,
            action: "updated",
          });
        } else {
          await admin.from("teacher_payments").insert({
            teacher_id: b.teacher_id,
            period_start: start,
            period_end: end,
            payment_type: "single_purchase",
            gross_amount,
            platform_fee,
            net_amount,
            total_views: b.count,
            status: "pending",
            notes,
          });
          results.push({
            teacher_id: b.teacher_id,
            period_start: start,
            period_end: end,
            gross_amount,
            platform_fee,
            net_amount,
            purchases: b.count,
            action: "inserted",
          });
        }
      }
    } else {
      for (const b of buckets.values()) {
        const { start, end } = monthBounds(b.ym);
        results.push({
          teacher_id: b.teacher_id,
          period_start: start,
          period_end: end,
          gross_amount: Math.round(b.gross * 100) / 100,
          platform_fee: Math.round(b.fee * 100) / 100,
          net_amount: Math.round(b.net * 100) / 100,
          purchases: b.count,
          action: "preview",
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        period_start: periodStart,
        period_end: periodEnd,
        purchases_processed: (purchases || []).length,
        purchases_skipped: skipped,
        buckets: results.length,
        dry_run: dryRun,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("recompute-teacher-payments error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
