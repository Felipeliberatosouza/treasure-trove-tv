import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Receipt, Calendar, ArrowRight, Download } from "lucide-react";
import { downloadPlanChangePdf, type PlanChangePdfData } from "@/lib/planChangePdf";

interface StatementEntry {
  date: string;
  type: "subscription_start" | "plan_change" | "cancellation" | "renewal" | "purchase";
  description: string;
  amount: number;
  explanation: string;
  /** Present only on plan_change entries — enables PDF download. */
  pdfData?: PlanChangePdfData;
}

interface SubscriptionStatementProps {
  planName: string;
  entries: StatementEntry[];
}

const typeBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  subscription_start: { label: "Início", variant: "default" },
  plan_change: { label: "Mudança de Plano", variant: "secondary" },
  cancellation: { label: "Cancelamento", variant: "destructive" },
  renewal: { label: "Renovação", variant: "default" },
  purchase: { label: "Compra Avulsa", variant: "outline" },
};

export default function SubscriptionStatement({ planName, entries }: SubscriptionStatementProps) {
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Receipt className="h-4 w-4 text-primary" />
          Extrato — {planName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {entries.map((entry, i) => {
          const badge = typeBadge[entry.type] || typeBadge.purchase;
          const isPlanChange = entry.type === "plan_change";
          const isCredit = entry.amount < 0;
          const isCharge = entry.amount > 0;

          const balanceSummary = isPlanChange
            ? isCredit
              ? `Crédito de R$ ${Math.abs(entry.amount).toFixed(2)}`
              : isCharge
                ? `Cobrança de R$ ${entry.amount.toFixed(2)}`
                : `Sem ajuste`
            : null;

          return (
            <div key={i}>
              {i > 0 && <Separator className="my-3" />}
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex items-center gap-2 shrink-0 w-28">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0">
                      {badge.label}
                    </Badge>
                    <span className="text-sm">{entry.description}</span>
                  </div>

                  {isPlanChange && (
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
                        isCredit
                          ? "bg-success/10 text-success"
                          : isCharge
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCredit ? "↓" : isCharge ? "↑" : "="} Saldo: {balanceSummary}
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {!isPlanChange && (
                      <span className={`text-sm font-semibold ${entry.amount < 0 ? "text-success" : entry.amount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                        {entry.amount < 0 ? "- " : ""}R$ {Math.abs(entry.amount).toFixed(2)}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-xs text-muted-foreground leading-relaxed">{entry.explanation}</span>
                  </div>

                  {isPlanChange && entry.pdfData && (
                    <div className="pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => downloadPlanChangePdf(entry.pdfData!)}
                      >
                        <Download className="h-3 w-3" />
                        Baixar comprovante (PDF)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
