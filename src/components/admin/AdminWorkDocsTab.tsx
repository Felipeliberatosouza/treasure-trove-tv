import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Save, Trash2, Eye, DollarSign } from "lucide-react";
import type { WorkContent } from "@/lib/workDocument";

interface Pricing {
  credits_generation: number;
  credits_interaction: number;
  provider_cost_generation: number;
  provider_cost_interaction: number;
  price_generation: number;
  price_interaction: number;
}

const DEFAULT_PRICING: Pricing = {
  credits_generation: 2,
  credits_interaction: 1,
  provider_cost_generation: 0.35,
  provider_cost_interaction: 0.12,
  price_generation: 4.9,
  price_interaction: 1.9,
};

interface DocRow {
  id: string;
  user_id: string;
  titulo: string;
  tema: string;
  disciplina: string | null;
  credits_spent: number;
  provider_cost: number;
  reused: boolean;
  created_at: string;
  content: WorkContent;
}

const AdminWorkDocsTab = () => {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DocRow | null>(null);

  const load = async () => {
    const [{ data: setting }, { data: docs }] = await Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "work_documents_pricing").maybeSingle(),
      supabase
        .from("work_documents")
        .select("id, user_id, titulo, tema, disciplina, credits_spent, provider_cost, reused, created_at, content")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (setting?.value) setPricing({ ...DEFAULT_PRICING, ...(setting.value as Partial<Pricing>) });
    const list = (docs ?? []) as unknown as DocRow[];
    setRows(list);
    const ids = Array.from(new Set(list.map((d) => d.user_id)));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      const map: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { map[p.id] = p.name || p.email || p.id; });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const savePricing = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "work_documents_pricing", value: pricing as unknown as any }, { onConflict: "key" });
    setSaving(false);
    toast(
      error
        ? { title: "Erro", description: "Não foi possível salvar.", variant: "destructive" }
        : { title: "Salvo", description: "Custos e preços atualizados." },
    );
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("work_documents").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" });
      return;
    }
    setRows((r) => r.filter((d) => d.id !== id));
    toast({ title: "Excluído", description: "Trabalho removido." });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.titulo.toLowerCase().includes(q) ||
        r.tema.toLowerCase().includes(q) ||
        (names[r.user_id] || "").toLowerCase().includes(q),
    );
  }, [rows, search, names]);

  const totals = useMemo(
    () => ({
      custo: rows.reduce((s, r) => s + Number(r.provider_cost || 0), 0),
      creditos: rows.reduce((s, r) => s + Number(r.credits_spent || 0), 0),
      reaproveitados: rows.filter((r) => r.reused).length,
    }),
    [rows],
  );

  const margem = pricing.price_generation - pricing.provider_cost_generation;
  const margemInteracao = pricing.price_interaction - pricing.provider_cost_interaction;

  const num = (v: number, set: (n: number) => void) => (
    <Input type="number" min={0} step="1" className="h-9" value={v} onChange={(e) => set(parseInt(e.target.value, 10) || 0)} />
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <DollarSign className="h-5 w-5" /> Custo e preço dos Trabalhos com IA
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Defina quantos Créditos de IA são cobrados do aluno, o custo que a plataforma tem com o fornecedor de IA
          e o preço cobrado. A margem é calculada automaticamente.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">Geração do material</p>
              <label className="block text-xs text-muted-foreground">Créditos de IA cobrados</label>
              {num(pricing.credits_generation, (n) => setPricing((p) => ({ ...p, credits_generation: n })))}
              <label className="block text-xs text-muted-foreground">Custo com o fornecedor de IA (R$)</label>
              <CurrencyInput className="h-9" value={pricing.provider_cost_generation} onValueChange={(v) => setPricing((p) => ({ ...p, provider_cost_generation: v }))} />
              <label className="block text-xs text-muted-foreground">Preço cobrado do usuário (R$)</label>
              <CurrencyInput className="h-9" value={pricing.price_generation} onValueChange={(v) => setPricing((p) => ({ ...p, price_generation: v }))} />
              <p className="text-sm">Margem: <strong className={margem >= 0 ? "text-success" : "text-destructive"}>R$ {margem.toFixed(2)}</strong></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="font-semibold">Interação de ajuste</p>
              <label className="block text-xs text-muted-foreground">Créditos de IA cobrados</label>
              {num(pricing.credits_interaction, (n) => setPricing((p) => ({ ...p, credits_interaction: n })))}
              <label className="block text-xs text-muted-foreground">Custo com o fornecedor de IA (R$)</label>
              <CurrencyInput className="h-9" value={pricing.provider_cost_interaction} onValueChange={(v) => setPricing((p) => ({ ...p, provider_cost_interaction: v }))} />
              <label className="block text-xs text-muted-foreground">Preço cobrado do usuário (R$)</label>
              <CurrencyInput className="h-9" value={pricing.price_interaction} onValueChange={(v) => setPricing((p) => ({ ...p, price_interaction: v }))} />
              <p className="text-sm">Margem: <strong className={margemInteracao >= 0 ? "text-success" : "text-destructive"}>R$ {margemInteracao.toFixed(2)}</strong></p>
            </CardContent>
          </Card>
        </div>
        <Button className="mt-4" onClick={savePricing} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar custos e preços"}
        </Button>
      </div>

      <div>
        <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
          <FileText className="h-5 w-5" /> Trabalhos gerados
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {rows.length} trabalho(s) • {totals.reaproveitados} reaproveitado(s) do acervo •
          custo total com IA R$ {totals.custo.toFixed(2)} • {totals.creditos} Crédito(s) de IA consumidos.
        </p>
        <Input
          placeholder="Buscar por título, tema ou aluno"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-3 max-w-sm"
        />
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-24">Créditos</TableHead>
                  <TableHead className="w-28">Custo IA</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {r.titulo}
                      {r.reused && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">reaproveitado</span>}
                    </TableCell>
                    <TableCell className="text-sm">{names[r.user_id] || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{r.credits_spent}</TableCell>
                    <TableCell className="text-sm">R$ {Number(r.provider_cost || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPreview(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void remove(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.titulo}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4 text-sm">
              {(preview.content?.secoes ?? []).map((s, i) => (
                <section key={i}>
                  <p className="font-semibold">{s.titulo}</p>
                  {(s.paragrafos ?? []).map((p, j) => (
                    <p key={j} className="mb-2 text-muted-foreground">{p}</p>
                  ))}
                </section>
              ))}
              <section>
                <p className="font-semibold">Slides</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  {(preview.content?.slides ?? []).map((s, i) => <li key={i}>{s.titulo}</li>)}
                </ol>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWorkDocsTab;
