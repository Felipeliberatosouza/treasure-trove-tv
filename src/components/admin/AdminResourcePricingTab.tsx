import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, DollarSign } from "lucide-react";

const RESOURCE_LABELS: Record<string, string> = {
  revisoes: "Revisões (vídeos de aulas)",
  resumos: "Resumos",
  simulados: "Simulados",
  top_questoes: "Top Questões de Provas",
  colinhas: "Colinhas",
  duvidas: "Dúvidas (professor responde)",
  aula_particular: "Aula Particular",
};

interface ResourcePrice {
  id: string;
  resource_type: string;
  price: number;
  active: boolean;
}

const AdminResourcePricingTab = () => {
  const [prices, setPrices] = useState<ResourcePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("resource_prices").select("*").order("resource_type");
      if (data) setPrices(data as unknown as ResourcePrice[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const updatePrice = (idx: number, price: number) => {
    const updated = [...prices];
    updated[idx].price = price;
    setPrices(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    for (const p of prices) {
      await supabase.from("resource_prices").update({ price: p.price } as any).eq("id", p.id);
    }
    toast({ title: "Salvo", description: "Preços atualizados com sucesso." });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5" /> Preço de Recursos Individuais
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Defina o preço unitário para compra avulsa de cada tipo de recurso.
      </p>

      <div className="space-y-3 max-w-lg">
        {prices.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3">
            <Label className="flex-1 text-sm">{RESOURCE_LABELS[p.resource_type] || p.resource_type}</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <Input
                type="number" step="0.01" min={0}
                className="w-24 h-9"
                value={p.price}
                onChange={(e) => updatePrice(i, parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving} className="mt-4">
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Preços"}
      </Button>
    </div>
  );
};

export default AdminResourcePricingTab;
