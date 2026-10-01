import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const LISTS: Record<string, { key: string; label: string }[]> = {
  enem: [{ key: "areas", label: "Áreas" }],
  oab: [{ key: "fases", label: "Fases" }],
  vestibulares: [{ key: "vestibulares", label: "Vestibulares" }, { key: "fases", label: "Fases" }],
  concursos: [{ key: "bancas", label: "Bancas" }, { key: "cargos", label: "Cargos" }, { key: "disciplinas", label: "Disciplinas" }, { key: "fases", label: "Fases" }],
};
const NAMES: Record<string, string> = { enem: "ENEM", oab: "OAB", vestibulares: "Vestibulares", concursos: "Concursos" };
type Rule = { duration_min?: number; has_essay?: boolean; instructions?: string };

/** Opções das listas de seleção e configuração do simulado de ENEM, OAB, Vestibulares e Concursos. */
export default function ProductExamSettings() {
  const [rows, setRows] = useState<Record<string, { opts: Record<string, string>; cfg: any }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("products").select("key, selector_options, simulado_config").in("key", Object.keys(LISTS)).then(({ data }) => {
      const r: any = {};
      (data || []).forEach((p: any) => {
        const opts: Record<string, string> = {};
        LISTS[p.key].forEach((l) => { opts[l.key] = ((p.selector_options || {})[l.key] || []).join("\n"); });
        r[p.key] = { opts, cfg: { default: {}, by_option: {}, ...(p.simulado_config || {}) } };
      });
      setRows(r);
    });
  }, []);

  const upd = (key: string, fn: (v: any) => void) => setRows((r) => { const n = structuredClone(r); fn(n[key]); return n; });

  const save = async (key: string) => {
    setSaving(key);
    const row = rows[key];
    const selector_options: Record<string, string[]> = {};
    Object.entries(row.opts).forEach(([k, v]) => { selector_options[k] = v.split("\n").map((s) => s.trim()).filter(Boolean); });
    const { error } = await supabase.from("products").update({ selector_options, simulado_config: row.cfg }).eq("key", key);
    setSaving(null);
    if (error) toast.error("Não foi possível salvar."); else toast.success(`Configuração de ${NAMES[key]} salva.`);
  };

  const RuleEditor = ({ k, rule, path, title }: { k: string; rule: Rule; path: string | null; title: string }) => {
    const set = (patch: Partial<Rule>) => upd(k, (v) => { if (path) v.cfg.by_option[path] = { ...(v.cfg.by_option[path] || {}), ...patch }; else v.cfg.default = { ...v.cfg.default, ...patch }; });
    return (
      <div className="grid gap-2 rounded-md bg-muted p-3 sm:grid-cols-[1fr_140px_auto]">
        <p className="text-sm font-medium sm:col-span-3">{title}</p>
        <Input placeholder="Instruções (nº de questões, blocos/cadernos, pontuação)" value={rule.instructions || ""} onChange={(e) => set({ instructions: e.target.value })} />
        <Input type="number" placeholder="Tempo (min)" value={rule.duration_min ?? ""} onChange={(e) => set({ duration_min: Number(e.target.value) || undefined })} />
        <label className="flex items-center gap-2 text-xs"><Switch checked={!!rule.has_essay} onCheckedChange={(c) => set({ has_essay: c })} />Redação/discursiva</label>
        {path && <Button size="sm" variant="ghost" className="justify-self-start text-destructive" onClick={() => upd(k, (v) => { delete v.cfg.by_option[path]; })}>Remover regra</Button>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold">Provas reais: listas de seleção e simulado</h3>
        <p className="text-sm text-muted-foreground">Estas opções aparecem nas páginas de ENEM, OAB, Vestibulares e Concursos. Uma opção por linha. Anos, números de exame e datas vêm das provas cadastradas em "Provas Reais".</p>
      </div>
      {Object.keys(LISTS).filter((k) => rows[k]).map((k) => {
        const row = rows[k];
        const optionKey = k === "enem" ? "areas" : "fases";
        const optionValues = row.opts[optionKey]?.split("\n").map((s) => s.trim()).filter(Boolean) || [];
        return (
          <div key={k} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h4 className="font-semibold">{NAMES[k]}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {LISTS[k].map((l) => (
                <div key={l.key}><Label>{l.label}</Label>
                  <Textarea rows={4} value={row.opts[l.key]} onChange={(e) => upd(k, (v) => { v.opts[l.key] = e.target.value; })} /></div>
              ))}
            </div>
            <p className="text-sm font-medium">Simulado</p>
            <RuleEditor k={k} rule={row.cfg.default || {}} path={null} title="Regra padrão" />
            {optionValues.map((o) => (
              <RuleEditor key={o} k={k} rule={row.cfg.by_option?.[o] || {}} path={o} title={`Quando escolher "${o}" (vazio = usa a padrão)`} />
            ))}
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <div><Label>Critérios de correção da redação/discursivas</Label>
                <Textarea rows={3} value={row.cfg.essay_criteria || ""} onChange={(e) => upd(k, (v) => { v.cfg.essay_criteria = e.target.value; })} /></div>
              <div><Label>Nota de corte (%)</Label>
                <Input type="number" value={row.cfg.pass_percent ?? ""} onChange={(e) => upd(k, (v) => { v.cfg.pass_percent = Number(e.target.value) || undefined; })} /></div>
            </div>
            <Button onClick={() => save(k)} disabled={saving === k}>{saving === k ? "Salvando…" : `Salvar ${NAMES[k]}`}</Button>
          </div>
        );
      })}
    </div>
  );
}
