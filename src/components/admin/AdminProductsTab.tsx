import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Boxes, Save, Loader2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { activeSubproducts, FALLBACK_SUBPRODUCTS, type Subproduct } from "@/hooks/useProducts";
import { Plus, Trash2 } from "lucide-react";
import { PRODUCT_ICONS, productIcon, reloadProducts, updateProductDraft, useProducts, type Product } from "@/hooks/useProducts";

const SHARED_FIELDS = ["badge", "headline", "input_hint"] as const;

export default function AdminProductsTab() {
  const loaded = useProducts(true);
  const [items, setItems] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  // Primeira carga: copia tudo. Depois: só sincroniza as frases compartilhadas com Identidade Visual,
  // sem perder edições locais (ordem, subprodutos etc.).
  useEffect(() => {
    setItems((cur) => {
      if (!cur.length) return loaded.map((p) => ({ ...p, subproducts: p.subproducts?.length ? p.subproducts : FALLBACK_SUBPRODUCTS[p.key] || [] }));
      return cur.map((p) => {
        const src = loaded.find((l) => l.key === p.key);
        if (!src) return p;
        const next = { ...p };
        SHARED_FIELDS.forEach((f) => { (next as any)[f] = src[f]; });
        return next;
      });
    });
  }, [loaded]);
  void activeSubproducts;
  const updSub = (i: number, j: number, patch: Partial<Subproduct> | null) =>
    setItems((cur) => cur.map((p, idx) => {
      if (idx !== i) return p;
      const list = [...(p.subproducts || [])];
      if (patch === null) list.splice(j, 1); else list[j] = { ...list[j], ...patch };
      return { ...p, subproducts: list };
    }));
  const addSub = (i: number) =>
    setItems((cur) => cur.map((p, idx) => idx === i ? { ...p, subproducts: [...(p.subproducts || []), { key: `sub_${Date.now()}`, name: "Novo subproduto", kind: "ai", tool: "revisao", active: true }] } : p));

  const upd = (i: number, field: keyof Product, value: unknown) => {
    setItems((cur) => cur.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
    if ((SHARED_FIELDS as readonly string[]).includes(field as string) && items[i]) {
      updateProductDraft(items[i].key, { [field]: value } as Partial<Product>);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const save = async () => {
    setSaving(true);
    // As frases vêm sempre do valor mais recente (compartilhado com Identidade Visual).
    const rows = items.map((p, i) => {
      const fresh = loaded.find((l) => l.key === p.key);
      const row: any = { ...p, sort_order: i + 1, updated_at: new Date().toISOString() };
      if (fresh) SHARED_FIELDS.forEach((f) => { row[f] = (fresh as any)[f]; });
      return row;
    });
    const { error } = await supabase.from("products").upsert(rows as never);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar: " + error.message); return; }
    await reloadProducts();
    toast.success("Produtos atualizados.");
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Boxes className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Produtos</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Ative ou desative produtos, mude a ordem e edite os textos da página inicial e da página de cada produto. Os planos de cada produto ficam em Planos.
      </p>

      <div className="space-y-4">
        {items.map((p, i) => {
          const Icon = productIcon(p.icon);
          return (
            <Card key={p.key} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{p.name}</span>
                  <a href={`/${p.key}`} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
                    /{p.key} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Descer"><ArrowDown className="h-4 w-4" /></Button>
                  <Label className="text-xs">Ativo</Label>
                  <Switch checked={p.active} onCheckedChange={(v) => upd(i, "active", v)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label>Nome (aba e menu)</Label><Input value={p.name} onChange={(e) => upd(i, "name", e.target.value)} /></div>
                <div>
                  <Label>Ícone</Label>
                  <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={p.icon} onChange={(e) => upd(i, "icon", e.target.value)}>
                    {Object.keys(PRODUCT_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div><Label>Texto do botão</Label><Input value={p.cta} onChange={(e) => upd(i, "cta", e.target.value)} /></div>
              </div>
              <div><Label>Título</Label><Input value={p.title} onChange={(e) => upd(i, "title", e.target.value)} /></div>
              <div><Label>Descrição (página inicial)</Label><Textarea rows={2} value={p.description} onChange={(e) => upd(i, "description", e.target.value)} /></div>
              <div><Label>Frase de destaque (acima da pergunta na página inicial)</Label><Input value={p.badge || ""} onChange={(e) => upd(i, "badge", e.target.value)} /></div>
              <div><Label>Pergunta principal (o nome do usuário logado entra antes do "?")</Label><Input value={p.headline || ""} onChange={(e) => upd(i, "headline", e.target.value)} /></div>
              <div><Label>Frase-guia da caixa de digitação</Label><Input value={p.input_hint || ""} onChange={(e) => upd(i, "input_hint", e.target.value)} /></div>
              <div><Label>Texto da página do produto</Label><Textarea rows={2} value={p.page_intro} onChange={(e) => upd(i, "page_intro", e.target.value)} /></div>
              <div className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label>Subprodutos (aparecem no menu e como atalhos na caixa de digitação)</Label>
                  <Button size="sm" variant="outline" onClick={() => addSub(i)}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {(p.subproducts || []).map((s, j) => (
                    <div key={s.key} className="grid items-center gap-2 sm:grid-cols-[1fr_150px_1fr_auto_auto]">
                      <Input value={s.name} onChange={(e) => updSub(i, j, { name: e.target.value })} />
                      <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={s.kind === "link" ? "link" : s.tool || "revisao"}
                        onChange={(e) => { const v = e.target.value; updSub(i, j, v === "link" ? { kind: "link", href: s.href || "/" } : { kind: "ai", tool: v as Subproduct["tool"] }); }}>
                        <option value="revisao">Gerar revisão</option>
                        <option value="resumo">Gerar resumo</option>
                        <option value="simulado">Gerar simulado</option>
                        <option value="top_questoes">Gerar Top Questões</option>
                        <option value="colinha">Gerar colinha</option>
                        <option value="trabalho">Gerar trabalho</option>
                        <option value="link">Abrir página</option>
                      </select>
                      {s.kind === "link"
                        ? <Input placeholder="Endereço, ex.: /#agendar-aula" value={s.href || ""} onChange={(e) => updSub(i, j, { href: e.target.value })} />
                        : <span className="text-xs text-muted-foreground">Abre o gerador com esse pedido</span>}
                      <Switch checked={s.active !== false} onCheckedChange={(v) => updSub(i, j, { active: v })} />
                      <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => updSub(i, j, null)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Button className="mt-6" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar produtos
      </Button>
    </div>
  );
}
