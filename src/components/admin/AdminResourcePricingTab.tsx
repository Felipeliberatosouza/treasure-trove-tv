import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, DollarSign } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RESOURCE_LABELS: Record<string, string> = {
  revisoes: "Revisões (vídeos de aulas)",
  resumos: "Resumos",
  simulados: "Simulados",
  top_questoes: "Top Questões de Provas",
  colinhas: "Colinhas",
  duvidas: "Dúvidas (professor responde)",
  aula_particular: "Aula Particular (50 minutos)",
};

interface ResourcePrice {
  id: string;
  resource_type: string;
  price: number;
  min_price: number;
  platform_percentage: number;
  active: boolean;
}

const AdminResourcePricingTab = () => {
  const [prices, setPrices] = useState<ResourcePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("resource_prices")
        .select("*")
        .order("resource_type");
      if (data) setPrices(data as unknown as ResourcePrice[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const updateField = (
    idx: number,
    field: "price" | "min_price" | "platform_percentage",
    value: number
  ) => {
    const updated = [...prices];
    updated[idx] = { ...updated[idx], [field]: value };
    setPrices(updated);
  };

  const handleSave = async () => {
    // Validate: min_price <= price, platform_percentage 0-100
    for (const p of prices) {
      if (p.min_price < 0 || p.price < 0) {
        toast({ title: "Erro", description: "Preços não podem ser negativos.", variant: "destructive" });
        return;
      }
      if (p.platform_percentage < 0 || p.platform_percentage > 100) {
        toast({ title: "Erro", description: "% da plataforma deve estar entre 0 e 100.", variant: "destructive" });
        return;
      }
      if (p.price > 0 && p.min_price > p.price) {
        toast({
          title: "Erro",
          description: `Preço mínimo de "${RESOURCE_LABELS[p.resource_type] || p.resource_type}" não pode ser maior que o preço padrão.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    for (const p of prices) {
      await supabase
        .from("resource_prices")
        .update({
          price: p.price,
          min_price: p.min_price,
          platform_percentage: p.platform_percentage,
        } as any)
        .eq("id", p.id);
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
        Defina o <strong>preço mínimo</strong> e o <strong>preço padrão</strong> de cada recurso, além do
        percentual da venda destinado à plataforma. O restante (<em>100% − % plataforma</em>) é repassado ao professor.
      </p>

      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recurso</TableHead>
              <TableHead className="w-32">Preço Mínimo (R$)</TableHead>
              <TableHead className="w-32">Preço Padrão (R$)</TableHead>
              <TableHead className="w-28">% Plataforma</TableHead>
              <TableHead className="w-28">% Professor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((p, i) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">
                  {RESOURCE_LABELS[p.resource_type] || p.resource_type}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="h-9"
                    value={p.min_price}
                    onChange={(e) => updateField(i, "min_price", parseFloat(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="h-9"
                    value={p.price}
                    onChange={(e) => updateField(i, "price", parseFloat(e.target.value) || 0)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    max={100}
                    className="h-9"
                    value={p.platform_percentage}
                    onChange={(e) =>
                      updateField(i, "platform_percentage", parseFloat(e.target.value) || 0)
                    }
                  />
                </TableCell>
                <TableCell className="text-sm font-medium text-success">
                  {(100 - (p.platform_percentage || 0)).toFixed(0)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button onClick={handleSave} disabled={saving} className="mt-4">
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Preços"}
      </Button>
    </div>
  );
};

export default AdminResourcePricingTab;
