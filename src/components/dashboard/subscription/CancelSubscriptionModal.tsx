import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  planPrice: number;
  daysUsed: number;
  totalDays: number;
  minUsageChargePct: number;
  allowFreeCancel: boolean;
  minCommitmentDays: number;
  totalSubscriptionDays: number;
  onConfirm: () => Promise<void>;
}

export default function CancelSubscriptionModal({
  open, onOpenChange, planName, planPrice,
  daysUsed, totalDays, minUsageChargePct,
  allowFreeCancel, minCommitmentDays, totalSubscriptionDays,
  onConfirm,
}: CancelSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);

  const usagePct = totalDays > 0 ? (daysUsed / totalDays) * 100 : 0;
  const dailyRate = totalDays > 0 ? planPrice / totalDays : 0;
  const usedAmount = dailyRate * daysUsed;

  // Minimum charge: at least minUsageChargePct% of the monthly price
  const minCharge = (minUsageChargePct / 100) * planPrice;
  const chargeAmount = Math.max(usedAmount, minCharge);

  const isInCommitment = !allowFreeCancel && totalSubscriptionDays < minCommitmentDays;

  let explanation = "";
  if (allowFreeCancel) {
    if (minUsageChargePct > 0 && usedAmount < minCharge) {
      explanation = `Você usou ${daysUsed} de ${totalDays} dias do ciclo (${usagePct.toFixed(0)}%). O uso proporcional seria R$ ${usedAmount.toFixed(2)}, porém o plano ${planName} possui cobrança mínima de ${minUsageChargePct}% (R$ ${minCharge.toFixed(2)}). Será cobrado R$ ${chargeAmount.toFixed(2)}.`;
    } else {
      explanation = `Você usou ${daysUsed} de ${totalDays} dias do ciclo (${usagePct.toFixed(0)}%). Será cobrado proporcionalmente R$ ${chargeAmount.toFixed(2)} pelos dias utilizados.`;
    }
  } else {
    if (isInCommitment) {
      explanation = `Seu plano possui permanência mínima de ${minCommitmentDays} dias. Você está no dia ${totalSubscriptionDays}. Cancelar agora pode gerar cobrança do período restante de compromisso. Valor proporcional do ciclo: R$ ${chargeAmount.toFixed(2)}.`;
    } else {
      explanation = `Você já cumpriu o período mínimo de ${minCommitmentDays} dias. Será cobrado R$ ${chargeAmount.toFixed(2)} proporcionalmente pelos ${daysUsed} dias usados neste ciclo.`;
    }
  }

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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar Assinatura — {planName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
                <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
                  <span>Dias usados no ciclo</span>
                  <span className="text-right">{daysUsed} de {totalDays}</span>
                  <span>Uso proporcional</span>
                  <span className="text-right">R$ {usedAmount.toFixed(2)}</span>
                  {minUsageChargePct > 0 && (
                    <>
                      <span>Cobrança mínima ({minUsageChargePct}%)</span>
                      <span className="text-right">R$ {minCharge.toFixed(2)}</span>
                    </>
                  )}
                </div>
                <div className="flex justify-between pt-1 border-t border-border/50 font-medium text-sm">
                  <span>Valor final de cancelamento</span>
                  <span>R$ {chargeAmount.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirmar Cancelamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
