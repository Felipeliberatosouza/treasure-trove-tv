import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, RefreshCw, Settings as SettingsIcon, Users, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TooltipMessagesConfig,
  TooltipMetricKey,
  TooltipMetricMessages,
  DEFAULT_TOOLTIP_MESSAGES,
  TOOLTIP_METRIC_LABELS,
  TOOLTIP_METRIC_UNIT_HINT,
  mergeTooltipMessages,
} from "@/components/dashboard/tooltipMessagesConfig";
import { cn } from "@/lib/utils";

interface CompConfig {
  package_fee_brl: number;
  pool_net_revenue_pct: number;
  pool_min_per_access_brl: number;
  pool_max_share_pct: number;
  material_access_minutes_equivalent: number;
  quality_bonus_min_rating: number;
  quality_bonus_pct: number;
  rf_score_bonus_min: number;
  rf_score_bonus_pct: number;
  default_monthly_package_target: number;
  rf_weights: { content_insertion: number; lessons_delivered: number; doubts_answered: number; agenda_updated: number; };
  proximity_alerts?: ProximityAlertsConfig;
  tooltip_messages?: TooltipMessagesConfig;
}

interface ProximityAlertsConfig {
  enabled: boolean;
  near_cap_threshold_pct: number;   // % do teto a partir do qual mostrar alerta (ex: 80)
  near_floor_ratio_pct: number;     // proporcional/piso <= X% (ex: 120)
  cap_color_hsl: string;            // ex: "217 91% 60%"
  floor_color_hsl: string;          // ex: "38 92% 50%"
  near_cap_title: string;
  near_cap_body: string;             // suporta {pct_of_cap}, {proportional}, {cap_value}, {cap_pct}
  cap_applied_title: string;
  cap_applied_body: string;          // suporta {cap_value}, {cap_pct}
  near_floor_title: string;
  near_floor_body: string;           // suporta {ratio_pct}, {proportional}, {floor_value}, {accesses}, {min_per_access}
  floor_applied_title: string;
  floor_applied_body: string;        // suporta {accesses}, {min_per_access}, {floor_value}
}

const DEFAULT_PROXIMITY: ProximityAlertsConfig = {
  enabled: true,
  near_cap_threshold_pct: 80,
  near_floor_ratio_pct: 120,
  cap_color_hsl: "217 91% 60%",
  floor_color_hsl: "38 92% 50%",
  near_cap_title: "Você está próximo do teto ({pct_of_cap}% do limite)",
  near_cap_body: "Sua fatia proporcional ({proportional}) está se aproximando do teto de {cap_pct}% do Pool ({cap_value}). Acima desse valor, o consumo extra não aumenta seu repasse.",
  cap_applied_title: "Teto atingido — sua fatia foi limitada a {cap_pct}% do Pool",
  cap_applied_body: "Limite atual: {cap_value}. Consumo extra acima disso é redistribuído entre os outros professores.",
  near_floor_title: "Volume baixo — você está perto de acionar o piso mínimo",
  near_floor_body: "Seu cálculo proporcional ({proportional}) está apenas {ratio_pct}% acima do piso ({floor_value} = {accesses} acessos × {min_per_access}). Se o consumo cair, o piso será aplicado automaticamente.",
  floor_applied_title: "Piso mínimo acionado — volume baixo neste mês",
  floor_applied_body: "Sua fatia proporcional ficou abaixo do piso garantido de {min_per_access} por acesso único ({accesses} acessos = {floor_value}). O piso foi aplicado para proteger sua remuneração.",
};

const TOKEN_HELP = "Variáveis: {pct_of_cap}, {proportional}, {cap_value}, {cap_pct}, {ratio_pct}, {floor_value}, {accesses}, {min_per_access}";

const ColorSwatch = ({ hsl }: { hsl: string }) => (
  <span className="inline-block h-6 w-6 rounded-md border border-border" style={{ background: `hsl(${hsl})` }} />
);

const isValidHsl = (v: string) => /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(v.trim());

const ensureProximity = (cfg: CompConfig): CompConfig => {
  if (cfg.proximity_alerts) return cfg;
  return { ...cfg, proximity_alerts: DEFAULT_PROXIMITY };
};

const setProximity = (cfg: CompConfig, patch: Partial<ProximityAlertsConfig>): CompConfig => {
  const current = cfg.proximity_alerts ?? DEFAULT_PROXIMITY;
  return { ...cfg, proximity_alerts: { ...current, ...patch } };
};

const setTooltipMetric = (
  cfg: CompConfig,
  metric: TooltipMetricKey,
  patch: Partial<TooltipMetricMessages>
): CompConfig => {
  const merged = mergeTooltipMessages(cfg.tooltip_messages);
  return {
    ...cfg,
    tooltip_messages: {
      ...merged,
      [metric]: { ...merged[metric], ...patch },
    },
  };
};

const setTooltipEnabled = (cfg: CompConfig, enabled: boolean): CompConfig => {
  const merged = mergeTooltipMessages(cfg.tooltip_messages);
  return { ...cfg, tooltip_messages: { ...merged, enabled } };
};

// Tipos de erro de validação
type TooltipThresholdErrors = Partial<Record<TooltipMetricKey, string>>;

const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const formatDate = (d: string) => { try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; } };

const AdminCompensationConfigTab = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<CompConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [newTarget, setNewTarget] = useState({ teacher_id: "", monthly_package_target: 4 });
  const [thresholdErrors, setThresholdErrors] = useState<TooltipThresholdErrors>({});
  const [thresholdInputs, setThresholdInputs] = useState<Partial<Record<TooltipMetricKey, string>>>({});

  const validateThresholdInput = (value: string): string | undefined => {
    if (value === "" || value.trim() === "") {
      return "O limiar é obrigatório";
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      return "Digite um número válido";
    }
    if (num < 0) {
      return "O limiar não pode ser negativo";
    }
    return undefined;
  };

  const updateMetricWithValidation = (
    currentCfg: CompConfig,
    metric: TooltipMetricKey,
    rawValue: string
  ) => {
    setThresholdInputs((prev) => ({ ...prev, [metric]: rawValue }));
    const error = validateThresholdInput(rawValue);
    setThresholdErrors((prev) => ({ ...prev, [metric]: error }));
    
    // Só atualiza o config se for um número válido
    const num = Number(rawValue);
    if (!Number.isNaN(num) && rawValue !== "") {
      return setTooltipMetric(currentCfg, metric, { strong_threshold: num });
    }
    return currentCfg;
  };

  const hasThresholdErrors = Object.values(thresholdErrors).some((e) => e !== undefined);

  const load = async () => {
    setLoading(true);
    const { data: cfgRow } = await supabase.from("platform_settings").select("value").eq("key", "teacher_compensation").maybeSingle();
    if (cfgRow?.value) setCfg(cfgRow.value as unknown as CompConfig);
    const { data: runRows } = await supabase.from("pool_runs").select("*").order("period_start", { ascending: false }).limit(24);
    setRuns(runRows ?? []);
    const { data: tRows } = await supabase.from("teacher_monthly_targets").select("*").order("created_at", { ascending: false });
    setTargets(tRows ?? []);
    const { data: roleRows } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name").in("user_id", ids);
      setTeachers((profs ?? []).map((p: any) => ({ id: p.user_id, name: p.name || p.user_id.slice(0, 8) })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    // Garante que proximity_alerts vai persistido
    const withProximity = ensureProximity(cfg);
    const payload: CompConfig = {
      ...withProximity,
      tooltip_messages: mergeTooltipMessages(withProximity.tooltip_messages),
    };
    const { error } = await supabase.from("platform_settings").upsert({ key: "teacher_compensation", value: payload as any });
    setSaving(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Configurações salvas" });
  };

  const runPayout = async (force = false) => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("run-teacher-payout", { body: force ? { force: true } : {} });
    setRunning(false);
    if (error) { toast({ title: "Erro na apuração", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Apuração concluída", description: `Pool: ${formatBRL(data?.pool_amount || 0)} | Distribuído: ${formatBRL(data?.total_distributed || 0)}` });
    load();
  };

  const addTarget = async () => {
    if (!newTarget.teacher_id) return;
    const { error } = await supabase.from("teacher_monthly_targets").upsert({
      teacher_id: newTarget.teacher_id, monthly_package_target: newTarget.monthly_package_target,
    }, { onConflict: "teacher_id" });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Meta salva" });
    setNewTarget({ teacher_id: "", monthly_package_target: 4 });
    load();
  };

  const removeTarget = async (id: string) => {
    await supabase.from("teacher_monthly_targets").delete().eq("id", id);
    load();
  };

  if (loading || !cfg) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const cfgField = (label: string, key: keyof CompConfig, suffix?: string, step = "0.01") => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input type="number" step={step} value={(cfg as any)[key]} onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) } as CompConfig)} />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2"><SettingsIcon className="h-5 w-5" /> Remuneração de Professores</h2>
          <p className="text-sm text-muted-foreground">Configure taxas, comissões, regras do Pool e bônus de qualidade.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => runPayout(false)} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Apurar mês anterior
          </Button>
          <Button variant="outline" onClick={() => runPayout(true)} disabled={running}>
            <RefreshCw className="h-4 w-4 mr-2" /> Recalcular (force)
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <h3 className="font-medium mb-3">1. Taxa de inserção</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {cfgField("Valor por pacote completo", "package_fee_brl", "R$")}
          {cfgField("Meta padrão de pacotes/mês", "default_monthly_package_target", "pacotes", "1")}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-3">2. Pool de Assinaturas</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {cfgField("% da receita líquida ao Pool", "pool_net_revenue_pct", "%")}
          {cfgField("Piso por acesso único", "pool_min_per_access_brl", "R$")}
          {cfgField("Teto máximo por professor", "pool_max_share_pct", "%")}
          {cfgField("Material textual = X min de vídeo", "material_access_minutes_equivalent", "min", "1")}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-3">3. Bônus</h3>
        <div className="grid md:grid-cols-4 gap-3">
          {cfgField("Avaliação mínima (Qualidade)", "quality_bonus_min_rating", "★", "0.1")}
          {cfgField("% Bônus de Qualidade", "quality_bonus_pct", "%", "1")}
          {cfgField("RF Score mínimo", "rf_score_bonus_min", "/10", "0.1")}
          {cfgField("% Bônus RF Score", "rf_score_bonus_pct", "%", "1")}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-3">RF Score — pesos</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div><Label className="text-xs">Inserção (%)</Label><Input type="number" value={cfg.rf_weights.content_insertion} onChange={(e) => setCfg({ ...cfg, rf_weights: { ...cfg.rf_weights, content_insertion: Number(e.target.value) } })} /></div>
          <div><Label className="text-xs">Aulas (%)</Label><Input type="number" value={cfg.rf_weights.lessons_delivered} onChange={(e) => setCfg({ ...cfg, rf_weights: { ...cfg.rf_weights, lessons_delivered: Number(e.target.value) } })} /></div>
          <div><Label className="text-xs">Dúvidas (%)</Label><Input type="number" value={cfg.rf_weights.doubts_answered} onChange={(e) => setCfg({ ...cfg, rf_weights: { ...cfg.rf_weights, doubts_answered: Number(e.target.value) } })} /></div>
          <div><Label className="text-xs">Agenda (%)</Label><Input type="number" value={cfg.rf_weights.agenda_updated} onChange={(e) => setCfg({ ...cfg, rf_weights: { ...cfg.rf_weights, agenda_updated: Number(e.target.value) } })} /></div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Soma deve totalizar 100%.</p>
      </Card>

      {/* Alertas de proximidade (piso/teto) */}
      <Card className="p-4">
        {(() => {
          const pa = cfg.proximity_alerts ?? DEFAULT_PROXIMITY;
          const updatePa = (patch: Partial<ProximityAlertsConfig>) => setCfg(setProximity(cfg, patch));
          return (
            <>
              <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h3 className="font-medium">Alertas de proximidade (piso/teto)</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure quando avisar o professor de que ele está perto do teto ou prestes a acionar o piso, e personalize textos e cores dos alertas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ativar alertas</Label>
                  <Switch checked={!!pa.enabled} onCheckedChange={(v) => updatePa({ enabled: v })} />
                </div>
              </div>

              {/* Limiares */}
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div>
                  <Label className="text-xs">Limiar de proximidade do TETO (% do teto)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={50} max={99} step={1}
                      value={pa.near_cap_threshold_pct}
                      onChange={(e) => updatePa({ near_cap_threshold_pct: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Mostra o alerta quando a fatia proporcional atinge esse % do teto. Ex: 80% → avisa a partir de 80% do limite.</p>
                </div>
                <div>
                  <Label className="text-xs">Limiar de proximidade do PISO (proporcional ÷ piso)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={100} max={300} step={1}
                      value={pa.near_floor_ratio_pct}
                      onChange={(e) => updatePa({ near_floor_ratio_pct: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Avisa quando o cálculo proporcional está até esse % acima do piso. Ex: 120% → avisa quando proporcional ≤ 1,2× o piso.</p>
                </div>
              </div>

              {/* Cores */}
              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <div>
                  <Label className="text-xs">Cor do alerta de TETO (HSL)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={pa.cap_color_hsl}
                      onChange={(e) => updatePa({ cap_color_hsl: e.target.value })}
                      placeholder="217 91% 60%"
                    />
                    <ColorSwatch hsl={isValidHsl(pa.cap_color_hsl) ? pa.cap_color_hsl : "217 91% 60%"} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Formato HSL sem vírgulas, ex: <code className="px-1 rounded bg-muted">217 91% 60%</code></p>
                </div>
                <div>
                  <Label className="text-xs">Cor do alerta de PISO (HSL)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={pa.floor_color_hsl}
                      onChange={(e) => updatePa({ floor_color_hsl: e.target.value })}
                      placeholder="38 92% 50%"
                    />
                    <ColorSwatch hsl={isValidHsl(pa.floor_color_hsl) ? pa.floor_color_hsl : "38 92% 50%"} />
                  </div>
                </div>
              </div>

              {/* Textos */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{TOKEN_HELP}</p>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Próximo do teto — Título</Label>
                    <Input value={pa.near_cap_title} onChange={(e) => updatePa({ near_cap_title: e.target.value })} />
                    <Label className="text-xs mt-2 block">Próximo do teto — Mensagem</Label>
                    <Textarea rows={3} value={pa.near_cap_body} onChange={(e) => updatePa({ near_cap_body: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Teto atingido — Título</Label>
                    <Input value={pa.cap_applied_title} onChange={(e) => updatePa({ cap_applied_title: e.target.value })} />
                    <Label className="text-xs mt-2 block">Teto atingido — Mensagem</Label>
                    <Textarea rows={3} value={pa.cap_applied_body} onChange={(e) => updatePa({ cap_applied_body: e.target.value })} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Próximo do piso — Título</Label>
                    <Input value={pa.near_floor_title} onChange={(e) => updatePa({ near_floor_title: e.target.value })} />
                    <Label className="text-xs mt-2 block">Próximo do piso — Mensagem</Label>
                    <Textarea rows={3} value={pa.near_floor_body} onChange={(e) => updatePa({ near_floor_body: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Piso aplicado — Título</Label>
                    <Input value={pa.floor_applied_title} onChange={(e) => updatePa({ floor_applied_title: e.target.value })} />
                    <Label className="text-xs mt-2 block">Piso aplicado — Mensagem</Label>
                    <Textarea rows={3} value={pa.floor_applied_body} onChange={(e) => updatePa({ floor_applied_body: e.target.value })} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => updatePa({ ...DEFAULT_PROXIMITY })}>
                    Restaurar padrões
                  </Button>
                </div>
              </div>
            </>
          );
        })()}
      </Card>

      {/* Mensagens contextuais do tooltip do gráfico de tendência */}
      <Card className="p-4">
        {(() => {
          const tt = mergeTooltipMessages(cfg.tooltip_messages);
          const updateMetric = (metric: TooltipMetricKey, rawValue: string) =>
            setCfg(updateMetricWithValidation(cfg, metric, rawValue));
          const updateMetricMessage = (metric: TooltipMetricKey, patch: Partial<TooltipMetricMessages>) =>
            setCfg(setTooltipMetric(cfg, metric, patch));
          const reset = () => {
            setThresholdErrors({});
            setThresholdInputs({});
            setCfg({ ...cfg, tooltip_messages: { ...DEFAULT_TOOLTIP_MESSAGES } });
          };

          const metricKeys: TooltipMetricKey[] = ["rf", "qb", "share", "pool"];

          return (
            <>
              <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                <div>
                  <h3 className="font-medium">Mensagens do tooltip do gráfico</h3>
                  <p className="text-xs text-muted-foreground">
                    Personalize as frases contextuais e os limiares de "variação expressiva" mostrados no gráfico de tendência do professor.
                    Para cada métrica, defina o que aparece em altas/baixas leves, fortes, estabilidade e quando não há comparação.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Ativar mensagens</Label>
                  <Switch
                    checked={!!tt.enabled}
                    onCheckedChange={(v) => setCfg(setTooltipEnabled(cfg, v))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                {metricKeys.map((m) => {
                  const data = tt[m];
                  return (
                    <div key={m} className="rounded-lg border border-border p-3 bg-secondary/20">
                      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
                        <div>
                          <p className="font-medium text-sm">{TOOLTIP_METRIC_LABELS[m]}</p>
                          <p className="text-[11px] text-muted-foreground">{TOOLTIP_METRIC_UNIT_HINT[m]}</p>
                        </div>
                        <div className="w-44">
                          <Label className={cn("text-xs", thresholdErrors[m] && "text-destructive")}>
                            Limiar "variação forte"
                          </Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={thresholdInputs[m] ?? String(data.strong_threshold)}
                              onChange={(e) =>
                                updateMetric(m, e.target.value)
                              }
                              className={cn(thresholdErrors[m] && "border-destructive focus-visible:ring-destructive")}
                              aria-invalid={!!thresholdErrors[m]}
                              aria-describedby={thresholdErrors[m] ? `error-${m}` : undefined}
                              placeholder="0.0"
                            />
                            <span className="text-xs text-muted-foreground">{m === "qb" || m === "share" ? "p.p." : "%"}</span>
                          </div>
                          {thresholdErrors[m] && (
                            <div id={`error-${m}`} className="flex items-center gap-1 mt-1 text-[11px] text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              <span>{thresholdErrors[m]}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Alta leve</Label>
                          <Textarea rows={2} value={data.up} onChange={(e) => updateMetricMessage(m, { up: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Alta forte (≥ limiar)</Label>
                          <Textarea rows={2} value={data.up_strong} onChange={(e) => updateMetricMessage(m, { up_strong: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Queda leve</Label>
                          <Textarea rows={2} value={data.down} onChange={(e) => updateMetricMessage(m, { down: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Queda forte (≥ limiar)</Label>
                          <Textarea rows={2} value={data.down_strong} onChange={(e) => updateMetricMessage(m, { down_strong: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Estável</Label>
                          <Textarea rows={2} value={data.stable} onChange={(e) => updateMetricMessage(m, { stable: e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Sem dados (sem mês anterior)</Label>
                          <Textarea rows={2} value={data.no_data} onChange={(e) => updateMetricMessage(m, { no_data: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={reset}>
                    Restaurar padrões
                  </Button>
                </div>
              </div>
            </>
          );
        })()}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || hasThresholdErrors}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {hasThresholdErrors ? "Corrija os erros para salvar" : "Salvar configurações"}
        </Button>
      </div>

      <Card className="p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Metas individuais (override)</h3>
        <div className="flex flex-wrap gap-2 mb-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Professor</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={newTarget.teacher_id} onChange={(e) => setNewTarget({ ...newTarget, teacher_id: e.target.value })}>
              <option value="">Selecione...</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="w-32"><Label className="text-xs">Meta/mês</Label><Input type="number" value={newTarget.monthly_package_target} onChange={(e) => setNewTarget({ ...newTarget, monthly_package_target: Number(e.target.value) })} /></div>
          <Button onClick={addTarget}>Salvar meta</Button>
        </div>
        {targets.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma meta individual. Todos seguem o padrão global ({cfg.default_monthly_package_target}).</p>
        ) : (
          <div className="space-y-1">
            {targets.map((t) => {
              const teacher = teachers.find((x) => x.id === t.teacher_id);
              return (
                <div key={t.id} className="flex items-center justify-between text-sm p-2 rounded bg-secondary/40">
                  <span>{teacher?.name ?? t.teacher_id.slice(0, 8)}</span>
                  <span className="font-medium">{t.monthly_package_target} pacotes/mês</span>
                  <Button size="sm" variant="ghost" onClick={() => removeTarget(t.id)}>Remover</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-medium mb-3">Histórico de apurações (Pool)</h3>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma apuração executada ainda.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50"><tr className="text-left">
                <th className="px-3 py-2 font-medium">Período</th>
                <th className="px-3 py-2 font-medium text-right">Receita bruta</th>
                <th className="px-3 py-2 font-medium text-right">Pool</th>
                <th className="px-3 py-2 font-medium text-right">Distribuído</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Quando</th>
              </tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{r.period_start} → {r.period_end}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(Number(r.subscription_gross_revenue))}</td>
                    <td className="px-3 py-2 text-right">{formatBRL(Number(r.pool_amount))}</td>
                    <td className="px-3 py-2 text-right text-primary">{formatBRL(Number(r.total_distributed))}</td>
                    <td className="px-3 py-2"><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{formatDate(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminCompensationConfigTab;
