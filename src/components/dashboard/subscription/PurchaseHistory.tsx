import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, PlayCircle, Film, Search } from "lucide-react";
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

interface VideoMeta { title: string; thumbnail_url?: string | null }

export default function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  const [meta, setMeta] = useState<Record<string, VideoMeta>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch titles + thumbnails for purchased videos
  useEffect(() => {
    const lessonIds = purchases
      .filter(p => p.content_type === "lesson" && p.content_id)
      .map(p => p.content_id as string);
    const examIds = purchases
      .filter(p => p.content_type === "exam_solution" && p.content_id)
      .map(p => p.content_id as string);

    if (lessonIds.length === 0 && examIds.length === 0) return;

    const load = async () => {
      const next: Record<string, VideoMeta> = {};
      if (lessonIds.length) {
        const { data } = await supabase
          .from("lessons")
          .select("id, title, thumbnail_url")
          .in("id", lessonIds);
        (data || []).forEach((l) => { next[l.id] = { title: l.title, thumbnail_url: l.thumbnail_url }; });
      }
      if (examIds.length) {
        const { data } = await supabase
          .from("exam_solutions")
          .select("id, title, thumbnail_url")
          .in("id", examIds);
        (data || []).forEach((e) => { next[e.id] = { title: e.title, thumbnail_url: e.thumbnail_url }; });
      }
      setMeta(next);
    };
    load();
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return purchases.filter((p) => {
      if (statusFilter !== "all" && p.payment_status !== statusFilter) return false;
      if (!term) return true;
      const videoMeta = p.content_id ? meta[p.content_id] : undefined;
      const title = (videoMeta?.title || contentTypeLabel[p.content_type] || p.content_type).toLowerCase();
      const typeLabel = (contentTypeLabel[p.content_type] || p.content_type).toLowerCase();
      return title.includes(term) || typeLabel.includes(term);
    });
  }, [purchases, meta, statusFilter, searchTerm]);

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
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="refunded">Reembolsado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredPurchases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma compra encontrada com os filtros aplicados.
          </p>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredPurchases.map((p) => {
              const status = statusMap[p.payment_status] || statusMap.pending;
              const videoMeta = p.content_id ? meta[p.content_id] : undefined;
              const title = videoMeta?.title || contentTypeLabel[p.content_type] || p.content_type;
              const thumbnail = videoMeta?.thumbnail_url;
              const canWatch =
                p.payment_status === "completed" &&
                p.content_id &&
                VIDEO_TYPES.has(p.content_type);

              const RowContent = (
                <>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted border border-border/50">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Film className="h-5 w-5 text-muted-foreground/60" />
                        </div>
                      )}
                      {canWatch && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/0 group-hover:bg-background/40 transition-colors">
                          <PlayCircle className="h-6 w-6 text-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium truncate ${canWatch ? "group-hover:text-primary transition-colors" : ""}`}>{title}</span>
                        <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{contentTypeLabel[p.content_type] || p.content_type}</span>
                        <span>·</span>
                        <span>{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                        <span>·</span>
                        <span className="font-medium text-foreground">R$ {p.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  {canWatch && (
                    <Button asChild size="sm" variant="outline" className="shrink-0 sm:ml-2 pointer-events-none">
                      <span>
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Assistir
                      </span>
                    </Button>
                  )}
                </>
              );

              if (canWatch) {
                return (
                  <Link
                    key={p.id}
                    to={`/video/${p.content_id}`}
                    className="group flex flex-col gap-2 py-3 -mx-2 px-2 rounded-md hover:bg-muted/50 transition-colors sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                    aria-label={`Assistir ${title}`}
                  >
                    {RowContent}
                  </Link>
                );
              }

              return (
                <div key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  {RowContent}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
