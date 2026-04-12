import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, CheckCircle, XCircle, AlertTriangle, Clock, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";

interface EmailLog {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface SecurityNotification {
  id: string;
  email: string;
  template_key: string;
  subject: string;
  user_agent: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

const TIME_RANGES = [
  { label: "Últimas 24h", days: 1 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  sent: { label: "Enviado", color: "border-green-500/30 text-green-500", icon: CheckCircle },
  pending: { label: "Pendente", color: "border-blue-500/30 text-blue-500", icon: Clock },
  failed: { label: "Falhou", color: "border-destructive/30 text-destructive", icon: XCircle },
  dlq: { label: "Falhou", color: "border-destructive/30 text-destructive", icon: XCircle },
  suppressed: { label: "Suprimido", color: "border-accent/30 text-accent", icon: AlertTriangle },
  bounced: { label: "Bounce", color: "border-destructive/30 text-destructive", icon: XCircle },
  complained: { label: "Spam", color: "border-destructive/30 text-destructive", icon: AlertTriangle },
};

const securityStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "border-yellow-500/30 text-yellow-600" },
  investigating: { label: "Investigando", color: "border-blue-500/30 text-blue-500" },
  resolved: { label: "Resolvido", color: "border-green-500/30 text-green-500" },
};

const AdminEmailsTab = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(7);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTemplate, setFilterTemplate] = useState("all");
  const [page, setPage] = useState(0);
  const [activeView, setActiveView] = useState<"emails" | "security">("emails");
  const [securityNotifs, setSecurityNotifs] = useState<SecurityNotification[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    const since = new Date(Date.now() - rangeDays * 86400000).toISOString();

    const { data } = await supabase
      .from("email_send_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);

    setLogs((data as EmailLog[]) || []);
    setLoading(false);
    setPage(0);
  };

  const fetchSecurityNotifs = async () => {
    setSecurityLoading(true);
    const { data } = await supabase
      .from("security_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    setSecurityNotifs((data as unknown as SecurityNotification[]) || []);
    setSecurityLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [rangeDays]);
  useEffect(() => { if (activeView === "security") fetchSecurityNotifs(); }, [activeView]);

  const updateSecurityStatus = async (id: string, status: string) => {
    await supabase.from("security_notifications").update({ status }).eq("id", id);
    setSecurityNotifs(prev => prev.map(n => n.id === id ? { ...n, status } : n));
  };

  // Deduplicate by message_id (keep latest status per message_id)
  const deduplicated = useMemo(() => {
    const map = new Map<string, EmailLog>();
    for (const log of logs) {
      const key = log.message_id || log.id;
      const existing = map.get(key);
      if (!existing || new Date(log.created_at) > new Date(existing.created_at)) {
        map.set(key, log);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [logs]);

  const templateNames = useMemo(() => {
    return [...new Set(deduplicated.map(l => l.template_name))].sort();
  }, [deduplicated]);

  const filtered = useMemo(() => {
    return deduplicated.filter(l => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterTemplate !== "all" && l.template_name !== filterTemplate) return false;
      return true;
    });
  }, [deduplicated, filterStatus, filterTemplate]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0 };
    for (const l of filtered) {
      if (l.status === "sent") s.sent++;
      else if (["failed", "dlq"].includes(l.status)) s.failed++;
      else if (["suppressed", "bounced", "complained"].includes(l.status)) s.suppressed++;
    }
    return s;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const pendingSecurityCount = securityNotifs.filter(n => n.status === "pending").length;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5" /> Monitoramento de E-mails
      </h2>

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        <Button
          size="sm"
          variant={activeView === "emails" ? "default" : "outline"}
          onClick={() => setActiveView("emails")}
          className="text-xs"
        >
          <Mail className="h-3.5 w-3.5 mr-1" /> E-mails Enviados
        </Button>
        <Button
          size="sm"
          variant={activeView === "security" ? "default" : "outline"}
          onClick={() => setActiveView("security")}
          className="text-xs relative"
        >
          <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Notificações de Segurança
          {pendingSecurityCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {pendingSecurityCount}
            </span>
          )}
        </Button>
      </div>

      {activeView === "emails" ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Enviados", value: stats.sent, color: "text-green-500" },
              { label: "Falhas", value: stats.failed, color: "text-destructive" },
              { label: "Suprimidos", value: stats.suppressed, color: "text-accent" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3 px-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex gap-1">
              {TIME_RANGES.map(r => (
                <Button
                  key={r.days}
                  size="sm"
                  variant={rangeDays === r.days ? "default" : "outline"}
                  onClick={() => setRangeDays(r.days)}
                  className="text-xs"
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="dlq">DLQ</SelectItem>
                <SelectItem value="suppressed">Suprimido</SelectItem>
                <SelectItem value="bounced">Bounce</SelectItem>
                <SelectItem value="complained">Spam</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTemplate} onValueChange={setFilterTemplate}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos templates</SelectItem>
                {templateNames.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((log) => {
                      const cfg = statusConfig[log.status] || { label: log.status, color: "", icon: Clock };
                      const Icon = cfg.icon;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm font-medium">{log.template_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{log.recipient_email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${cfg.color} flex items-center gap-1 w-fit`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell className="text-xs text-destructive max-w-[160px] truncate">
                            {log.error_message || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paginated.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum e-mail encontrado no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length} e-mail(s) • Página {page + 1} de {totalPages}
                  </p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* Security Notifications View */
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Registros de usuários que reportaram ter recebido e-mails não solicitados.
          </p>

          {securityLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securityNotifs.map((n) => {
                    const cfg = securityStatusConfig[n.status] || { label: n.status, color: "" };
                    return (
                      <TableRow key={n.id}>
                        <TableCell className="text-sm">{n.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{n.template_key}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{n.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell>
                          <Select value={n.status} onValueChange={(v) => updateSecurityStatus(n.id, v)}>
                            <SelectTrigger className="w-[130px] h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="investigating">Investigando</SelectItem>
                              <SelectItem value="resolved">Resolvido</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {securityNotifs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma notificação de segurança registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminEmailsTab;
