import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, Activity, AlertCircle, ArrowUpRight, Star, TrendingDown, Minus } from "lucide-react";
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

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();

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

      // First get teacher's content ids for aula particular count
      const { data: teacherLessonsIds } = await supabase
        .from("lessons")
        .select("id")
        .eq("teacher_id", user.id);
      const lessonIds = (teacherLessonsIds || []).map((l) => l.id);

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
      ]);

      // Sales last 3 months
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
        Acompanhe vendas, atividades e pendências.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
      </div>
    </section>
  );
};

export default TeacherHomeStats;
