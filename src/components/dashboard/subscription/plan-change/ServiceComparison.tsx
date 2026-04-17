import { ArrowUp, ArrowDown, Check, X } from "lucide-react";
import { SERVICE_KEYS, SERVICE_LABELS, hasAnyService, type PlanOption } from "./PlanOption";

interface RowProps {
  serviceKey: string;
  currentPlan: PlanOption;
  newPlan: PlanOption;
}

function ServiceComparisonRow({ serviceKey, currentPlan, newPlan }: RowProps) {
  const label = SERVICE_LABELS[serviceKey];
  const curEnabled = currentPlan[serviceKey as keyof PlanOption] as boolean | undefined;
  const newEnabled = newPlan[serviceKey as keyof PlanOption] as boolean | undefined;
  const curQty = currentPlan[`${serviceKey}_qty` as keyof PlanOption] as number | undefined;
  const newQty = newPlan[`${serviceKey}_qty` as keyof PlanOption] as number | undefined;

  if (!curEnabled && !newEnabled) return null;

  const formatValue = (enabled: boolean | undefined, qty: number | undefined) => {
    if (!enabled) return null;
    return qty ? qty : true;
  };

  const curVal = formatValue(curEnabled, curQty);
  const newVal = formatValue(newEnabled, newQty);

  const improved = (!curVal && newVal) || (typeof curVal === "number" && typeof newVal === "number" && newVal > curVal);
  const worsened = (curVal && !newVal) || (typeof curVal === "number" && typeof newVal === "number" && newVal < curVal);

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="w-16 text-center">
        {curVal === null ? <X className="h-3 w-3 text-muted-foreground/40 mx-auto" /> :
         curVal === true ? <Check className="h-3 w-3 text-primary mx-auto" /> :
         <span className="font-medium">{curVal}</span>}
      </span>
      <span className={`w-16 text-center ${improved ? "text-success font-semibold" : worsened ? "text-warning" : ""}`}>
        {newVal === null ? <X className="h-3 w-3 text-muted-foreground/40 mx-auto" /> :
         newVal === true ? <Check className={`h-3 w-3 mx-auto ${improved ? "text-success" : "text-primary"}`} /> :
         <span>{newVal}</span>}
        {improved && <ArrowUp className="h-2.5 w-2.5 inline ml-0.5" />}
        {worsened && <ArrowDown className="h-2.5 w-2.5 inline ml-0.5" />}
      </span>
    </div>
  );
}

interface Props {
  currentPlan: PlanOption;
  newPlan: PlanOption;
}

export function ServiceComparison({ currentPlan, newPlan }: Props) {
  if (!hasAnyService(currentPlan) && !hasAnyService(newPlan)) return null;

  return (
    <div className="space-y-1">
      <p className="font-medium text-sm">Serviços inclusos</p>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center pb-1 border-b border-border/30">
        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Serviço</span>
        <span className="w-16 text-center text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Atual</span>
        <span className="w-16 text-center text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Novo</span>
      </div>
      {SERVICE_KEYS.map(key => (
        <ServiceComparisonRow
          key={key}
          serviceKey={key}
          currentPlan={currentPlan}
          newPlan={newPlan}
        />
      ))}
    </div>
  );
}
