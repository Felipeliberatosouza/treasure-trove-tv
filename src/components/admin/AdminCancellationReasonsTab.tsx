import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquareQuote, TrendingDown } from "lucide-react";
import { CANCELLATION_REASONS } from "@/components/dashboard/subscription/CancelSubscriptionModal";
import { Button } from "@/components/ui/button";

interface CancellationLog {
  id: string;
  created_at: string;
  user_id: string | null;
  metadata: {
    reason_code?: string | null;
    reason_details?: string | null;
    stripe_subscription_id?: string | null;
    email?: string | null;
  } | null;
}

const reasonLabel = (code: string | null | undefined): string => {
  if (!code) return "Não informado";
  return CANCELLATION_REASONS.find((r) => r.value === code)?.label || code;
};

const exportCsv = (rows: CancellationLog[]) => {
  const header = ["Data", "Email", "Motivo", "Comentário", "ID da assinatura"];
  const lines = rows.map((r) => {
    const meta = r.metadata || {};
    return [
      new Date(r.created_at).toLocaleString("pt-BR"),
      meta.email || "",
      reasonLabel(meta.reason_code),
      (meta.reason_details || "").replace(/[\n\r;]/g, " "),
      meta.stripe_subscription_id || "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";");
  });
  const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cancelamentos_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function AdminCancellationReasonsTab() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CancellationLog[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, user_id, metadata")
        .eq("action", "subscription_cancelled")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error && data) setLogs(data as unknown as CancellationLog[]);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    let withReason = 0;
    for (const l of logs) {
      const code = l.metadata?.reason_code || null;
      const key = code || "__none__";
      counts.set(key, (counts.get(key) || 0) + 1);
      if (code) withReason += 1;
    }
    const total = logs.length;
    const breakdown = Array.from(counts.entries())
      .map(([code, count]) => ({
        code,
        label: code === "__none__" ? "Não informado" : reasonLabel(code),
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    return { total, withReason, breakdown };
  }, [logs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <h2 className="font-display text-xl font-bold">Motivos de Cancelamento</h2>
          </div>
          {logs.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportCsv(logs)}>
              Exportar CSV
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Estatísticas dos motivos informados pelos alunos ao cancelar a assinatura.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total de cancelamentos</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Com motivo informado</p>
          <p className="text-2xl font-bold mt-1">{stats.withReason}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Taxa de resposta</p>
          <p className="text-2xl font-bold mt-1">
            {stats.total > 0 ? ((stats.withReason / stats.total) * 100).toFixed(0) : 0}%
          </p>
        </div>
      </div>

      {/* Breakdown bars */}
      {stats.breakdown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum cancelamento registrado ainda.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Distribuição por motivo</h3>
          {stats.breakdown.map((b) => (
            <div key={b.code} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{b.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {b.count} ({b.pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${b.code === "__none__" ? "bg-muted-foreground/40" : "bg-primary"}`}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent comments */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <MessageSquareQuote className="h-4 w-4" /> Comentários recentes
        </h3>
        {logs.filter((l) => l.metadata?.reason_details).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comentário registrado.</p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto">
            {logs
              .filter((l) => l.metadata?.reason_details)
              .slice(0, 50)
              .map((l) => (
                <li key={l.id} className="border-l-2 border-primary/40 pl-3 py-1">
                  <p className="text-sm text-foreground italic">"{l.metadata?.reason_details}"</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {reasonLabel(l.metadata?.reason_code)} ·{" "}
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                    {l.metadata?.email ? ` · ${l.metadata.email}` : ""}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
