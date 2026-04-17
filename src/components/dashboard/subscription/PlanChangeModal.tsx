import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { FeaturesComparison } from "./plan-change/FeaturesComparison";
import { ServiceComparison } from "./plan-change/ServiceComparison";
import { ProRataCard } from "./plan-change/ProRataCard";
import { hasAnyService, type PlanOption } from "./plan-change/PlanOption";

export type { PlanOption } from "./plan-change/PlanOption";

interface PlanChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId: string;
  currentPlanPrice: number;
  currentPlanName: string;
  currentPlanServices: PlanOption;
  daysUsed: number;
  totalDays: number;
  plans: PlanOption[];
  onConfirm: (newPlanId: string) => Promise<void>;
}

export default function PlanChangeModal({
  open, onOpenChange, currentPlanId, currentPlanPrice, currentPlanName,
  currentPlanServices, daysUsed, totalDays, plans, onConfirm,
}: PlanChangeModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedPlan = plans.find(p => p.id === selected);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await onConfirm(selected);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const showComparison = selected && selectedPlan && (
    (selectedPlan.features?.length || currentPlanServices.features?.length) ||
    hasAnyService(currentPlanServices) || hasAnyService(selectedPlan)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alterar Plano</DialogTitle>
          <DialogDescription>
            Plano atual: <strong>{currentPlanName}</strong> — R$ {currentPlanPrice.toFixed(2)}/mês
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {plans.filter(p => p.id !== currentPlanId).map(plan => {
            const upgrade = plan.price > currentPlanPrice;
            return (
              <button
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selected === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {upgrade
                      ? <ArrowUp className="h-4 w-4 text-green-600" />
                      : <ArrowDown className="h-4 w-4 text-amber-600" />}
                    <span className="text-sm font-medium">{plan.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {upgrade ? "Upgrade" : "Downgrade"}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold">R$ {plan.price.toFixed(2)}/mês</span>
                </div>
              </button>
            );
          })}
        </div>

        {showComparison && selectedPlan && (
          <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-3">
            <FeaturesComparison currentPlan={currentPlanServices} newPlan={selectedPlan} />
            <ServiceComparison currentPlan={currentPlanServices} newPlan={selectedPlan} />
          </div>
        )}

        {selected && selectedPlan && (
          <ProRataCard
            currentPlanName={currentPlanName}
            currentPlanPrice={currentPlanPrice}
            newPlanName={selectedPlan.name}
            newPlanPrice={selectedPlan.price}
            daysUsed={daysUsed}
            totalDays={totalDays}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirmar Mudança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
