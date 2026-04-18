import { AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/useBillingStatus";

interface PastDueBillingAlertProps {
  /** Called when the student clicks "Atualizar cartão" — should switch to the
   *  subscription tab and open the new-card form. */
  onUpdateCardClick: () => void;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Highlighted alert shown at the top of the student dashboard when Stripe
 * reports a failed charge (past_due / unpaid / incomplete). Drives the
 * student straight into the "update payment method" form.
 */
export default function PastDueBillingAlert({ onUpdateCardClick }: PastDueBillingAlertProps) {
  const { pastDue, status, amountDue, hostedInvoiceUrl, attemptCount, loading } =
    useBillingStatus();

  if (loading || !pastDue) return null;

  const statusLabel =
    status === "past_due"
      ? "em atraso"
      : status === "unpaid"
      ? "não paga"
      : "pendente";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-6 rounded-xl border-2 border-destructive/60 bg-destructive/10 p-4 sm:p-5 shadow-sm animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="shrink-0 rounded-full bg-destructive/15 p-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base sm:text-lg font-semibold text-destructive">
            Cobrança {statusLabel} — atualize seu cartão
          </h2>
          <p className="mt-1 text-sm text-foreground/90 leading-relaxed">
            {amountDue !== null
              ? `Não conseguimos processar a cobrança de ${fmtBRL(amountDue)} da sua assinatura.`
              : "Não conseguimos processar a última cobrança da sua assinatura."}{" "}
            {attemptCount && attemptCount > 1
              ? `Já tentamos ${attemptCount} vezes. `
              : ""}
            Atualize sua forma de pagamento para evitar a suspensão do acesso.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={onUpdateCardClick}
              className="gap-1.5"
            >
              <CreditCard className="h-4 w-4" />
              Atualizar cartão
            </Button>
            {hostedInvoiceUrl && (
              <Button
                size="sm"
                variant="outline"
                asChild
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <a href={hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                  Ver fatura
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
