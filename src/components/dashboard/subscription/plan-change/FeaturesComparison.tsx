import { Check, X } from "lucide-react";
import type { PlanOption } from "./PlanOption";

interface Props {
  currentPlan: PlanOption;
  newPlan: PlanOption;
}

export function FeaturesComparison({ currentPlan, newPlan }: Props) {
  const curFeatures = currentPlan.features || [];
  const newFeatures = newPlan.features || [];
  const allFeatures = Array.from(new Set([...curFeatures, ...newFeatures]));
  if (allFeatures.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="font-medium text-sm">Benefícios do plano</p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center pb-1 border-b border-border/30">
        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Benefício</span>
        <span className="w-16 text-center text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Atual</span>
        <span className="w-16 text-center text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Novo</span>
      </div>
      {allFeatures.map(feature => {
        const inCurrent = curFeatures.includes(feature);
        const inNew = newFeatures.includes(feature);
        const added = !inCurrent && inNew;
        const removed = inCurrent && !inNew;
        return (
          <div key={feature} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1 text-xs">
            <span className="text-muted-foreground">{feature}</span>
            <span className="w-16 text-center">
              {inCurrent ? <Check className="h-3 w-3 text-primary mx-auto" /> : <X className="h-3 w-3 text-muted-foreground/40 mx-auto" />}
            </span>
            <span className="w-16 text-center">
              {inNew ? <Check className={`h-3 w-3 mx-auto ${added ? "text-green-600" : "text-primary"}`} /> : <X className={`h-3 w-3 mx-auto ${removed ? "text-amber-600" : "text-muted-foreground/40"}`} />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
