import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { DEFAULT_SEASONAL_CONFIG, EFFECT_OPTIONS, type SeasonalConfig, type SeasonalEvent } from "@/lib/seasonal";

const MODES: { value: SeasonalConfig["mode"]; label: string; hint: string }[] = [
  { value: "on", label: "Ligado ao entrar", hint: "O tema aparece ligado; o usuário pode desligar." },
  { value: "off", label: "Desligado ao entrar", hint: "O tema começa desligado; o usuário pode ligar pelo ícone." },
  { value: "disabled", label: "Nenhum evento em execução", hint: "Nenhum tema nem aniversário aparece no site." },
];

const toInput = (md: string) => `2026-${md}`;
const fromInput = (v: string) => v.slice(5, 10);

const SettingsSeasonal = () => {
  const [config, setConfig] = useState<SeasonalConfig>(DEFAULT_SEASONAL_CONFIG);
  const [events, setEvents] = useState<SeasonalEvent[]>([]);

  const load = async () => {
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "seasonal_themes").maybeSingle(),
      supabase.from("seasonal_events").select("*").order("start_md"),
    ]);
    if (s?.value) setConfig({ ...DEFAULT_SEASONAL_CONFIG, ...(s.value as any) });
    setEvents((e as SeasonalEvent[]) || []);
  };
  useEffect(() => { load(); }, []);

  const saveConfig = async (next: SeasonalConfig) => {
    setConfig(next);
    const { error } = await supabase.from("platform_settings").upsert({ key: "seasonal_themes", value: next as any }, { onConflict: "key" });
    if (error) toast.error("Não foi possível salvar a configuração."); else toast.success("Configuração salva.");
  };

  const patch = (id: string, p: Partial<SeasonalEvent>) => setEvents((l) => l.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const saveEvent = async (e: SeasonalEvent) => {
    if (!e.name.trim()) return toast.error("Informe o nome do evento.");
    const { id, ...rest } = e;
    const { error } = await supabase.from("seasonal_events").update(rest as any).eq("id", id);
    if (error) toast.error("Não foi possível salvar o evento."); else toast.success(`"${e.name}" salvo.`);
  };

  const addEvent = async () => {
    const { error } = await supabase.from("seasonal_events").insert({ name: "Novo evento", start_md: "01-01", end_md: "01-07", icon: "🎉", effect: "confetti", active: false });
    if (error) toast.error("Não foi possível criar o evento."); else load();
  };

  const removeEvent = async (e: SeasonalEvent) => {
    if (!confirm(`Excluir o evento "${e.name}"?`)) return;
    const { error } = await supabase.from("seasonal_events").delete().eq("id", e.id);
    if (error) toast.error("Não foi possível excluir."); else load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Funcionamento no site</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => saveConfig({ ...config, mode: m.value })}
              className={`rounded-lg border p-3 text-left text-sm ${config.mode === m.value ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-muted-foreground">{m.hint}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch id="bday" checked={config.birthday_enabled} onCheckedChange={(v) => saveConfig({ ...config, birthday_enabled: v })} />
          <Label htmlFor="bday">Mostrar "Parabéns! Feliz Aniversário, (nome)!" no dia do aniversário do usuário</Label>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Eventos anuais</h3>
          <Button size="sm" onClick={addEvent}><Plus className="h-4 w-4 mr-1" /> Novo evento</Button>
        </div>
        <p className="text-xs text-muted-foreground">Se dois eventos coincidirem, aparece o de maior prioridade. O ano das datas é ignorado — o evento se repete todo ano.</p>
        {events.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card p-4 grid gap-3 md:grid-cols-6 items-end">
            <div className="md:col-span-2"><Label>Nome</Label><Input value={e.name} onChange={(x) => patch(e.id, { name: x.target.value })} /></div>
            <div><Label>Início</Label><Input type="date" value={toInput(e.start_md)} onChange={(x) => patch(e.id, { start_md: fromInput(x.target.value) })} /></div>
            <div><Label>Fim</Label><Input type="date" value={toInput(e.end_md)} onChange={(x) => patch(e.id, { end_md: fromInput(x.target.value) })} /></div>
            <div><Label>Ícone (emoji)</Label><Input value={e.icon} maxLength={4} onChange={(x) => patch(e.id, { icon: x.target.value })} /></div>
            <div><Label>Prioridade</Label><Input type="number" value={e.priority} onChange={(x) => patch(e.id, { priority: Number(x.target.value) || 0 })} /></div>
            <div className="md:col-span-2"><Label>Efeito</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm" value={e.effect} onChange={(x) => patch(e.id, { effect: x.target.value })}>
                {EFFECT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select></div>
            <div><Label>Cor do brilho</Label><Input type="color" value={e.primary_color} onChange={(x) => patch(e.id, { primary_color: x.target.value })} /></div>
            <div className="md:col-span-3"><Label>Mensagem</Label><Input value={e.message || ""} onChange={(x) => patch(e.id, { message: x.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={e.dark_mode} onCheckedChange={(v) => patch(e.id, { dark_mode: v })} /><span className="text-xs">Inverter claro/escuro</span></div>
            <div className="flex items-center gap-2"><Switch checked={e.active} onCheckedChange={(v) => patch(e.id, { active: v })} /><span className="text-xs">Ativo</span></div>
            <div className="md:col-span-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => removeEvent(e)}><Trash2 className="h-4 w-4" /></Button>
              <Button size="sm" onClick={() => saveEvent(e)}>Salvar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingsSeasonal;
