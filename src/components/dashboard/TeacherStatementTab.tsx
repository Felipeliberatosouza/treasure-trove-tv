import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Receipt, Wallet } from "lucide-react";
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

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("teacher_payments")
        .select("*")
        .eq("teacher_id", user.id)
        .order("period_end", { ascending: false })
        .limit(50);
      if (!error && data) setPayments(data as TeacherPayment[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const totals = payments.reduce(
    (acc, p) => {
      acc.gross += Number(p.gross_amount) || 0;
      acc.fee += Number(p.platform_fee) || 0;
      acc.net += Number(p.net_amount) || 0;
      return acc;
    },
    { gross: 0, fee: 0, net: 0 }
  );

  const paidNet = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1">Meu Extrato</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Acompanhe seus recebimentos como professor: valor bruto, taxa da plataforma e valor líquido.
      </p>

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
      ) : payments.length === 0 ? (
        <Card className="p-8 text-center">
          <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Nenhum pagamento registrado ainda. Publique e divulgue seus conteúdos para começar a receber.
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
                {payments.map((p) => {
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
            {payments.map((p) => {
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
