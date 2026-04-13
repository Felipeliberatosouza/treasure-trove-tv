import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";

interface PlanOption {
  id: string;
  name: string;
  price: number;
  highlighted: boolean;
}

interface PlanChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlanId: string;
  currentPlanPrice: number;
  currentPlanName: string;
  daysUsed: number;
  totalDays: number;
  plans: PlanOption[];
  onConfirm: (newPlanId: string) => Promise<void>;
}

export default function PlanChangeModal({
  open, onOpenChange, currentPlanId, currentPlanPrice, currentPlanName,
  daysUsed, totalDays, plans, onConfirm,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Alterar Plano</DialogTitle>
          <DialogDescription>
            Plano atual: <strong>{currentPlanName}</strong> — R$ {currentPlanPrice.toFixed(2)}/mês
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-60 overflow-y-auto">
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
