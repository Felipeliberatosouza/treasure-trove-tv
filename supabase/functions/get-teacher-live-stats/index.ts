import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * get-teacher-live-stats
 * Calcula em tempo real (mês corrente, sem escrever em banco) os indicadores
 * de remuneração para o professor autenticado:
 *  - pacotes completos até agora
 *  - minutos consumidos (vídeo + materiais)
 *  - RF Score parcial e seus componentes
 *  - bônus de Qualidade (avaliação média)
 *  - estimativa de fatia do Pool considerando o consumo atual de TODOS os professores
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function currentMonth(now: Date) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const startD = new Date(Date.UTC(y, m, 1));
  const endD = new Date(Date.UTC(y, m + 1, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(startD), end: fmt(endD) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Autenticação: identificar o professor a partir do JWT
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // deno-lint-ignore no-explicit-any
    const userClient: any = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "invalid auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, serviceKey);

    const teacherId = user.id;
    const { start, end } = currentMonth(new Date());
    const startTs = `${start}T00:00:00Z`;
    const endTs = `${end}T00:00:00Z`;

    const { data: cfgRow } = await supabase
      .from("platform_settings").select("value").eq("key", "teacher_compensation").maybeSingle();
    const cfg = cfgRow?.value ?? {};
    const packageFee = Number(cfg.package_fee_brl ?? 0);
    const poolNetPct = Number(cfg.pool_net_revenue_pct ?? 50);
    const poolMin = Number(cfg.pool_min_per_access_brl ?? 0.3);
    const poolMaxShare = Number(cfg.pool_max_share_pct ?? 15);
    const matMinEq = Number(cfg.material_access_minutes_equivalent ?? 3);
    const qBonusRating = Number(cfg.quality_bonus_min_rating ?? 4.5);
    const qBonusPct = Number(cfg.quality_bonus_pct ?? 10);
    const rfBonusMin = Number(cfg.rf_score_bonus_min ?? 9.5);
    const rfBonusPct = Number(cfg.rf_score_bonus_pct ?? 10);
    const rfWeights = cfg.rf_weights ?? { content_insertion: 30, lessons_delivered: 25, doubts_answered: 25, agenda_updated: 20 };

    // Pacotes
    const { data: pkgRes } = await supabase.rpc("count_completed_packages", {
      _teacher_id: teacherId, _start: startTs, _end: endTs,
    });
    const packages = Number(pkgRes ?? 0);

    // Vídeo minutos do professor
    const { data: watch } = await supabase
      .from("video_watch_log").select("seconds_watched")
      .eq("teacher_id", teacherId).eq("via_subscription", true)
      .gte("watched_at", startTs).lt("watched_at", endTs);
    const totalSeconds = (watch ?? []).reduce((s: number, w: any) => s + (Number(w.seconds_watched) || 0), 0);
    const videoMinutes = round2(totalSeconds / 60);

    // Materiais
    const { count: accessCount } = await supabase
      .from("material_access_log").select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId).eq("via_subscription", true)
      .gte("accessed_at", startTs).lt("accessed_at", endTs);
    const uniqueAccesses = accessCount ?? 0;
    const materialMinutes = round2(uniqueAccesses * matMinEq);
    const totalMinutes = round2(videoMinutes + materialMinutes);

    // Total de minutos da plataforma (todos os professores) — para estimar a fatia
    const { data: allWatch } = await supabase
      .from("video_watch_log").select("seconds_watched")
      .eq("via_subscription", true)
      .gte("watched_at", startTs).lt("watched_at", endTs);
    const allSeconds = (allWatch ?? []).reduce((s: number, w: any) => s + (Number(w.seconds_watched) || 0), 0);
    const { count: allAccesses } = await supabase
      .from("material_access_log").select("id", { count: "exact", head: true })
      .eq("via_subscription", true)
      .gte("accessed_at", startTs).lt("accessed_at", endTs);
    const totalPlatformMinutes = round2(allSeconds / 60 + (allAccesses ?? 0) * matMinEq);

    // Receita bruta mês corrente (parcial)
    const { data: subs } = await supabase
      .from("student_subscriptions").select("plan_id, started_at, status")
      .gte("started_at", startTs).lt("started_at", endTs);
    const planIds = Array.from(new Set((subs ?? []).map((s: any) => s.plan_id))) as string[];
    const plansById: Record<string, number> = {};
    if (planIds.length) {
      const { data: plans } = await supabase.from("subscription_plans").select("id, price").in("id", planIds);
      (plans ?? []).forEach((p: any) => { plansById[p.id] = Number(p.price) || 0; });
    }
    const grossRevenue = (subs ?? []).reduce((s: number, sub: any) => s + (plansById[sub.plan_id] ?? 0), 0);
    const taxes = round2(grossRevenue * 0.08);
    const netRevenue = round2(grossRevenue - taxes);
    const poolAmount = round2(netRevenue * (poolNetPct / 100));

    // Estimativa do share
    let poolBase = totalPlatformMinutes > 0 ? round2(poolAmount * (totalMinutes / totalPlatformMinutes)) : 0;
    const cap = round2(poolAmount * (poolMaxShare / 100));
    const floor = round2(uniqueAccesses * poolMin);
    let floorApplied = false, capApplied = false;
    if (poolBase < floor) { poolBase = floor; floorApplied = true; }
    if (poolBase > cap) { poolBase = cap; capApplied = true; }
    const sharePct = poolAmount > 0 ? round2((poolBase / poolAmount) * 10000) / 100 : 0;

    // Avaliação média (mês corrente)
    const { data: lessonIdsRow } = await supabase.from("lessons").select("id").eq("teacher_id", teacherId);
    const lessonIds = (lessonIdsRow ?? []).map((l: any) => l.id);
    let avgRating: number | null = null;
    let ratingsCount = 0;
    if (lessonIds.length) {
      const { data: ratings } = await supabase
        .from("video_ratings").select("rating").in("content_id", lessonIds)
        .gte("created_at", startTs).lt("created_at", endTs);
      ratingsCount = ratings?.length ?? 0;
      if (ratingsCount > 0) {
        avgRating = round2((ratings as any[]).reduce((s, r) => s + Number(r.rating), 0) / ratingsCount);
      }
    }

    // RF Score parcial
    const { data: targetVal } = await supabase.rpc("get_teacher_monthly_target", { _teacher_id: teacherId });
    const target = Math.max(1, Number(targetVal ?? 4));
    const insertionPct = Math.min(packages / target, 1);
    const insertionScore = round2(insertionPct * 10);

    const { data: scheduled } = await supabase
      .from("scheduled_lessons").select("status, completed_at, scheduled_at")
      .eq("teacher_id", teacherId)
      .gte("scheduled_at", startTs).lt("scheduled_at", endTs);
    const lessonsScheduled = scheduled?.length ?? 0;
    const lessonsDelivered = (scheduled ?? []).filter((s: any) => s.status === "completed" || s.completed_at).length;
    const lessonsPct = lessonsScheduled > 0 ? lessonsDelivered / lessonsScheduled : 1;
    const lessonsScore = round2(lessonsPct * 10);

    const { data: doubts } = await supabase
      .from("student_doubts").select("answered_at, created_at")
      .eq("teacher_id", teacherId)
      .gte("created_at", startTs).lt("created_at", endTs);
    const doubtsReceived = doubts?.length ?? 0;
    const doubtsAnsweredInTime = (doubts ?? []).filter((d: any) => {
      if (!d.answered_at) return false;
      const dt = (new Date(d.answered_at).getTime() - new Date(d.created_at).getTime()) / 86400000;
      return dt <= 5;
    }).length;

    // Dúvidas abertas por área (aulas com professor virtual): conta convocações
    // recebidas e respondidas dentro do prazo.
    const { data: areaInvites } = await supabase
      .from("doubt_area_invites").select("notified_at, responded_at, created_at")
      .eq("teacher_id", teacherId)
      .gte("created_at", startTs).lt("created_at", endTs);
    const areaReceived = areaInvites?.length ?? 0;
    const areaAnswered = (areaInvites ?? []).filter((i: any) => {
      if (!i.responded_at) return false;
      const dt = (new Date(i.responded_at).getTime() - new Date(i.created_at).getTime()) / 86400000;
      return dt <= 5;
    }).length;

    const totalDoubtsReceived = doubtsReceived + areaReceived;
    const totalDoubtsAnswered = doubtsAnsweredInTime + areaAnswered;
    const doubtsPct = totalDoubtsReceived > 0 ? totalDoubtsAnswered / totalDoubtsReceived : 1;
    const doubtsScore = round2(doubtsPct * 10);

    const { count: availCount } = await supabase
      .from("teacher_availability_recurring").select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId).eq("active", true);
    const agendaActive = (availCount ?? 0) > 0;
    const agendaScore = agendaActive ? 10 : 0;

    const finalScore = round2(
      (insertionScore * (rfWeights.content_insertion ?? 30) +
        lessonsScore * (rfWeights.lessons_delivered ?? 25) +
        doubtsScore * (rfWeights.doubts_answered ?? 25) +
        agendaScore * (rfWeights.agenda_updated ?? 20)) / 100
    );

    const qBonus = avgRating !== null && avgRating >= qBonusRating ? qBonusPct : 0;
    const rfBonus = finalScore >= rfBonusMin ? rfBonusPct : 0;
    const bonusFactor = (qBonus + rfBonus) / 100;
    const bonusAmount = round2(poolBase * bonusFactor);
    const poolFinal = round2(poolBase + bonusAmount);

    return new Response(JSON.stringify({
      ok: true,
      period: { start, end },
      teacher_id: teacherId,
      packages_completed: packages,
      package_fee_total: round2(packages * packageFee),
      monthly_target: target,
      video_minutes: videoMinutes,
      material_unique_accesses: uniqueAccesses,
      material_minutes_equivalent: materialMinutes,
      total_consumption_minutes: totalMinutes,
      total_platform_minutes: totalPlatformMinutes,
      pool_amount: poolAmount,
      pool_base_amount: poolBase,
      pool_share_pct: sharePct,
      pool_floor_applied: floorApplied,
      pool_cap_applied: capApplied,
      pool_min_per_access: poolMin,
      pool_max_share_pct: poolMaxShare,
      proportional_share_amount: totalPlatformMinutes > 0
        ? round2(poolAmount * (totalMinutes / totalPlatformMinutes))
        : 0,
      avg_rating: avgRating,
      ratings_count: ratingsCount,
      rf_score: finalScore,
      rf_components: {
        insertion_score: insertionScore, insertion_actual: packages, insertion_target: target,
        lessons_score: lessonsScore, lessons_scheduled: lessonsScheduled, lessons_delivered: lessonsDelivered,
        doubts_score: doubtsScore, doubts_received: totalDoubtsReceived, doubts_answered_in_time: totalDoubtsAnswered,
        agenda_score: agendaScore, agenda_active: agendaActive,
      },
      quality_bonus_pct: qBonus,
      quality_bonus_threshold: qBonusRating,
      rf_score_bonus_pct: rfBonus,
      rf_score_bonus_threshold: rfBonusMin,
      bonus_amount: bonusAmount,
      pool_final_amount: poolFinal,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("get-teacher-live-stats error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});