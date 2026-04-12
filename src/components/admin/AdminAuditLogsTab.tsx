import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download, ShieldAlert, LogIn, UserCog, Eye, KeyRound, RefreshCw } from "lucide-react";
import { maskEmail } from "@/lib/maskData";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  logout: { label: "Logout", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  password_change: { label: "Alteração de Senha", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  profile_update: { label: "Atualização de Perfil", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  data_access: { label: "Acesso a Dados", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  admin_action: { label: "Ação Admin", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  content_approved: { label: "Conteúdo Aprovado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  content_rejected: { label: "Conteúdo Rejeitado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  content_revoked: { label: "Aprovação Revogada", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  user_activated: { label: "Usuário Ativado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  user_deactivated: { label: "Usuário Desativado", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  user_deleted: { label: "Usuário Excluído", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const actionIcons: Record<string, typeof LogIn> = {
  login: LogIn,
  logout: LogIn,
  password_change: KeyRound,
  profile_update: UserCog,
  data_access: Eye,
  admin_action: ShieldAlert,
  content_approved: Eye,
  content_rejected: ShieldAlert,
  content_revoked: ShieldAlert,
  user_activated: UserCog,
  user_deactivated: UserCog,
  user_deleted: ShieldAlert,
};

const AdminAuditLogsTab = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (data && (data as any[]).length > 0) {
      const userIds = [...new Set((data as any[]).map((l: any) => l.user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      setLogs(
        (data as any[]).map((l: any) => {
          const profile = profileMap.get(l.user_id);
          return {
            ...l,
            user_name: profile?.name || "—",
            user_email: profile?.email || "—",
          };
        })
      );
    } else {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const filtered = logs.filter((l) => {
    const matchSearch =
      (l.user_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.user_email || "").toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === "all" || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const exportCsv = () => {
    const headers = ["Data/Hora", "Usuário", "E-mail", "Ação", "Tabela", "ID Alvo", "IP", "Metadados"];
    const rows = filtered.map((l) => [
      new Date(l.created_at).toLocaleString("pt-BR"),
      l.user_name,
      l.user_email,
      actionLabels[l.action]?.label || l.action,
      l.target_table || "",
      l.target_id || "",
      l.ip_address || "",
      JSON.stringify(l.metadata || {}),
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueActions = [...new Set(logs.map((l) => l.action))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Logs de Auditoria
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou ação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabels[a]?.label || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando logs...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => {
                  const IconComp = actionIcons[log.action] || ShieldAlert;
                  const style = actionLabels[log.action] || { label: log.action, color: "bg-muted text-muted-foreground" };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{log.user_name}</div>
                        <div className="text-xs text-muted-foreground">{maskEmail(log.user_email || "")}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${style.color}`}>
                          <IconComp className="h-3 w-3" />
                          {style.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.target_table && <span className="font-mono">{log.target_table}</span>}
                        {log.target_id && <span className="font-mono ml-1">#{log.target_id.slice(0, 8)}</span>}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <span className="ml-1">{JSON.stringify(log.metadata)}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{filtered.length} registro(s) exibido(s)</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={filtered.length < pageSize} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAuditLogsTab;
