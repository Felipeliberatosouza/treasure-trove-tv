import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Loader2, Check, X, Minus, Wallet, CreditCard } from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  service_revisoes: "Revisões",
  service_resumos: "Resumos",
  service_simulados: "Simulados",
  service_top_questoes: "Top Questões",
  service_colinhas: "Colinhas",
  service_duvidas: "Dúvidas",
  service_aula_particular: "Aula Particular",
};

const SERVICE_KEYS = Object.keys(SERVICE_LABELS);

export interface PlanOption {
  id: string;
  name: string;
  price: number;
  highlighted: boolean;
  features?: string[];
  service_revisoes?: boolean;
  service_revisoes_qty?: number;
  service_resumos?: boolean;
  service_resumos_qty?: number;
  service_simulados?: boolean;
  service_simulados_qty?: number;
  service_top_questoes?: boolean;
  service_top_questoes_qty?: number;
  service_colinhas?: boolean;
  service_colinhas_qty?: number;
  service_duvidas?: boolean;
  service_duvidas_qty?: number;
  service_aula_particular?: boolean;
  service_aula_particular_qty?: number;
}

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

function ServiceComparisonRow({ serviceKey, currentPlan, newPlan }: { serviceKey: string; currentPlan: PlanOption; newPlan: PlanOption }) {
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
      <span className={`w-16 text-center ${improved ? "text-green-600 font-semibold" : worsened ? "text-amber-600" : ""}`}>
        {newVal === null ? <X className="h-3 w-3 text-muted-foreground/40 mx-auto" /> :
         newVal === true ? <Check className={`h-3 w-3 mx-auto ${improved ? "text-green-600" : "text-primary"}`} /> :
         <span>{newVal}</span>}
        {improved && <ArrowUp className="h-2.5 w-2.5 inline ml-0.5" />}
        {worsened && <ArrowDown className="h-2.5 w-2.5 inline ml-0.5" />}
      </span>
    </div>
  );
}

export default function PlanChangeModal({
  open, onOpenChange, currentPlanId, currentPlanPrice, currentPlanName,
  currentPlanServices, daysUsed, totalDays, plans, onConfirm,
}: PlanChangeModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedPlan = plans.find(p => p.id === selected);
  const isUpgrade = selectedPlan ? selectedPlan.price > currentPlanPrice : false;

  const remainingDays = Math.max(0, totalDays - daysUsed);
  const dailyRateCurrent = totalDays > 0 ? currentPlanPrice / totalDays : 0;
  const creditRemaining = dailyRateCurrent * remainingDays;
  const dailyRateNew = selectedPlan && totalDays > 0 ? selectedPlan.price / totalDays : 0;
  const costRemaining = dailyRateNew * remainingDays;
  const proRata = costRemaining - creditRemaining;

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

  const hasAnyService = (plan: PlanOption) =>
    SERVICE_KEYS.some(k => plan[k as keyof PlanOption]);

  const showComparison = selected && selectedPlan && (hasAnyService(currentPlanServices) || hasAnyService(selectedPlan));

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

        {/* Features & Service comparison */}
        {selected && selectedPlan && (
          <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-3">
            {/* Features comparison */}
            {(() => {
              const curFeatures = currentPlanServices.features || [];
              const newFeatures = selectedPlan.features || [];
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
            })()}

            {/* Services comparison */}
            {(hasAnyService(currentPlanServices) || hasAnyService(selectedPlan)) && (
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
                    currentPlan={currentPlanServices}
                    newPlan={selectedPlan}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pro-rata calculation */}
        {selected && selectedPlan && (
          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
            <p className="font-medium">Cálculo proporcional</p>
            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>Dias usados no ciclo atual</span>
              <span className="text-right">{daysUsed} de {totalDays}</span>
              <span>Crédito restante ({currentPlanName})</span>
              <span className="text-right text-green-600">- R$ {creditRemaining.toFixed(2)}</span>
              <span>Custo restante ({selectedPlan.name})</span>
              <span className="text-right">R$ {costRemaining.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border/50 font-medium text-sm">
              <span>{proRata >= 0 ? "Valor a pagar agora" : "Crédito a seu favor"}</span>
              <span className={proRata >= 0 ? "text-foreground" : "text-green-600"}>
                R$ {Math.abs(proRata).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {proRata >= 0
                ? `Você paga a diferença proporcional de R$ ${proRata.toFixed(2)} pelos ${remainingDays} dias restantes do ciclo. A partir da próxima renovação, o valor será R$ ${selectedPlan.price.toFixed(2)}/mês.`
                : `Você tem R$ ${Math.abs(proRata).toFixed(2)} de crédito que será aplicado na próxima fatura. A partir da próxima renovação, o valor será R$ ${selectedPlan.price.toFixed(2)}/mês.`
              }
            </p>
          </div>
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
