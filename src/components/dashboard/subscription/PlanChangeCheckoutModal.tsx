import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight, CreditCard, Plus, ShieldCheck, Loader2,
  ArrowUp, ArrowDown, CheckCircle2, Info,
} from "lucide-react";
import type { PlanOption } from "./plan-change/PlanOption";

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface PlanChangeCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanOption;
  newPlan: PlanOption;
  daysUsed: number;
  totalDays: number;
  onConfirm: () => Promise<void> | void;
}

// Mock saved cards (visual only). Replace with real data from create-setup-intent.
const MOCK_SAVED_CARDS: SavedCard[] = [
  { id: "pm_mock_1", brand: "Visa", last4: "4242", exp_month: 12, exp_year: 2027 },
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PlanChangeCheckoutModal({
  open, onOpenChange, currentPlan, newPlan, daysUsed, totalDays, onConfirm,
}: PlanChangeCheckoutModalProps) {
  const [paymentChoice, setPaymentChoice] = useState<string>(
    MOCK_SAVED_CARDS[0]?.id ?? "new",
  );
  const [loading, setLoading] = useState(false);

  const isUpgrade = newPlan.price > currentPlan.price;
  const daysRemaining = Math.max(0, totalDays - daysUsed);
  const dailyOld = currentPlan.price / totalDays;
  const dailyNew = newPlan.price / totalDays;
  const credit = +(dailyOld * daysRemaining).toFixed(2);
  const newPeriodCharge = +(dailyNew * daysRemaining).toFixed(2);
  const dueNow = Math.max(0, +(newPeriodCharge - credit).toFixed(2));
  const creditForNext = isUpgrade ? 0 : Math.max(0, +(credit - newPeriodCharge).toFixed(2));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isUpgrade ? (
              <ArrowUp className="h-5 w-5 text-success" />
            ) : (
              <ArrowDown className="h-5 w-5 text-warning" />
            )}
            <DialogTitle>
              Confirmar {isUpgrade ? "Upgrade" : "Downgrade"} de Plano
            </DialogTitle>
          </div>
          <DialogDescription>
            Revise os valores e a forma de pagamento antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Plan transition card */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Plano atual</p>
              <p className="font-semibold text-sm">{currentPlan.name}</p>
              <p className="text-xs text-muted-foreground">{formatBRL(currentPlan.price)}/mês</p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-1 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Novo plano</p>
              <p className="font-semibold text-sm text-primary">{newPlan.name}</p>
              <p className="text-xs text-muted-foreground">{formatBRL(newPlan.price)}/mês</p>
            </div>
          </div>
        </div>

        {/* Pro-rata breakdown */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Cálculo proporcional</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Dias usados / total</span>
              <span>{daysUsed} / {totalDays}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Dias restantes no ciclo</span>
              <span>{daysRemaining}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between">
              <span>Crédito do plano atual</span>
              <span className="text-success font-medium">- {formatBRL(credit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Novo plano (proporcional aos dias restantes)</span>
              <span className="font-medium">{formatBRL(newPeriodCharge)}</span>
            </div>
            <Separator className="my-2" />
            {isUpgrade ? (
              <div className="flex justify-between text-base font-semibold">
                <span>A pagar agora</span>
                <span className="text-primary">{formatBRL(dueNow)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-base font-semibold">
                  <span>A pagar agora</span>
                  <span>{formatBRL(0)}</span>
                </div>
                {creditForNext > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-success/10 border border-success/30 p-2 mt-2">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <p className="text-xs text-success-foreground">
                      Você terá <strong>{formatBRL(creditForNext)}</strong> de crédito aplicado
                      automaticamente na sua próxima fatura.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Payment method (only required for upgrades that need a charge now) */}
        {isUpgrade && dueNow > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Forma de pagamento</h3>
            </div>

            <RadioGroup value={paymentChoice} onValueChange={setPaymentChoice} className="space-y-2">
              {MOCK_SAVED_CARDS.map((card) => (
                <Label
                  key={card.id}
                  htmlFor={card.id}
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    paymentChoice === card.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={card.id} id={card.id} />
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {card.brand} •••• {card.last4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Salvo</Badge>
                </Label>
              ))}

              <Label
                htmlFor="new"
                className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  paymentChoice === "new" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="new" id="new" />
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Usar um novo cartão</span>
              </Label>
            </RadioGroup>

            {/* New card form (visual mockup — will be replaced by Stripe Elements) */}
            {paymentChoice === "new" && (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 space-y-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Pagamento processado com segurança. Os dados do cartão não passam pelos nossos servidores.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="card-number" className="text-xs">Número do cartão</Label>
                  <Input id="card-number" placeholder="1234 1234 1234 1234" disabled />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="card-exp" className="text-xs">Validade</Label>
                    <Input id="card-exp" placeholder="MM/AA" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="card-cvc" className="text-xs">CVV</Label>
                    <Input id="card-cvc" placeholder="123" disabled />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="card-name" className="text-xs">Nome no cartão</Label>
                  <Input id="card-name" placeholder="Como impresso no cartão" disabled />
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  * Mockup visual. Será substituído pelo Stripe Elements (PCI-DSS SAQ-A).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="min-w-[180px]">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isUpgrade && dueNow > 0
              ? `Pagar ${formatBRL(dueNow)} e mudar`
              : `Confirmar ${isUpgrade ? "Upgrade" : "Downgrade"}`}
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Conexão segura · Stripe · LGPD
        </p>
      </DialogContent>
    </Dialog>
  );
}
