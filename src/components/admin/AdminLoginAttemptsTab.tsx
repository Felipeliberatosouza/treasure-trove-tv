import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, RefreshCw, LogIn, ShieldX, ShieldCheck } from "lucide-react";
import { maskEmail } from "@/lib/maskData";

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  attempted_at: string;
  success: boolean;
}

const AdminLoginAttemptsTab = () => {
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchAttempts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("login_attempts" as any)
      .select("*")
      .order("attempted_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    setAttempts((data as any[] || []) as LoginAttempt[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAttempts();
  }, [page]);

  const filtered = attempts.filter((a) => {
    const matchSearch = a.email.toLowerCase().includes(search.toLowerCase()) || (a.ip_address || "").includes(search);
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "success" && a.success) ||
      (filterStatus === "failed" && !a.success);
    return matchSearch && matchStatus;
  });

  // Group failed attempts by email to highlight suspicious activity
  const failedCounts = new Map<string, number>();
  attempts
    .filter((a) => !a.success)
    .forEach((a) => failedCounts.set(a.email, (failedCounts.get(a.email) || 0) + 1));

  const suspiciousEmails = new Set(
    [...failedCounts.entries()].filter(([, count]) => count >= 3).map(([email]) => email)
  );

  const totalFailed = attempts.filter((a) => !a.success).length;
  const totalSuccess = attempts.filter((a) => a.success).length;

  const exportCsv = () => {
    const headers = ["Data/Hora", "E-mail", "IP", "Status"];
    const rows = filtered.map((a) => [
      new Date(a.attempted_at).toLocaleString("pt-BR"),
      a.email,
      a.ip_address || "",
      a.success ? "Sucesso" : "Falha",
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `login-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LogIn className="h-5 w-5 text-primary" />
          Tentativas de Login
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAttempts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold">{attempts.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{totalSuccess}</p>
          <p className="text-xs text-muted-foreground">Sucesso</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{totalFailed}</p>
          <p className="text-xs text-muted-foreground">Falhas</p>
        </div>
      </div>

      {suspiciousEmails.size > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          <p className="text-sm font-semibold text-destructive flex items-center gap-1">
            <ShieldX className="h-4 w-4" /> Atividade suspeita detectada
          </p>
          <p className="text-xs text-muted-foreground">
            {suspiciousEmails.size} e-mail(s) com 3+ tentativas falhadas:{" "}
            {[...suspiciousEmails].map((e) => maskEmail(e)).join(", ")}
          </p>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por e-mail ou IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma tentativa registrada.</p>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} className={suspiciousEmails.has(a.email) && !a.success ? "bg-destructive/5" : ""}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(a.attempted_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {maskEmail(a.email)}
                      {suspiciousEmails.has(a.email) && (
                        <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0">suspeito</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">
                      {a.ip_address || "—"}
                    </TableCell>
                    <TableCell>
                      {a.success ? (
                        <Badge variant="outline" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <ShieldCheck className="h-3 w-3" /> Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <ShieldX className="h-3 w-3" /> Falha
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
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

export default AdminLoginAttemptsTab;
