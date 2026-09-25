import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { productIcon, reloadProducts, useProducts, type Product } from "@/hooks/useProducts";

/** Frases da página inicial por produto: destaque, pergunta principal (fixa) e frase-guia. */
export default function ProductPhrasesEditor() {
  const loaded = useProducts(true);
  const [items, setItems] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setItems(loaded.map((p) => ({ ...p }))); }, [loaded]);

  const [dirty, setDirty] = useState(false);
  const upd = (key: string, field: "badge" | "headline" | "input_hint", value: string) => {
    setDirty(true);
    setItems((cur) => cur.map((p) => (p.key === key ? { ...p, [field]: value } : p)));
  };

  const save = async (silent = false) => {
    setSaving(true);
    const now = new Date().toISOString();
    for (const p of items) {
      const { error } = await supabase.from("products")
        .update({ badge: p.badge ?? null, headline: p.headline ?? null, input_hint: p.input_hint ?? null, updated_at: now } as any)
        .eq("key", p.key);
      if (error) { setSaving(false); toast.error("Não foi possível salvar as frases: " + error.message); return; }
    }
    setSaving(false);
    setDirty(false);
    await reloadProducts();
    toast.success(silent ? "Frases dos produtos salvas automaticamente." : "Frases dos produtos salvas.");
  };

  // Salva sozinho 1,5s depois da última digitação, para não depender do botão.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => save(true), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, dirty]);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Frases da Página Inicial (por produto)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada produto tem 3 frases fixas. A pergunta principal não muda sozinha; para quem está logado, o primeiro nome entra depois de uma vírgula, antes do "?".
        </p>
      </div>
      {items.map((p) => {
        const Icon = productIcon(p.icon);
        return (
          <div key={p.key} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center gap-2 font-semibold">
              <Icon className="h-4 w-4 text-primary" /> {p.name}
            </div>
            <div>
              <Label className="text-xs">1. Frase de destaque</Label>
              <Input value={p.badge || ""} onChange={(e) => upd(p.key, "badge", e.target.value)} placeholder="Ex.: Seu Kit de Revisão completo em poucos minutos" />
            </div>
            <div>
              <Label className="text-xs">2. Pergunta principal</Label>
              <Input value={p.headline || ""} onChange={(e) => upd(p.key, "headline", e.target.value)} placeholder="Ex.: Qual o assunto da sua próxima prova?" />
            </div>
            <div>
              <Label className="text-xs">3. Frase-guia da caixa de digitação</Label>
              <Input value={p.input_hint || ""} onChange={(e) => upd(p.key, "input_hint", e.target.value)} placeholder="Ex.: Digite o assunto ou tópicos da sua prova..." />
            </div>
          </div>
        );
      })}
      <Button type="button" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar frases dos produtos
      </Button>
    </div>
  );
}
