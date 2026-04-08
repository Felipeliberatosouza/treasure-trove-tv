import { useEffect, useState } from "react";
import { usePlatformSettings, SubscriptionPlan, SubscriptionPlansSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Plus, Trash2, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";

const emptyPlan: SubscriptionPlan = { name: "", price: 0, features: [""], highlighted: false };

const SettingsSubscriptionPlans = () => {
  const { data, loading, update } = usePlatformSettings("subscription_plans");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setPlans(data.plans || []); }, [data]);

  const updatePlan = (index: number, field: keyof SubscriptionPlan, value: unknown) => {
    const updated = [...plans];
    (updated[index] as Record<string, unknown>)[field] = value;
    setPlans(updated);
  };

  const updateFeature = (planIdx: number, featureIdx: number, value: string) => {
    const updated = [...plans];
    updated[planIdx].features[featureIdx] = value;
    setPlans(updated);
  };

  const addFeature = (planIdx: number) => {
    const updated = [...plans];
    updated[planIdx].features.push("");
    setPlans(updated);
  };

  const removeFeature = (planIdx: number, featureIdx: number) => {
    const updated = [...plans];
    updated[planIdx].features = updated[planIdx].features.filter((_, i) => i !== featureIdx);
    setPlans(updated);
  };

  const addPlan = () => setPlans([...plans, { ...emptyPlan, features: [""] }]);
  const removePlan = (idx: number) => setPlans(plans.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    await update({ plans });
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      {plans.map((plan, pi) => (
        <Card key={pi} className={`p-4 space-y-3 ${plan.highlighted ? "border-primary" : ""}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Plano {pi + 1}</span>
            </div>
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
          <div>
            <Label>Recursos incluídos</Label>
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
        </Card>
      ))}

      <Button variant="outline" onClick={addPlan} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Adicionar Plano
      </Button>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Planos"}
      </Button>
    </div>
  );
};

export default SettingsSubscriptionPlans;
