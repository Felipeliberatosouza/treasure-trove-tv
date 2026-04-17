import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Purchase {
  id: string;
  content_id?: string | null;
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

// content types that map to a watchable video page
const VIDEO_TYPES = new Set(["lesson", "exam_solution"]);

export default function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  const [titles, setTitles] = useState<Record<string, string>>({});

  // Fetch titles for purchased videos so we can show what was bought
  useEffect(() => {
    const lessonIds = purchases
      .filter(p => p.content_type === "lesson" && p.content_id)
      .map(p => p.content_id as string);
    const examIds = purchases
      .filter(p => p.content_type === "exam_solution" && p.content_id)
      .map(p => p.content_id as string);

    if (lessonIds.length === 0 && examIds.length === 0) return;

    const load = async () => {
      const next: Record<string, string> = {};
      if (lessonIds.length) {
        const { data } = await supabase
          .from("lessons")
          .select("id, title")
          .in("id", lessonIds);
        (data || []).forEach((l) => { next[l.id] = l.title; });
      }
      if (examIds.length) {
        const { data } = await supabase
          .from("exam_solutions")
          .select("id, title")
          .in("id", examIds);
        (data || []).forEach((e) => { next[e.id] = e.title; });
      }
      setTitles(next);
    };
    load();
  }, [purchases]);

  if (purchases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Minhas Compras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Você ainda não realizou nenhuma compra avulsa.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShoppingBag className="h-4 w-4 text-primary" />
          Minhas Compras
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/50">
          {purchases.map((p) => {
            const status = statusMap[p.payment_status] || statusMap.pending;
            const title = (p.content_id && titles[p.content_id]) || contentTypeLabel[p.content_type] || p.content_type;
            const canWatch =
              p.payment_status === "completed" &&
              p.content_id &&
              VIDEO_TYPES.has(p.content_type);

            return (
              <div key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{title}</span>
                    <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{contentTypeLabel[p.content_type] || p.content_type}</span>
                    <span>·</span>
                    <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                    <span>·</span>
                    <span className="font-medium text-foreground">R$ {p.amount.toFixed(2)}</span>
                  </div>
                </div>
                {canWatch && (
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link to={`/video/${p.content_id}`}>
                      <PlayCircle className="h-4 w-4 mr-1" />
                      Assistir
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
