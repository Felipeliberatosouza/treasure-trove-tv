import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, Activity, AlertCircle, ArrowUpRight, Star, TrendingDown, Minus, Megaphone } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SalesPoint {
  month: string;
  total: number;
}
interface ActivityPoint {
  label: string;
  value: number;
  color: string;
}
interface PendingPoint {
  label: string;
  value: number;
  color: string;
}
interface RatingPoint {
  month: string;
  avg: number;
  count: number;
}

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const monthLabel = (date: Date) =>
  date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

const TeacherHomeStats = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [activities, setActivities] = useState<ActivityPoint[]>([]);
  const [pendings, setPendings] = useState<PendingPoint[]>([]);
  const [ratings, setRatings] = useState<RatingPoint[]>([]);
  const [contentGoal, setContentGoal] = useState<number>(8);
  const [contentPublishedThisMonth, setContentPublishedThisMonth] = useState(0);
  const [salesPostsTotal, setSalesPostsTotal] = useState(0);
  const [salesPostsRecent, setSalesPostsRecent] = useState(0);
  const [salesPostsWeekly, setSalesPostsWeekly] = useState<{ week: string; value: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Goal: profile override or global setting
      const { data: goalSetting } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "teacher_content_goal")
        .maybeSingle();

      const globalGoal = (goalSetting?.value as { monthly_goal?: number })?.monthly_goal ?? 8;
      const personal = (profile as { monthly_content_goal?: number | null } | null)
        ?.monthly_content_goal;
      const effectiveGoal = personal && personal > 0 ? personal : globalGoal;
      setContentGoal(effectiveGoal);

      // First get teacher's content ids for aula particular count and ratings
      const [{ data: teacherLessonsIds }, { data: teacherExamsIds }] = await Promise.all([
        supabase.from("lessons").select("id").eq("teacher_id", user.id),
        supabase.from("exam_solutions").select("id").eq("teacher_id", user.id),
      ]);
      const lessonIds = (teacherLessonsIds || []).map((l) => l.id);
      const examIds = (teacherExamsIds || []).map((e) => e.id);

      // Build content filter for ratings (lessons + exams from this teacher)
      const allContentIds = [...lessonIds, ...examIds];

      // Parallel fetches
      const [
        paymentsRes,
        lessonsRes,
        examsRes,
        doubtsAnsweredRes,
        doubtsPendingRes,
        aulaParticularRes,
        lessonsThisMonthRes,
        examsThisMonthRes,
        ratingsRes,
      ] = await Promise.all([
        supabase
          .from("teacher_payments")
          .select("net_amount, period_end")
          .eq("teacher_id", user.id)
          .gte("period_end", threeMonthsAgo.slice(0, 10)),
        supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id),
        supabase
          .from("exam_solutions")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id),
        supabase
          .from("student_doubts")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id)
          .eq("status", "answered"),
        supabase
          .from("student_doubts")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id)
          .in("status", ["approved", "pending_answer_approval"]),
        lessonIds.length > 0
          ? supabase
              .from("resource_usage")
              .select("id", { count: "exact", head: true })
              .eq("resource_type", "aula_particular")
              .in("content_id", lessonIds)
          : Promise.resolve({ count: 0 } as any),
        supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id)
          .gte("created_at", startOfMonth),
        supabase
          .from("exam_solutions")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id)
          .gte("created_at", startOfMonth),
        allContentIds.length > 0
          ? supabase
              .from("video_ratings")
              .select("rating, created_at")
              .in("content_id", allContentIds)
              .gte("created_at", threeMonthsAgo)
          : Promise.resolve({ data: [] } as any),
      ]);

      // Sales posts counts (total + last 30d)
      const [{ count: salesPostsTotalCount }, { count: salesPostsRecentCount }] = await Promise.all([
        supabase
          .from("teacher_sales_posts")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id),
        supabase
          .from("teacher_sales_posts")
          .select("id", { count: "exact", head: true })
          .eq("teacher_id", user.id)
          .gte("created_at", thirtyDaysAgo),
      ]);
      setSalesPostsTotal(salesPostsTotalCount ?? 0);
      setSalesPostsRecent(salesPostsRecentCount ?? 0);

      const salesByMonth: Record<string, number> = {};
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        salesByMonth[`${d.getFullYear()}-${d.getMonth()}`] = 0;
      }
      (paymentsRes.data || []).forEach((p) => {
        const d = new Date(p.period_end);
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        if (k in salesByMonth) salesByMonth[k] += Number(p.net_amount || 0);
      });
      const salesArr: SalesPoint[] = Object.entries(salesByMonth).map(([k, v]) => {
        const [y, m] = k.split("-").map(Number);
        return { month: monthLabel(new Date(y, m, 1)), total: v };
      });
      setSales(salesArr);

      // Activities
      const contentCount = (lessonsRes.count || 0) + (examsRes.count || 0);
      setActivities([
        { label: "Conteúdos", value: contentCount, color: "hsl(var(--primary))" },
        { label: "Dúvidas", value: doubtsAnsweredRes.count || 0, color: "hsl(217 91% 60%)" },
        {
          label: "Aulas Part.",
          value: aulaParticularRes.count || 0,
          color: "hsl(142 71% 45%)",
        },
      ]);

      // Pendings
      const publishedThisMonth =
        (lessonsThisMonthRes.count || 0) + (examsThisMonthRes.count || 0);
      setContentPublishedThisMonth(publishedThisMonth);
      const goalGap = Math.max(0, effectiveGoal - publishedThisMonth);

      setPendings([
        {
          label: "Dúvidas",
          value: doubtsPendingRes.count || 0,
          color: "hsl(38 92% 50%)",
        },
        {
          label: "Meta mês",
          value: goalGap,
          color: "hsl(0 84% 60%)",
        },
      ]);

      // Ratings last 3 months (avg per month)
      const ratingsByMonth: Record<string, { sum: number; count: number }> = {};
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        ratingsByMonth[`${d.getFullYear()}-${d.getMonth()}`] = { sum: 0, count: 0 };
      }
      ((ratingsRes.data as { rating: number; created_at: string }[]) || []).forEach((r) => {
        const d = new Date(r.created_at);
        const k = `${d.getFullYear()}-${d.getMonth()}`;
        if (k in ratingsByMonth) {
          ratingsByMonth[k].sum += Number(r.rating || 0);
          ratingsByMonth[k].count += 1;
        }
      });
      const ratingsArr: RatingPoint[] = Object.entries(ratingsByMonth).map(([k, v]) => {
        const [y, m] = k.split("-").map(Number);
        return {
          month: monthLabel(new Date(y, m, 1)),
          avg: v.count > 0 ? Number((v.sum / v.count).toFixed(2)) : 0,
          count: v.count,
        };
      });
      setRatings(ratingsArr);

      setLoading(false);
    };
    fetchAll();
  }, [user, profile]);

  const totalSales = useMemo(() => sales.reduce((acc, p) => acc + p.total, 0), [sales]);
  const totalActivities = useMemo(
    () => activities.reduce((acc, p) => acc + p.value, 0),
    [activities]
  );
  const totalPendings = useMemo(
    () => pendings.reduce((acc, p) => acc + p.value, 0),
    [pendings]
  );

  const ratingsSummary = useMemo(() => {
    const totalCount = ratings.reduce((acc, r) => acc + r.count, 0);
    const weightedSum = ratings.reduce((acc, r) => acc + r.avg * r.count, 0);
    const avg = totalCount > 0 ? weightedSum / totalCount : 0;
    const last = ratings[ratings.length - 1]?.avg ?? 0;
    const prev = ratings[ratings.length - 2]?.avg ?? 0;
    const delta = last - prev;
    let trend: "up" | "down" | "flat" = "flat";
    if (delta > 0.05) trend = "up";
    else if (delta < -0.05) trend = "down";
    return { avg, totalCount, trend, delta };
  }, [ratings]);

  if (loading) {
    return (
      <div className="px-6 md:px-12 lg:px-20">
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando seus resultados...</span>
        </div>
      </div>
    );
  }

  return (
    <section className="px-6 md:px-12 lg:px-20">
      <h2 className="font-display text-2xl font-bold mb-1">📊 Seus Resultados</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Acompanhe vendas, atividades, pendências e avaliações.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Card 1: Sales */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Vendas (últimos 3 meses)
              </div>
              <p className="font-display text-2xl font-bold mt-1">{BRL(totalSales)}</p>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$${v}`}
                  width={50}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [BRL(v), "Vendas"]}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 2: Activities */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" /> Atividades
              </div>
              <p className="font-display text-2xl font-bold mt-1">{totalActivities}</p>
              <p className="text-xs text-muted-foreground">total acumulado</p>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activities} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {activities.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 3: Pendings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" /> Pendências
              </div>
              <p className="font-display text-2xl font-bold mt-1">{totalPendings}</p>
              <p className="text-xs text-muted-foreground">
                {contentPublishedThisMonth}/{contentGoal} publicados este mês
              </p>
              {pendings[0]?.value > 0 && (
                <Link
                  to="/dashboard/teacher?tab=doubts&filter=pending"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Responder {pendings[0].value} dúvida{pendings[0].value > 1 ? "s" : ""} pendente{pendings[0].value > 1 ? "s" : ""}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pendings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {pendings.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 4: Ratings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" /> Avaliação média (3 meses)
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="font-display text-2xl font-bold">
                  {ratingsSummary.avg > 0 ? ratingsSummary.avg.toFixed(1) : "—"}
                </p>
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </div>
              <div className="flex items-center gap-1 text-xs mt-1">
                {ratingsSummary.totalCount === 0 ? (
                  <span className="text-muted-foreground">Sem avaliações ainda</span>
                ) : ratingsSummary.trend === "up" ? (
                  <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                    <TrendingUp className="h-3 w-3" /> +{ratingsSummary.delta.toFixed(1)} vs mês anterior
                  </span>
                ) : ratingsSummary.trend === "down" ? (
                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                    <TrendingDown className="h-3 w-3" /> {ratingsSummary.delta.toFixed(1)} vs mês anterior
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-3 w-3" /> estável
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ratingsSummary.totalCount} avaliação{ratingsSummary.totalCount === 1 ? "" : "ões"}
              </p>
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={24}
                />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--muted) / 0.3)" }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number, _name, props) => [
                    `${v.toFixed(1)} ⭐ (${props.payload.count} aval.)`,
                    "Média",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="hsl(48 96% 53%)"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "hsl(48 96% 53%)", strokeWidth: 0 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Card 5: Sales Posts */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-card p-5 flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Megaphone className="h-4 w-4" /> Posts de Divulgação
              </div>
              <p className="font-display text-2xl font-bold mt-1">{salesPostsTotal}</p>
              <p className="text-xs text-muted-foreground">
                {salesPostsRecent} {salesPostsRecent === 1 ? "novo" : "novos"} em 30 dias
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" aria-hidden />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-primary/30 bg-primary/5">
                <Megaphone className="h-10 w-10 text-primary" />
              </div>
            </div>
          </div>
          <Link
            to="/dashboard/teacher?tab=sales-boost"
            className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {salesPostsTotal === 0 ? "Criar meu primeiro post" : "Gerar novo post"}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default TeacherHomeStats;
