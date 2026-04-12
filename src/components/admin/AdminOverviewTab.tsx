import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, ResponsiveContainer } from "recharts";
import { Users, Video, DollarSign, Clock, TrendingUp, Star, MailX } from "lucide-react";
import KpiDetailDialog from "./KpiDetailDialog";

interface KPIs {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  pendingLessons: number;
  pendingExams: number;
  approvedLessons: number;
  approvedExams: number;
  totalRevenue: number;
  pendingPayments: number;
  totalViews: number;
  avgRating: number;
  unsubscribedEmails: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--secondary))",
];

const AdminOverviewTab = () => {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [
      { data: roles },
      { data: lessons },
      { data: exams },
      { data: payments },
      { data: views },
      { data: ratings },
      { count: unsubCount },
    ] = await Promise.all([
      supabase.from("user_roles").select("role"),
      supabase.from("lessons").select("admin_approved, published"),
      supabase.from("exam_solutions").select("admin_approved, published"),
      supabase.from("teacher_payments").select("gross_amount, net_amount, platform_fee, status, period_start"),
      supabase.from("video_views").select("id"),
      supabase.from("video_ratings").select("rating"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("accepts_marketing", false),
    ]);

    const students = roles?.filter((r) => r.role === "student").length ?? 0;
    const teachers = roles?.filter((r) => r.role === "teacher").length ?? 0;
    const admins = roles?.filter((r) => r.role === "admin").length ?? 0;

    const pendingLessons = lessons?.filter((l) => l.published && !l.admin_approved).length ?? 0;
    const pendingExams = exams?.filter((e) => e.published && !e.admin_approved).length ?? 0;
    const approvedLessons = lessons?.filter((l) => l.admin_approved).length ?? 0;
    const approvedExams = exams?.filter((e) => e.admin_approved).length ?? 0;

    const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.platform_fee), 0) ?? 0;
    const pendingPayments = payments?.filter((p) => p.status === "pending").length ?? 0;

    const totalViews = views?.length ?? 0;
    const avgRating =
      ratings && ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

    setKpis({
      totalUsers: students + teachers + admins,
      totalStudents: students,
      totalTeachers: teachers,
      totalAdmins: admins,
      pendingLessons,
      pendingExams,
      approvedLessons,
      approvedExams,
      totalRevenue,
      pendingPayments,
      totalViews,
      avgRating,
      unsubscribedEmails: unsubCount ?? 0,
    });

    // Revenue by month
    const monthMap: Record<string, number> = {};
    payments?.forEach((p) => {
      const d = new Date(p.period_start);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = (monthMap[key] ?? 0) + Number(p.platform_fee);
    });
    const sorted = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));
    setRevenueByMonth(sorted);

    setLoading(false);
  };

  if (loading || !kpis) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Carregando métricas...
      </div>
    );
  }

  const userDistribution = [
    { name: "Alunos", value: kpis.totalStudents },
    { name: "Professores", value: kpis.totalTeachers },
    { name: "Admins", value: kpis.totalAdmins },
  ].filter((d) => d.value > 0);

  const contentData = [
    { name: "Aulas aprovadas", value: kpis.approvedLessons },
    { name: "Aulas pendentes", value: kpis.pendingLessons },
    { name: "Provas aprovadas", value: kpis.approvedExams },
    { name: "Provas pendentes", value: kpis.pendingExams },
  ];

  const kpiCards = [
    { label: "Total de Usuários", value: kpis.totalUsers, icon: Users, color: "text-primary" },
    { label: "Conteúdos Pendentes", value: kpis.pendingLessons + kpis.pendingExams, icon: Clock, color: "text-yellow-500" },
    { label: "Receita da Plataforma", value: `R$ ${kpis.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
    { label: "Visualizações", value: kpis.totalViews, icon: TrendingUp, color: "text-blue-500" },
    { label: "Pagamentos Pendentes", value: kpis.pendingPayments, icon: DollarSign, color: "text-orange-500" },
    { label: "Avaliação Média", value: kpis.avgRating.toFixed(1) + " ★", icon: Star, color: "text-amber-500" },
    { label: "Descadastros de E-mail", value: kpis.unsubscribedEmails, icon: MailX, color: "text-destructive" },
  ];

  const chartConfig = {
    amount: { label: "Receita (R$)", color: "hsl(var(--primary))" },
    value: { label: "Quantidade", color: "hsl(var(--primary))" },
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Visão Geral</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <kpi.icon className={`h-8 w-8 shrink-0 ${kpi.color}`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User distribution pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição de Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <PieChart>
                <Pie
                  data={userDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {userDistribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Content bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conteúdos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={contentData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue over time */}
      {revenueByMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita da Plataforma por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOverviewTab;
