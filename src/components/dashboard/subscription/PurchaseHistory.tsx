import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";

interface Purchase {
  id: string;
  content_type: string;
  amount: number;
  payment_status: string;
  created_at: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
};

const contentTypeLabel: Record<string, string> = {
  lesson: "Aula",
  exam_solution: "Resolução de Prova",
  revisao: "Revisão",
  resumo: "Resumo",
  simulado: "Simulado",
  top_questoes: "Top Questões",
  colinha: "Colinha",
  duvida: "Dúvida",
  aula_particular: "Aula Particular",
};

export default function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  if (purchases.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhuma compra avulsa realizada.
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShoppingBag className="h-4 w-4 text-primary" />
          Compras Avulsas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {purchases.map(p => {
            const status = statusMap[p.payment_status] || statusMap.pending;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  <span>{contentTypeLabel[p.content_type] || p.content_type}</span>
                  <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                    {status.label}
                  </Badge>
                </div>
                <span className="font-medium">R$ {p.amount.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
