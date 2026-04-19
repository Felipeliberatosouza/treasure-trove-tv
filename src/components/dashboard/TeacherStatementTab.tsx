import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Receipt, Wallet, Download, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeacherPayment {
  id: string;
  period_start: string;
  period_end: string;
  payment_type: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  total_views: number | null;
  avg_rating: number | null;
  notes: string | null;
  created_at: string;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatDate = (d: string) => {
  try {
    return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case "paid":
      return { label: "Pago", variant: "default" as const };
    case "pending":
      return { label: "Pendente", variant: "secondary" as const };
    case "processing":
      return { label: "Processando", variant: "secondary" as const };
    case "failed":
      return { label: "Falhou", variant: "destructive" as const };
    case "cancelled":
      return { label: "Cancelado", variant: "outline" as const };
    default:
      return { label: s, variant: "outline" as const };
  }
};

const paymentTypeLabel = (t: string) => {
  switch (t) {
    case "subscription":
      return "Assinatura";
    case "single_purchase":
      return "Venda avulsa";
    case "bonus":
      return "Bônus";
    default:
      return t;
  }
};

const TeacherStatementTab = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("teacher_payments")
        .select("*")
        .eq("teacher_id", user.id)
        .order("period_end", { ascending: false })
        .limit(200);
      if (!error && data) setPayments(data as TeacherPayment[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (periodStart && p.period_end < periodStart) return false;
      if (periodEnd && p.period_start > periodEnd) return false;
      return true;
    });
  }, [payments, statusFilter, periodStart, periodEnd]);

  const totals = useMemo(
    () =>
      filteredPayments.reduce(
        (acc, p) => {
          acc.gross += Number(p.gross_amount) || 0;
          acc.fee += Number(p.platform_fee) || 0;
          acc.net += Number(p.net_amount) || 0;
          return acc;
        },
        { gross: 0, fee: 0, net: 0 }
      ),
    [filteredPayments]
  );

  const paidNet = useMemo(
    () =>
      filteredPayments
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0),
    [filteredPayments]
  );

  const hasFilters = statusFilter !== "all" || periodStart || periodEnd;
  const clearFilters = () => {
    setStatusFilter("all");
    setPeriodStart("");
    setPeriodEnd("");
  };

  const handleExportCSV = () => {
    const headers = ["Período Início", "Período Fim", "Tipo", "Bruto (R$)", "Taxa (R$)", "Líquido (R$)", "Status", "Visualizações", "Avaliação Média", "Observações"];
    const escape = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      if (s.includes(";") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = filteredPayments.map((p) => [
      formatDate(p.period_start),
      formatDate(p.period_end),
      paymentTypeLabel(p.payment_type),
      Number(p.gross_amount || 0).toFixed(2).replace(".", ","),
      Number(p.platform_fee || 0).toFixed(2).replace(".", ","),
      Number(p.net_amount || 0).toFixed(2).replace(".", ","),
      statusLabel(p.status).label,
      p.total_views ?? 0,
      p.avg_rating != null ? Number(p.avg_rating).toFixed(2).replace(".", ",") : "",
      p.notes ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meu-extrato-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-semibold">Meu Extrato</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus recebimentos como professor: valor bruto, taxa da plataforma e valor líquido.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredPayments.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4 my-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">De (período fim ≥)</Label>
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até (período início ≤)</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                <X className="h-4 w-4 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="h-4 w-4" /> Bruto total
          </div>
          <p className="font-display text-lg font-semibold">{formatBRL(totals.gross)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Receipt className="h-4 w-4" /> Taxa da plataforma
          </div>
          <p className="font-display text-lg font-semibold text-destructive">
            -{formatBRL(totals.fee)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-4 w-4" /> Líquido total
          </div>
          <p className="font-display text-lg font-semibold text-primary">{formatBRL(totals.net)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Wallet className="h-4 w-4" /> Já recebido
          </div>
          <p className="font-display text-lg font-semibold">{formatBRL(paidNet)}</p>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando extrato...</p>
      ) : filteredPayments.length === 0 ? (
        <Card className="p-8 text-center">
          <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {payments.length === 0
              ? "Nenhum pagamento registrado ainda. Publique e divulgue seus conteúdos para começar a receber."
              : "Nenhum pagamento encontrado com os filtros aplicados."}
          </p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium text-right">Bruto</th>
                  <th className="px-4 py-2 font-medium text-right">Taxa</th>
                  <th className="px-4 py-2 font-medium text-right">Líquido</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => {
                  const st = statusLabel(p.status);
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatDate(p.period_start)} – {formatDate(p.period_end)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{paymentTypeLabel(p.payment_type)}</td>
                      <td className="px-4 py-2 text-right">{formatBRL(p.gross_amount)}</td>
                      <td className="px-4 py-2 text-right text-destructive">-{formatBRL(p.platform_fee)}</td>
                      <td className="px-4 py-2 text-right font-medium text-primary">{formatBRL(p.net_amount)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredPayments.map((p) => {
              const st = statusLabel(p.status);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.period_start)} – {formatDate(p.period_end)}
                      </p>
                      <p className="text-xs text-muted-foreground">{paymentTypeLabel(p.payment_type)}</p>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Bruto</p>
                      <p className="font-medium">{formatBRL(p.gross_amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa</p>
                      <p className="font-medium text-destructive">-{formatBRL(p.platform_fee)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Líquido</p>
                      <p className="font-medium text-primary">{formatBRL(p.net_amount)}</p>
                    </div>
                  </div>
                  {p.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">{p.notes}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherStatementTab;
