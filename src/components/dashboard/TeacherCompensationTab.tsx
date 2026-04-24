import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, Package, Star, Sparkles, Trophy, Video, FileText, Users, Calendar, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const formatPeriod = (s: string, e: string) => {
  try { return format(new Date(s), "MMM/yyyy", { locale: ptBR }); } catch { return `${s} – ${e}`; }
};

const TeacherCompensationTab = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [rfComponents, setRfComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase.from("teacher_monthly_stats")
        .select("*").eq("teacher_id", user.id)
        .order("period_start", { ascending: false }).limit(12);
      setStats(s ?? []);
      const { data: rf } = await supabase.from("teacher_rf_score_components")
        .select("*").eq("teacher_id", user.id)
        .order("period_start", { ascending: false }).limit(12);
      setRfComponents(rf ?? []);
      setLoading(false);
    })();
  }, [user]);

  const latest = stats[0];
  const latestRf = rfComponents[0];

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-lg font-semibold">Minha Remuneração</h2>
        <p className="text-sm text-muted-foreground">Acompanhe seus 3 fluxos de receita: taxa por pacote, comissão de vendas avulsas e Pool de Assinaturas.</p>
      </div>

      {!latest ? (
        <Card className="p-8 text-center">
          <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma apuração disponível ainda. Sua primeira remuneração será calculada no fechamento do mês.</p>
        </Card>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-3 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Package className="h-4 w-4" /> Pacotes completos</div>
              <p className="font-display text-2xl font-semibold">{latest.packages_completed}</p>
              <p className="text-xs text-primary mt-1">{formatBRL(Number(latest.package_fee_total))}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-4 w-4" /> Comissão (vendas avulsas)</div>
              <p className="font-display text-2xl font-semibold text-primary">{formatBRL(Number(latest.commission_total))}</p>
              <p className="text-xs text-muted-foreground mt-1">{latest.unit_sales_count} vendas</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Sparkles className="h-4 w-4" /> Pool de Assinaturas</div>
              <p className="font-display text-2xl font-semibold text-primary">{formatBRL(Number(latest.pool_final_amount))}</p>
              <p className="text-xs text-muted-foreground mt-1">{Number(latest.pool_share_pct).toFixed(2)}% do bolo</p>
            </Card>
            <Card className="p-4 bg-primary/5 border-primary/30">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Trophy className="h-4 w-4" /> Total do mês</div>
              <p className="font-display text-2xl font-bold text-primary">{formatBRL(Number(latest.total_gross))}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatPeriod(latest.period_start, latest.period_end)}</p>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Card className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Detalhes do Pool</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground"><Video className="inline h-3 w-3 mr-1" /> Minutos de vídeo assistidos</span><span className="font-medium">{Number(latest.video_minutes).toFixed(0)} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground"><FileText className="inline h-3 w-3 mr-1" /> Acessos a materiais textuais</span><span className="font-medium">{latest.material_unique_accesses}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Equivalente em min</span><span className="font-medium">{Number(latest.material_minutes_equivalent).toFixed(0)} min</span></div>
                <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Consumo total</span><span className="font-medium">{Number(latest.total_consumption_minutes).toFixed(0)} min</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sua fatia do Pool</span><span className="font-medium">{Number(latest.pool_share_pct).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor base (Pool)</span><span className="font-medium">{formatBRL(Number(latest.pool_base_amount))}</span></div>
                {latest.pool_floor_applied && <Badge variant="secondary">Piso mínimo aplicado</Badge>}
                {latest.pool_cap_applied && <Badge variant="secondary">Teto de 15% aplicado</Badge>}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Bônus aplicados</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Qualidade ({Number(latest.avg_rating ?? 0).toFixed(1)}★)</span>
                    <Badge variant={Number(latest.quality_bonus_pct) > 0 ? "default" : "outline"}>+{Number(latest.quality_bonus_pct).toFixed(0)}%</Badge>
                  </div>
                  <Progress value={Math.min(Number(latest.avg_rating ?? 0) / 5 * 100, 100)} className="h-1.5 mt-1" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>RF Score: {Number(latest.rf_score ?? 0).toFixed(2)}/10</span>
                    <Badge variant={Number(latest.rf_score_bonus_pct) > 0 ? "default" : "outline"}>+{Number(latest.rf_score_bonus_pct).toFixed(0)}%</Badge>
                  </div>
                  <Progress value={Math.min(Number(latest.rf_score ?? 0) * 10, 100)} className="h-1.5 mt-1" />
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de bônus</span>
                  <span className="font-medium text-primary">+{formatBRL(Number(latest.bonus_amount))}</span>
                </div>
              </div>
            </Card>
          </div>

          {latestRf && (
            <Card className="p-4 mb-6">
              <h3 className="font-medium mb-3">RF Score — Componentes</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><Package className="h-3 w-3" /> Inserção (30%)</div>
                  <p className="font-medium">{Number(latestRf.insertion_score).toFixed(1)}/10</p>
                  <p className="text-xs text-muted-foreground">{latestRf.insertion_actual} de {latestRf.insertion_target} pacotes</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><Users className="h-3 w-3" /> Aulas (25%)</div>
                  <p className="font-medium">{Number(latestRf.lessons_score).toFixed(1)}/10</p>
                  <p className="text-xs text-muted-foreground">{latestRf.lessons_delivered}/{latestRf.lessons_scheduled} realizadas</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><MessageCircle className="h-3 w-3" /> Dúvidas (25%)</div>
                  <p className="font-medium">{Number(latestRf.doubts_score).toFixed(1)}/10</p>
                  <p className="text-xs text-muted-foreground">{latestRf.doubts_answered_in_time}/{latestRf.doubts_received} no prazo</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><Calendar className="h-3 w-3" /> Agenda (20%)</div>
                  <p className="font-medium">{Number(latestRf.agenda_score).toFixed(1)}/10</p>
                  <p className="text-xs text-muted-foreground">{latestRf.agenda_days_updated > 0 ? "Atualizada" : "Sem disponibilidade"}</p>
                </div>
              </div>
            </Card>
          )}

          <h3 className="font-medium mb-3">Histórico</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr className="text-left">
                <th className="px-3 py-2 font-medium">Mês</th>
                <th className="px-3 py-2 font-medium text-right">Pacotes</th>
                <th className="px-3 py-2 font-medium text-right">Comissão</th>
                <th className="px-3 py-2 font-medium text-right">Pool</th>
                <th className="px-3 py-2 font-medium text-right">RF Score</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr></thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">{formatPeriod(s.period_start, s.period_end)}</td>
                    <td className="px-3 py-2 text-right">{s.packages_completed} <span className="text-muted-foreground text-xs">({formatBRL(Number(s.package_fee_total))})</span></td>
                    <td className="px-3 py-2 text-right">{formatBRL(Number(s.commission_total))}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(Number(s.pool_final_amount))}</td>
                    <td className="px-3 py-2 text-right">{Number(s.rf_score ?? 0).toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-medium text-primary">{formatBRL(Number(s.total_gross))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherCompensationTab;
