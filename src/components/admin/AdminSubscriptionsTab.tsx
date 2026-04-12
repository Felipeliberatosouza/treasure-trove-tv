import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle, CheckCircle, XCircle, Calendar, Users, Download } from "lucide-react";

interface ExpiringSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  expires_at: string | null;
  started_at: string;
  stripe_subscription_id: string | null;
  userName: string;
  userEmail: string;
  planName: string;
  daysRemaining: number;
}

interface ReminderLog {
  id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  created_at: string;
  error_message: string | null;
}

const AdminSubscriptionsTab = () => {
  const [expiringSubs, setExpiringSubs] = useState<ExpiringSubscription[]>([]);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [reminderDays, setReminderDays] = useState<string>("30");

  useEffect(() => {
    fetchData();
  }, [reminderDays]);

  const fetchData = async () => {
    setLoading(true);

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + parseInt(reminderDays));

    // Fetch active subscriptions expiring within the selected window
    const { data: subs } = await supabase
      .from("student_subscriptions")
      .select("id, user_id, plan_id, status, expires_at, started_at, stripe_subscription_id, subscription_plans(name)")
      .in("status", ["active"])
      .not("expires_at", "is", null)
      .lte("expires_at", futureDate.toISOString())
      .order("expires_at", { ascending: true });

    // Fetch profiles for user names
    const userIds = [...new Set(subs?.map((s) => s.user_id) || [])];
    let profilesMap: Record<string, { name: string; email: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", userIds);

      profiles?.forEach((p) => {
        profilesMap[p.user_id] = { name: p.name, email: p.email };
      });
    }

    const enriched: ExpiringSubscription[] = (subs || []).map((s) => {
      const planData = s.subscription_plans as any;
      const expiresAt = s.expires_at ? new Date(s.expires_at) : null;
      const daysRemaining = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        ...s,
        userName: profilesMap[s.user_id]?.name || "—",
        userEmail: profilesMap[s.user_id]?.email || "—",
        planName: planData?.name || "—",
        daysRemaining,
      };
    });

    setExpiringSubs(enriched);

    // Fetch reminder emails sent (subscription-expiring and subscription-cancelled)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: emailLogs } = await supabase
      .from("email_send_log")
      .select("id, template_name, recipient_email, status, created_at, error_message")
      .in("template_name", ["subscription-expiring", "subscription-cancelled"])
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    setReminders(emailLogs || []);
    setLoading(false);
  };

  const filteredSubs = expiringSubs.filter((s) => {
    if (filter === "critical") return s.daysRemaining <= 3;
    if (filter === "warning") return s.daysRemaining > 3 && s.daysRemaining <= 7;
    if (filter === "upcoming") return s.daysRemaining > 7;
    return true;
  });

  const exportCsv = () => {
    const header = "Aluno,E-mail,Plano,Vencimento,Dias Restantes,Status";
    const rows = filteredSubs.map((s) =>
      [
        `"${s.userName}"`,
        `"${s.userEmail}"`,
        `"${s.planName}"`,
        s.expires_at ? new Date(s.expires_at).toLocaleDateString("pt-BR") : "—",
        s.daysRemaining,
        s.status,
      ].join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assinaturas-vencendo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: expiringSubs.length,
    critical: expiringSubs.filter((s) => s.daysRemaining <= 3).length,
    warning: expiringSubs.filter((s) => s.daysRemaining > 3 && s.daysRemaining <= 7).length,
    upcoming: expiringSubs.filter((s) => s.daysRemaining > 7).length,
    remindersSent: reminders.filter((r) => r.status === "sent" && r.template_name === "subscription-expiring").length,
    cancelledSent: reminders.filter((r) => r.status === "sent" && r.template_name === "subscription-cancelled").length,
  };

  const getDaysRemainingBadge = (days: number) => {
    if (days <= 0) return <Badge variant="destructive">Expirado</Badge>;
    if (days <= 3) return <Badge variant="destructive">{days}d restante{days > 1 ? "s" : ""}</Badge>;
    if (days <= 7) return <Badge className="bg-amber-500 text-white hover:bg-amber-600">{days}d restantes</Badge>;
    return <Badge variant="secondary">{days}d restantes</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Enviado</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "failed":
      case "dlq":
        return <Badge variant="destructive">Falhou</Badge>;
      case "suppressed":
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Suprimido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Assinaturas & Lembretes
        </h2>
        <Select value={reminderDays} onValueChange={setReminderDays}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Próximos 7 dias</SelectItem>
            <SelectItem value="14">Próximos 14 dias</SelectItem>
            <SelectItem value="30">Próximos 30 dias</SelectItem>
            <SelectItem value="60">Próximos 60 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-border cursor-pointer" onClick={() => setFilter("all")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-6 w-6 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Total Vencendo</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer" onClick={() => setFilter("critical")}>
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-6 w-6 text-destructive shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Crítico (≤3d)</p>
              <p className="text-xl font-bold">{stats.critical}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer" onClick={() => setFilter("warning")}>
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Atenção (4-7d)</p>
              <p className="text-xl font-bold">{stats.warning}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border cursor-pointer" onClick={() => setFilter("upcoming")}>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="h-6 w-6 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Futuro ({">"}7d)</p>
              <p className="text-xl font-bold">{stats.upcoming}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <Bell className="h-6 w-6 text-green-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Lembretes</p>
              <p className="text-xl font-bold">{stats.remindersSent}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle className="h-6 w-6 text-orange-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Cancelamentos</p>
              <p className="text-xl font-bold">{stats.cancelledSent}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Subscriptions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>Assinaturas Prestes a Vencer</span>
            {filter !== "all" && (
              <Badge variant="outline" className="cursor-pointer" onClick={() => setFilter("all")}>
                Limpar filtro ✕
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma assinatura prestes a vencer no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.userName}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{sub.userEmail}</TableCell>
                      <TableCell>{sub.planName}</TableCell>
                      <TableCell className="text-sm">
                        {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>{getDaysRemainingBadge(sub.daysRemaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reminders Sent Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Lembretes e Notificações Enviados (últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum lembrete enviado nos últimos 30 dias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.template_name === "subscription-expiring" ? "Lembrete" : "Cancelamento"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.recipient_email}</TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(r.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {r.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSubscriptionsTab;
