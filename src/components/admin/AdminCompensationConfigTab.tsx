import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play, RefreshCw, Settings as SettingsIcon, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

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
    const { error } = await supabase.from("platform_settings").upsert({ key: "teacher_compensation", value: cfg as any });
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

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar configurações</Button>
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
