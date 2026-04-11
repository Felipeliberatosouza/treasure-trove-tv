import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Save, Plus, Trash2, CreditCard } from "lucide-react";

const SERVICE_KEYS = [
  { key: "revisoes", label: "Revisões (vídeos de aulas)" },
  { key: "resumos", label: "Resumos" },
  { key: "simulados", label: "Simulados" },
  { key: "top_questoes", label: "Top Questões de Provas" },
  { key: "colinhas", label: "Colinhas" },
  { key: "duvidas", label: "Dúvidas (professor responde)" },
  { key: "aula_particular", label: "Aula Particular" },
] as const;

interface Plan {
  id?: string;
  name: string;
  price: number;
  highlighted: boolean;
  features: string[];
  active: boolean;
  sort_order: number;
  [key: string]: unknown;
}

const emptyPlan = (): Plan => {
  const p: Plan = {
    name: "", price: 0, highlighted: false, features: [""], active: true, sort_order: 0,
    allow_free_cancel: true, min_commitment_days: 30, cancel_text: "",
  };
  SERVICE_KEYS.forEach(s => {
    p[`service_${s.key}`] = false;
    p[`service_${s.key}_qty`] = 0;
  });
  return p;
};

const AdminPlansTab = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("sort_order");
    if (!error && data) setPlans(data as unknown as Plan[]);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const updatePlan = (idx: number, field: string, value: unknown) => {
    const updated = [...plans];
    (updated[idx] as Record<string, unknown>)[field] = value;
    setPlans(updated);
  };

  const updateFeature = (pi: number, fi: number, value: string) => {
    const updated = [...plans];
    updated[pi].features[fi] = value;
    setPlans(updated);
  };

  const addFeature = (pi: number) => {
    const updated = [...plans];
    updated[pi].features.push("");
    setPlans(updated);
  };

  const removeFeature = (pi: number, fi: number) => {
    const updated = [...plans];
    updated[pi].features = updated[pi].features.filter((_, i) => i !== fi);
    setPlans(updated);
  };

  const addPlan = () => setPlans([...plans, emptyPlan()]);

  const removePlan = async (idx: number) => {
    const plan = plans[idx];
    if (plan.id) {
      await supabase.from("subscription_plans").delete().eq("id", plan.id);
    }
    setPlans(plans.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    for (let i = 0; i < plans.length; i++) {
      const { id, ...rest } = plans[i];
      rest.sort_order = i;
      if (id) {
        await supabase.from("subscription_plans").update(rest as any).eq("id", id);
      } else {
        const { data } = await supabase.from("subscription_plans").insert(rest as any).select().single();
        if (data) plans[i].id = (data as any).id;
      }
    }
    toast({ title: "Salvo", description: "Planos atualizados com sucesso." });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <CreditCard className="h-5 w-5" /> Planos de Assinatura
      </h2>

      <div className="space-y-4">
        {plans.map((plan, pi) => (
          <Card key={pi} className={`p-4 space-y-4 ${plan.highlighted ? "border-primary" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plano {pi + 1}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePlan(pi)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={plan.name} onChange={(e) => updatePlan(pi, "name", e.target.value)} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={plan.price} onChange={(e) => updatePlan(pi, "price", parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={plan.highlighted} onCheckedChange={(v) => updatePlan(pi, "highlighted", v)} />
              <Label className="cursor-pointer">Destacar este plano</Label>
            </div>

            {/* Cancellation policy */}
            <div className="space-y-3 border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!plan.allow_free_cancel}
                  onCheckedChange={(v) => updatePlan(pi, "allow_free_cancel", v)}
                />
                <Label className="cursor-pointer">Cancelamento livre (sem cobrança)</Label>
              </div>

              {plan.allow_free_cancel ? (
                <div>
                  <Label>Frase de cancelamento</Label>
                  <Input
                    value={(plan.cancel_text as string) || ""}
                    onChange={(e) => updatePlan(pi, "cancel_text", e.target.value)}
                    placeholder="Ex: Cancele quando quiser. Sem compromisso."
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <Label>Tempo mínimo de permanência (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      className="w-32"
                      value={(plan.min_commitment_days as number) || 30}
                      onChange={(e) => updatePlan(pi, "min_commitment_days", parseInt(e.target.value) || 30)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O aluno será cobrado se cancelar antes de {(plan.min_commitment_days as number) || 30} dias.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>Link de checkout (URL Stripe)</Label>
              <Input
                value={(plan.checkout_url as string) || ""}
                onChange={(e) => updatePlan(pi, "checkout_url", e.target.value)}
                placeholder="https://buy.stripe.com/..."
              />
            </div>

            {/* Free text features */}
            <div>
              <Label>Recursos (texto livre)</Label>
              <div className="space-y-2 mt-1">
                {plan.features.map((f, fi) => (
                  <div key={fi} className="flex gap-2">
                    <Input value={f} onChange={(e) => updateFeature(pi, fi, e.target.value)} placeholder="Ex: Acesso ilimitado" className="flex-1" />
                    {plan.features.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" onClick={() => removeFeature(pi, fi)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => addFeature(pi)} className="text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar recurso
                </Button>
              </div>
            </div>

            {/* Service flags */}
            <div>
              <Label className="mb-2 block">Serviços incluídos</Label>
              <div className="space-y-2">
                {SERVICE_KEYS.map(s => (
                  <div key={s.key} className="flex items-center gap-3">
                    <Switch
                      checked={!!plan[`service_${s.key}`]}
                      onCheckedChange={(v) => updatePlan(pi, `service_${s.key}`, v)}
                    />
                    <span className="text-sm flex-1">{s.label}</span>
                    {!!plan[`service_${s.key}`] && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Qtd:</Label>
                        <Input
                          type="number" min={0}
                          className="w-20 h-8 text-sm"
                          value={plan[`service_${s.key}_qty`] as number}
                          onChange={(e) => updatePlan(pi, `service_${s.key}_qty`, parseInt(e.target.value) || 0)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

        <Button variant="outline" onClick={addPlan} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> Adicionar Plano
        </Button>

        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Planos"}
        </Button>
      </div>
    </div>
  );
};

export default AdminPlansTab;
