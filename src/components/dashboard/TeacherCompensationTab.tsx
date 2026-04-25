import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Package, Star, Sparkles, Trophy, Video, FileText, Users, Calendar, MessageCircle, Activity, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TeacherCompensationTrendChart from "./TeacherCompensationTrendChart";
import PoolFloorCapIndicator from "./PoolFloorCapIndicator";

const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const formatPeriod = (s: string, e: string) => {
  try { return format(new Date(s), "MMM/yyyy", { locale: ptBR }); } catch { return `${s} – ${e}`; }
};

const TeacherCompensationTab = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [rfComponents, setRfComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<any | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [poolCfg, setPoolCfg] = useState<{ pool_min_per_access_brl: number; pool_max_share_pct: number } | null>(null);

  const loadLive = async () => {
    if (!user) return;
    setLiveLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-teacher-live-stats");
      if (!error && data?.ok) setLive(data);
    } finally {
      setLiveLoading(false);
    }
  };

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
      const { data: cfgRow } = await supabase.from("platform_settings").select("value").eq("key", "teacher_compensation").maybeSingle();
      const cfgVal = (cfgRow?.value ?? {}) as any;
      setPoolCfg({
        pool_min_per_access_brl: Number(cfgVal.pool_min_per_access_brl ?? 0.3),
        pool_max_share_pct: Number(cfgVal.pool_max_share_pct ?? 15),
      });
      setLoading(false);
    })();
    loadLive();
    const interval = setInterval(loadLive, 60_000); // refresh a cada 60s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {/* MÊS CORRENTE — PARCIAL / TEMPO REAL */}
      <Card className="p-4 mb-6 border-primary/40 bg-primary/5">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <h3 className="font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Mês corrente — parcial em tempo real</h3>
            <p className="text-xs text-muted-foreground">
              Estimativa atualizada do mês em andamento. Os valores são provisórios e mudam conforme novos consumos e vendas acontecem. O fechamento oficial ocorre no dia 1º.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={loadLive} disabled={liveLoading}>
            {liveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
        {!live ? (
          <p className="text-xs text-muted-foreground">Carregando estimativa em tempo real…</p>
        ) : (
          <>
            <div className="grid md:grid-cols-4 gap-3 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Pacotes completos</p>
                <p className="font-display text-xl font-semibold">{live.packages_completed} <span className="text-xs text-muted-foreground">/ {live.monthly_target}</span></p>
                <Progress value={Math.min((live.packages_completed / live.monthly_target) * 100, 100)} className="h-1 mt-1" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consumo (min)</p>
                <p className="font-display text-xl font-semibold">{Number(live.total_consumption_minutes).toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{Number(live.video_minutes).toFixed(0)} vídeo + {live.material_unique_accesses} materiais</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sua fatia do Pool (estim.)</p>
                <p className="font-display text-xl font-semibold text-primary">{Number(live.pool_share_pct).toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">{formatBRL(Number(live.pool_base_amount))} de {formatBRL(Number(live.pool_amount))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pool final estimado</p>
                <p className="font-display text-xl font-semibold text-primary">{formatBRL(Number(live.pool_final_amount))}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {live.pool_floor_applied && <Badge variant="secondary" className="text-[10px]">piso</Badge>}
                  {live.pool_cap_applied && <Badge variant="secondary" className="text-[10px]">teto</Badge>}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <PoolFloorCapIndicator
                poolAmount={Number(live.pool_amount)}
                poolBase={Number(live.pool_base_amount)}
                proportionalShare={live.proportional_share_amount != null ? Number(live.proportional_share_amount) : null}
                uniqueAccesses={Number(live.material_unique_accesses)}
                poolMinPerAccess={Number(live.pool_min_per_access ?? 0.3)}
                poolMaxSharePct={Number(live.pool_max_share_pct ?? 15)}
                totalMinutes={Number(live.total_consumption_minutes)}
                totalPlatformMinutes={Number(live.total_platform_minutes ?? 0)}
                floorApplied={!!live.pool_floor_applied}
                capApplied={!!live.pool_cap_applied}
                compact
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><Star className="h-3 w-3" /> Bônus de Qualidade</span>
                  <Badge variant={Number(live.quality_bonus_pct) > 0 ? "default" : "outline"}>+{Number(live.quality_bonus_pct).toFixed(0)}%</Badge>
                </div>
                <Progress value={Math.min(Number(live.avg_rating ?? 0) / 5 * 100, 100)} className="h-1.5 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  Média atual: {live.avg_rating != null ? Number(live.avg_rating).toFixed(1) : "—"}★ ({live.ratings_count} avaliações). Mínimo p/ bônus: {Number(live.quality_bonus_threshold).toFixed(1)}★.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> RF Score</span>
                  <Badge variant={Number(live.rf_score_bonus_pct) > 0 ? "default" : "outline"}>+{Number(live.rf_score_bonus_pct).toFixed(0)}%</Badge>
                </div>
                <Progress value={Math.min(Number(live.rf_score ?? 0) * 10, 100)} className="h-1.5 mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  Score atual: {Number(live.rf_score).toFixed(2)}/10. Mínimo p/ bônus: {Number(live.rf_score_bonus_threshold).toFixed(1)}/10.
                </p>
                <div className="grid grid-cols-4 gap-1 mt-2 text-[10px]">
                  <div className="text-center"><p className="text-muted-foreground">Inserção</p><p className="font-medium">{Number(live.rf_components.insertion_score).toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-muted-foreground">Aulas</p><p className="font-medium">{Number(live.rf_components.lessons_score).toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-muted-foreground">Dúvidas</p><p className="font-medium">{Number(live.rf_components.doubts_score).toFixed(1)}</p></div>
                  <div className="text-center"><p className="text-muted-foreground">Agenda</p><p className="font-medium">{Number(live.rf_components.agenda_score).toFixed(1)}</p></div>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <TeacherCompensationTrendChart stats={stats} live={live} />

      {!latest ? (
        <Card className="p-8 text-center">
          <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma apuração fechada ainda. Sua primeira remuneração consolidada será calculada no fechamento do mês.</p>
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
              </div>
              <div className="mt-3">
                <PoolFloorCapIndicator
                  poolAmount={Number(latest.pool_base_amount) / Math.max(Number(latest.pool_share_pct) / 100, 0.0001)}
                  poolBase={Number(latest.pool_base_amount)}
                  uniqueAccesses={Number(latest.material_unique_accesses)}
                  poolMinPerAccess={poolCfg?.pool_min_per_access_brl}
                  poolMaxSharePct={poolCfg?.pool_max_share_pct}
                  totalMinutes={Number(latest.total_consumption_minutes)}
                  totalPlatformMinutes={null}
                  floorApplied={!!latest.pool_floor_applied}
                  capApplied={!!latest.pool_cap_applied}
                />
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

          {/* Histórico de ajustes (piso/teto) */}
          <Card className="p-4 mb-6">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Histórico de ajustes do Pool (piso / teto)
            </h3>
            {(() => {
              const adjusted = stats.filter((s) => s.pool_floor_applied || s.pool_cap_applied).slice(0, 6);
              if (adjusted.length === 0) {
                return <p className="text-xs text-muted-foreground">Nenhum ajuste de piso ou teto aplicado nas últimas apurações. Sua fatia tem ficado dentro dos limites proporcionais.</p>;
              }
              return (
                <div className="space-y-2">
                  {adjusted.map((s) => {
                    const poolTotal = Number(s.pool_base_amount) / Math.max(Number(s.pool_share_pct) / 100, 0.0001);
                    const minPerAccess = poolCfg?.pool_min_per_access_brl ?? 0.3;
                    const maxSharePct = poolCfg?.pool_max_share_pct ?? 15;
                    const floorValue = Number(s.material_unique_accesses) * minPerAccess;
                    const capValue = poolTotal * (maxSharePct / 100);
                    return (
                      <div key={s.id} className="rounded-md border border-border p-3 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{formatPeriod(s.period_start, s.period_end)}</span>
                          <div className="flex gap-1">
                            {s.pool_floor_applied && <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">Piso</Badge>}
                            {s.pool_cap_applied && <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">Teto</Badge>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Consumo</p>
                            <p className="font-medium">{Number(s.total_consumption_minutes).toFixed(0)} min</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Acessos únicos</p>
                            <p className="font-medium">{s.material_unique_accesses}</p>
                          </div>
                          {s.pool_floor_applied && (
                            <div>
                              <p className="text-muted-foreground">Piso disparado</p>
                              <p className="font-medium text-amber-700 dark:text-amber-400">{formatBRL(floorValue)}</p>
                              <p className="text-[10px] text-muted-foreground">{s.material_unique_accesses}× {formatBRL(minPerAccess)}</p>
                            </div>
                          )}
                          {s.pool_cap_applied && (
                            <div>
                              <p className="text-muted-foreground">Teto disparado</p>
                              <p className="font-medium text-blue-700 dark:text-blue-400">{formatBRL(capValue)}</p>
                              <p className="text-[10px] text-muted-foreground">{maxSharePct}% × {formatBRL(poolTotal)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Valor base final</p>
                            <p className="font-medium text-primary">{formatBRL(Number(s.pool_base_amount))}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>

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
