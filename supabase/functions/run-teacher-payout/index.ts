import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * run-teacher-payout
 * - Apura o mês anterior (ou o período fornecido) e gera:
 *   - pool_runs (1 por período)
 *   - teacher_monthly_stats (1 por professor x período)
 *   - teacher_rf_score_components (RF Score detalhado)
 *   - teacher_payments (pacote completo + comissão + repasse do pool + bônus)
 *
 * POST body: { period_start?: string (YYYY-MM-DD), period_end?: string, force?: boolean }
 * Sem body: assume mês anterior (1º a último dia).
 */

function previousMonth(now: Date): { start: string; end: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11; este mês
  const startD = new Date(Date.UTC(y, m - 1, 1));
  const endD = new Date(Date.UTC(y, m, 1)); // exclusivo
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(startD), end: fmt(endD) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, serviceKey);

    // Authn/Authz: cron secret OR admin JWT
    const cronHeader = req.headers.get("x-cron-secret") || "";
    let isAuthorized = false;
    if (cronHeader) {
      const { data: row } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "cron_secret")
        .maybeSingle();
      const expected = (row?.value as any)?.token || "";
      if (expected && cronHeader === expected) isAuthorized = true;
    }
    if (!isAuthorized) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: ud } = await userClient.auth.getUser();
      const uid = ud?.user?.id;
      if (!uid) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let body: { period_start?: string; period_end?: string; force?: boolean } = {};
    try { body = await req.json(); } catch { /* sem body */ }

    const { start, end } = body.period_start && body.period_end
      ? { start: body.period_start, end: body.period_end }
      : previousMonth(new Date());

    const startTs = `${start}T00:00:00Z`;
    const endTs = `${end}T00:00:00Z`;

    // 1. Carregar config
    const { data: cfgRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "teacher_compensation")
      .maybeSingle();
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

    // 2. Verifica/cria pool_run
    let { data: existingRun } = await supabase
      .from("pool_runs").select("*").eq("period_start", start).eq("period_end", end).maybeSingle();
    if (existingRun && existingRun.status === "completed" && !body.force) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already completed", run: existingRun }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!existingRun) {
      const { data: created } = await supabase.from("pool_runs").insert({
        period_start: start, period_end: end, status: "processing", config_snapshot: cfg,
      }).select().single();
      existingRun = created;
    } else {
      await supabase.from("pool_runs").update({ status: "processing", config_snapshot: cfg }).eq("id", existingRun.id);
    }
    const runId = existingRun.id;

    // 3. Receita bruta de assinaturas (Stripe sucesso) no período
    // Heurística: assinaturas ativas com started_at dentro do período + plan price
    // Em produção real, integrar com Stripe invoices. Aqui usamos student_subscriptions + subscription_plans.
    const { data: subs } = await supabase
      .from("student_subscriptions")
      .select("id, plan_id, started_at, status")
      .gte("started_at", startTs).lt("started_at", endTs);
    const planIds = Array.from(new Set((subs ?? []).map((s: any) => s.plan_id))) as string[];
    let plansById: Record<string, number> = {};
    if (planIds.length) {
      const { data: plans } = await supabase.from("subscription_plans").select("id, price").in("id", planIds);
      (plans ?? []).forEach((p: any) => { plansById[p.id] = Number(p.price) || 0; });
    }
    const grossRevenue = (subs ?? []).reduce((s: number, sub: any) => s + (plansById[sub.plan_id] ?? 0), 0);

    // taxes (impostos): usar 8% padrão do líquido a debitar — opcional config futura
    const taxes = round2(grossRevenue * 0.08);
    const netRevenue = round2(grossRevenue - taxes);
    const poolAmount = round2(netRevenue * (poolNetPct / 100));

    // 4. Buscar todos professores ativos
    const { data: teachers } = await supabase
      .from("user_roles").select("user_id").eq("role", "teacher");
    const teacherIds = Array.from(new Set((teachers ?? []).map((t: any) => t.user_id))) as string[];

    // 5. Para cada professor, calcular consumo
    type TeacherCalc = {
      teacher_id: string;
      packages: number;
      packageFeeTotal: number;
      videoMinutes: number;
      uniqueAccesses: number;
      materialMinutes: number;
      totalMinutes: number;
      shareBase: number; // share antes de piso/teto
      avgRating: number | null;
      ratingsCount: number;
      rfScore: number;
      rfComponents: any;
      qualityBonusPct: number;
      rfScoreBonusPct: number;
      unitSalesGross: number;
      unitSalesCount: number;
      commissionTotal: number;
    };
    const calcs: TeacherCalc[] = [];
    let totalPoolMinutes = 0;
    let totalUniqueAccesses = 0;

    for (const teacherId of teacherIds) {
      // Pacotes completos
      const { data: pkgRes } = await supabase.rpc("count_completed_packages", {
        _teacher_id: teacherId, _start: startTs, _end: endTs,
      });
      const packages = Number(pkgRes ?? 0);

      // Vídeo: somar segundos
      const { data: watch } = await supabase
        .from("video_watch_log")
        .select("seconds_watched")
        .eq("teacher_id", teacherId).eq("via_subscription", true)
        .gte("watched_at", startTs).lt("watched_at", endTs);
      const totalSeconds = (watch ?? []).reduce((s: number, w: any) => s + (Number(w.seconds_watched) || 0), 0);
      const videoMinutes = round2(totalSeconds / 60);

      // Materiais: contar registros (já únicos por dia via constraint)
      const { count: accessCount } = await supabase
        .from("material_access_log").select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherId).eq("via_subscription", true)
        .gte("accessed_at", startTs).lt("accessed_at", endTs);
      const uniqueAccesses = accessCount ?? 0;
      const materialMinutes = round2(uniqueAccesses * matMinEq);
      const totalMinutes = round2(videoMinutes + materialMinutes);
      totalPoolMinutes += totalMinutes;
      totalUniqueAccesses += uniqueAccesses;

      // Avaliação média do conteúdo do professor neste período (rating de aulas dele)
      const { data: lessonIdsRow } = await supabase
        .from("lessons").select("id").eq("teacher_id", teacherId);
      const lessonIds = (lessonIdsRow ?? []).map((l: any) => l.id);
      let avgRating: number | null = null;
      let ratingsCount = 0;
      if (lessonIds.length) {
        const { data: ratings } = await supabase
          .from("video_ratings").select("rating")
          .in("content_id", lessonIds)
          .gte("created_at", startTs).lt("created_at", endTs);
        ratingsCount = ratings?.length ?? 0;
        if (ratingsCount > 0) {
          avgRating = round2((ratings as any[]).reduce((s, r) => s + Number(r.rating), 0) / ratingsCount);
        }
      }

      // RF Score
      const { data: targetVal } = await supabase.rpc("get_teacher_monthly_target", { _teacher_id: teacherId });
      const target = Math.max(1, Number(targetVal ?? 4));
      const insertionPct = Math.min(packages / target, 1);
      const insertionScore = round2(insertionPct * 10);

      // Aulas particulares
      const { data: scheduled } = await supabase
        .from("scheduled_lessons").select("status, completed_at, scheduled_at, payment_type")
        .eq("teacher_id", teacherId)
        .gte("scheduled_at", startTs).lt("scheduled_at", endTs);
      const lessonsScheduled = scheduled?.length ?? 0;
      const lessonsDelivered = (scheduled ?? []).filter((s: any) => s.status === "completed" || s.completed_at).length;
      const lessonsPct = lessonsScheduled > 0 ? lessonsDelivered / lessonsScheduled : 1;
      const lessonsScore = round2(lessonsPct * 10);

      // Dúvidas
      const { data: doubts } = await supabase
        .from("student_doubts").select("answered_at, created_at, status")
        .eq("teacher_id", teacherId)
        .gte("created_at", startTs).lt("created_at", endTs);
      const doubtsReceived = doubts?.length ?? 0;
      // resposta dentro do prazo: 3 dias úteis ~ 5 dias corridos como aproximação
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

      // Agenda atualizada (heurística: tem disponibilidade ativa)
      const { count: availCount } = await supabase
        .from("teacher_availability_recurring").select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherId).eq("active", true);
      const agendaActive = (availCount ?? 0) > 0;
      const agendaScore = agendaActive ? 10 : 0;
      const agendaDays = agendaActive ? 30 : 0;

      const finalScore = round2(
        (insertionScore * (rfWeights.content_insertion ?? 30) +
          lessonsScore * (rfWeights.lessons_delivered ?? 25) +
          doubtsScore * (rfWeights.doubts_answered ?? 25) +
          agendaScore * (rfWeights.agenda_updated ?? 20)) / 100
      );

      // Bônus
      const qBonus = avgRating !== null && avgRating >= qBonusRating ? qBonusPct : 0;
      const rfBonus = finalScore >= rfBonusMin ? rfBonusPct : 0;

      // Vendas avulsas (video_purchases pagas, professor é dono da lesson)
      // content_type: 'lesson' content_id: lesson.id
      const { data: purchases } = await supabase
        .from("video_purchases").select("id, amount, content_id, content_type, payment_status, created_at")
        .eq("payment_status", "paid")
        .gte("created_at", startTs).lt("created_at", endTs);
      let unitGross = 0;
      let unitCount = 0;
      let commission = 0;
      // Recupera platform_percentage por lesson para calcular comissão (resto = comissão professor)
      const purchaseLessonIds = Array.from(new Set((purchases ?? [])
        .filter((p: any) => p.content_type === "lesson")
        .map((p: any) => p.content_id))) as string[];
      const teacherLessonIdSet = new Set(lessonIds);
      const lessonsForPct = purchaseLessonIds.filter((id) => teacherLessonIdSet.has(id));
      let pctByLesson: Record<string, number> = {};
      if (lessonsForPct.length) {
        const { data: lp } = await supabase.from("lessons").select("id, platform_percentage").in("id", lessonsForPct);
        (lp ?? []).forEach((l: any) => { pctByLesson[l.id] = Number(l.platform_percentage) || 0; });
      }
      for (const p of purchases ?? []) {
        if (p.content_type !== "lesson") continue;
        if (!teacherLessonIdSet.has(p.content_id)) continue;
        const amount = Number(p.amount) || 0;
        const platformPct = pctByLesson[p.content_id] ?? 30;
        const teacherShare = round2(amount * (1 - platformPct / 100));
        unitGross += amount;
        unitCount += 1;
        commission += teacherShare;
      }

      calcs.push({
        teacher_id: teacherId, packages, packageFeeTotal: round2(packages * packageFee),
        videoMinutes, uniqueAccesses, materialMinutes, totalMinutes,
        shareBase: 0, avgRating, ratingsCount, rfScore: finalScore,
        rfComponents: {
          insertion_score: insertionScore, insertion_target: target, insertion_actual: packages,
          lessons_score: lessonsScore, lessons_scheduled: lessonsScheduled, lessons_delivered: lessonsDelivered,
          doubts_score: doubtsScore, doubts_received: totalDoubtsReceived, doubts_answered_in_time: totalDoubtsAnswered,
          agenda_score: agendaScore, agenda_days_updated: agendaDays,
        },
        qualityBonusPct: qBonus, rfScoreBonusPct: rfBonus,
        unitSalesGross: round2(unitGross), unitSalesCount: unitCount, commissionTotal: round2(commission),
      });
    }

    // 6. Distribuir Pool: share proporcional aos minutos, aplicar piso e teto
    const totalMinAll = calcs.reduce((s, c) => s + c.totalMinutes, 0);
    const cap = round2(poolAmount * (poolMaxShare / 100));
    let totalDistributed = 0;

    for (const c of calcs) {
      let base = totalMinAll > 0 ? round2(poolAmount * (c.totalMinutes / totalMinAll)) : 0;
      const floor = round2(c.uniqueAccesses * poolMin);
      let floorApplied = false;
      let capApplied = false;
      if (base < floor) { base = floor; floorApplied = true; }
      if (base > cap) { base = cap; capApplied = true; }

      const sharePct = poolAmount > 0 ? round2((base / poolAmount) * 10000) / 100 : 0; // %
      const bonusFactor = (c.qualityBonusPct + c.rfScoreBonusPct) / 100;
      const bonusAmount = round2(base * bonusFactor);
      const poolFinal = round2(base + bonusAmount);
      const totalGross = round2(c.packageFeeTotal + c.commissionTotal + poolFinal);
      totalDistributed += poolFinal;

      // Salva stats
      await supabase.from("teacher_monthly_stats").upsert({
        teacher_id: c.teacher_id, period_start: start, period_end: end, pool_run_id: runId,
        packages_completed: c.packages, package_fee_total: c.packageFeeTotal,
        unit_sales_count: c.unitSalesCount, unit_sales_gross: c.unitSalesGross, commission_total: c.commissionTotal,
        video_minutes: c.videoMinutes, material_unique_accesses: c.uniqueAccesses,
        material_minutes_equivalent: c.materialMinutes, total_consumption_minutes: c.totalMinutes,
        pool_share_pct: sharePct, pool_base_amount: base,
        pool_floor_applied: floorApplied, pool_cap_applied: capApplied,
        avg_rating: c.avgRating, ratings_count: c.ratingsCount, rf_score: c.rfScore,
        quality_bonus_pct: c.qualityBonusPct, rf_score_bonus_pct: c.rfScoreBonusPct,
        bonus_amount: bonusAmount, pool_final_amount: poolFinal, total_gross: totalGross,
      }, { onConflict: "teacher_id,period_start,period_end" });

      // RF Score components
      await supabase.from("teacher_rf_score_components").upsert({
        teacher_id: c.teacher_id, period_start: start, period_end: end,
        ...c.rfComponents, final_score: c.rfScore, weights_snapshot: rfWeights,
      }, { onConflict: "teacher_id,period_start,period_end" });

      // teacher_payments: cria 1 registro consolidado se ainda não existe para esse pool_run
      if (totalGross > 0) {
        const platformFee = 0; // já líquido pela lógica do pool/comissão
        await supabase.from("teacher_payments").insert({
          teacher_id: c.teacher_id, pool_run_id: runId,
          period_start: start, period_end: end,
          payment_type: "subscription",
          gross_amount: totalGross, platform_fee: platformFee, net_amount: totalGross,
          status: "pending",
          total_views: c.uniqueAccesses, avg_rating: c.avgRating,
          package_count: c.packages, pool_minutes: c.totalMinutes,
          pool_share_pct: sharePct, quality_bonus_pct: c.qualityBonusPct,
          rf_score_bonus_pct: c.rfScoreBonusPct, rf_score: c.rfScore,
          commission_amount: c.commissionTotal,
          notes: `Pacotes: ${c.packages} x R$${packageFee.toFixed(2)} | Comissão: R$${c.commissionTotal.toFixed(2)} | Pool: R$${poolFinal.toFixed(2)}`,
        });
      }
    }

    // 7. Atualiza pool_run
    await supabase.from("pool_runs").update({
      subscription_gross_revenue: grossRevenue, taxes_amount: taxes, net_revenue: netRevenue,
      pool_amount: poolAmount, total_distributed: round2(totalDistributed),
      total_minutes: round2(totalPoolMinutes), total_unique_accesses: totalUniqueAccesses,
      status: "completed",
    }).eq("id", runId);

    return new Response(JSON.stringify({
      ok: true, run_id: runId, period: { start, end },
      teachers: calcs.length, pool_amount: poolAmount, total_distributed: round2(totalDistributed),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("run-teacher-payout error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
