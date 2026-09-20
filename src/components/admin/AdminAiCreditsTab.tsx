import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Sparkles } from "lucide-react";

interface CreditPackage {
  id?: string;
  name: string;
  credits: number;
  price: number;
  highlighted: boolean;
  active: boolean;
  sort_order: number;
}

interface PurchaseRow {
  id: string;
  user_id: string;
  package_name: string;
  credits: number;
  amount: number;
  payment_status: string;
  created_at: string;
  studentName?: string;
  studentEmail?: string;
}

const emptyPackage = (): CreditPackage => ({
  name: "",
  credits: 10,
  price: 0,
  highlighted: false,
  active: true,
  sort_order: 0,
});

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  completed: "Pago",
  failed: "Falhou",
};

const AdminAiCreditsTab = () => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [{ data: pkgs }, { data: buys }] = await Promise.all([
      supabase.from("ai_credit_packages").select("*").order("sort_order"),
      supabase
        .from("ai_credit_purchases")
        .select("id, user_id, package_name, credits, amount, payment_status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setPackages((pkgs || []) as unknown as CreditPackage[]);

    const rows = (buys || []) as unknown as PurchaseRow[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p) => [p.user_id, p]));
      rows.forEach((r) => {
        const p = map.get(r.user_id);
        r.studentName = p?.name || "—";
        r.studentEmail = p?.email || "";
      });
    }
    setPurchases(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const updatePackage = (idx: number, field: keyof CreditPackage, value: unknown) => {
    const updated = [...packages];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setPackages(updated);
  };

  const removePackage = async (idx: number) => {
    const pkg = packages[idx];
    if (pkg.id) await supabase.from("ai_credit_packages").delete().eq("id", pkg.id);
    setPackages(packages.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    for (const pkg of packages) {
      if (!pkg.name.trim() || Number(pkg.credits) <= 0 || Number(pkg.price) <= 0) {
        toast({
          title: "Dados incompletos",
          description: "Cada pacote precisa de nome, quantidade de Créditos de IA e preço maiores que zero.",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    for (let i = 0; i < packages.length; i++) {
      const { id, ...rest } = packages[i];
      const payload = { ...rest, sort_order: i };
      if (id) {
        await supabase.from("ai_credit_packages").update(payload).eq("id", id);
      } else {
        const { data } = await supabase
          .from("ai_credit_packages")
          .insert(payload)
          .select("id")
          .single();
        if (data) packages[i].id = data.id;
      }
    }
    setSaving(false);
    toast({ title: "Salvo", description: "Pacotes de Créditos de IA atualizados." });
    load();
  };

  const totalSold = purchases
    .filter((p) => p.payment_status === "completed")
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const creditsSold = purchases
    .filter((p) => p.payment_status === "completed")
    .reduce((acc, p) => acc + Number(p.credits || 0), 0);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-base font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Precificação de Créditos de IA
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Pacotes que o aluno pode comprar na página de Créditos de IA.
        </p>

        <div className="space-y-3">
          {packages.map((pkg, pi) => (
            <Card key={pi} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pacote {pi + 1}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removePackage(pi)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={pkg.name}
                    placeholder="Ex: Pacote Essencial"
                    onChange={(e) => updatePackage(pi, "name", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Créditos de IA</Label>
                  <Input
                    type="number"
                    min={1}
                    value={pkg.credits}
                    onChange={(e) => updatePackage(pi, "credits", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Preço (R$)</Label>
                  <CurrencyInput
                    value={pkg.price}
                    onValueChange={(v) => updatePackage(pi, "price", v)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pkg.active}
                    onCheckedChange={(v) => updatePackage(pi, "active", v)}
                  />
                  <Label className="cursor-pointer">Disponível para venda</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={pkg.highlighted}
                    onCheckedChange={(v) => updatePackage(pi, "highlighted", v)}
                  />
                  <Label className="cursor-pointer">Destacar pacote</Label>
                </div>
                {pkg.credits > 0 && pkg.price > 0 && (
                  <span className="text-xs text-muted-foreground">
                    R$ {(Number(pkg.price) / Number(pkg.credits)).toFixed(2).replace(".", ",")} por
                    crédito
                  </span>
                )}
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setPackages([...packages, emptyPackage()])}
          >
            <Plus className="h-4 w-4 mr-2" /> Adicionar pacote
          </Button>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar pacotes"}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-display text-base font-semibold mb-1">Vendas de Créditos de IA</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {creditsSold} Créditos de IA vendidos · R$ {totalSold.toFixed(2).replace(".", ",")} em
          compras confirmadas.
        </p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Aluno</th>
                <th className="px-3 py-2 text-left">Pacote</th>
                <th className="px-3 py-2 text-left">Créditos de IA</th>
                <th className="px-3 py-2 text-left">Valor</th>
                <th className="px-3 py-2 text-left">Situação</th>
                <th className="px-3 py-2 text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhuma compra de Créditos de IA registrada.
                  </td>
                </tr>
              )}
              {purchases.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.studentName}</div>
                    <div className="text-xs text-muted-foreground">{p.studentEmail}</div>
                  </td>
                  <td className="px-3 py-2">{p.package_name || "—"}</td>
                  <td className="px-3 py-2">{p.credits}</td>
                  <td className="px-3 py-2">
                    R$ {Number(p.amount || 0).toFixed(2).replace(".", ",")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={p.payment_status === "completed" ? "default" : "secondary"}>
                      {statusLabel[p.payment_status] || p.payment_status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAiCreditsTab;
