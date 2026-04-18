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

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

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

  // Cobrança mínima do ciclo (% do plano)
  const minCharge = (minUsageChargePct / 100) * planPrice;
  // Valor proporcional pelo uso (com piso na cobrança mínima)
  const proRataAmount = Math.max(usedAmount, minCharge);

  // Multa por permanência: somente quando plano NÃO permite cancelamento gratuito
  // e o aluno ainda está no período de compromisso.
  const isInCommitment = !allowFreeCancel && totalSubscriptionDays < minCommitmentDays;
  const commitmentDaysRemaining = isInCommitment
    ? Math.max(0, minCommitmentDays - totalSubscriptionDays)
    : 0;
  const commitmentPenalty = isInCommitment ? dailyRate * commitmentDaysRemaining : 0;

  // Total final
  const chargeAmount = proRataAmount + commitmentPenalty;

  let explanation = "";
  if (allowFreeCancel) {
    if (minUsageChargePct > 0 && usedAmount < minCharge) {
      explanation = `Você usou ${daysUsed} de ${totalDays} dias do ciclo (${usagePct.toFixed(0)}%). O uso proporcional seria ${fmtBRL(usedAmount)}, porém o plano ${planName} possui cobrança mínima de ${minUsageChargePct}% (${fmtBRL(minCharge)}). Será cobrado ${fmtBRL(chargeAmount)}.`;
    } else {
      explanation = `Você usou ${daysUsed} de ${totalDays} dias do ciclo (${usagePct.toFixed(0)}%). Será cobrado proporcionalmente ${fmtBRL(chargeAmount)} pelos dias utilizados.`;
    }
  } else if (isInCommitment) {
    explanation = `O plano ${planName} possui permanência mínima de ${minCommitmentDays} dias e você está no dia ${totalSubscriptionDays}. Além do valor proporcional pelos ${daysUsed} dias usados neste ciclo (${fmtBRL(proRataAmount)}), será cobrada uma multa de permanência referente aos ${commitmentDaysRemaining} dias restantes de compromisso (${fmtBRL(commitmentPenalty)}). Total: ${fmtBRL(chargeAmount)}.`;
  } else {
    explanation = `Você já cumpriu o período mínimo de ${minCommitmentDays} dias. Será cobrado ${fmtBRL(chargeAmount)} proporcionalmente pelos ${daysUsed} dias usados neste ciclo.`;
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
                  <span>Valor diário do plano</span>
                  <span className="text-right">{fmtBRL(dailyRate)}</span>
                  <span>Uso proporcional</span>
                  <span className="text-right">{fmtBRL(usedAmount)}</span>
                  {minUsageChargePct > 0 && (
                    <>
                      <span>Cobrança mínima do ciclo ({minUsageChargePct}%)</span>
                      <span className="text-right">{fmtBRL(minCharge)}</span>
                    </>
                  )}
                  <span className="font-medium text-foreground">Subtotal proporcional</span>
                  <span className="text-right font-medium text-foreground">{fmtBRL(proRataAmount)}</span>
                  {isInCommitment && (
                    <>
                      <span className="text-destructive">Multa de permanência ({commitmentDaysRemaining} dias restantes)</span>
                      <span className="text-right text-destructive">{fmtBRL(commitmentPenalty)}</span>
                    </>
                  )}
                </div>
                <div className="flex justify-between pt-1 border-t border-border/50 font-medium text-sm">
                  <span>Valor final de cancelamento</span>
                  <span>{fmtBRL(chargeAmount)}</span>
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
