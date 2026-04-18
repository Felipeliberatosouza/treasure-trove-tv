import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight, CreditCard, Plus, ShieldCheck, Loader2,
  ArrowUp, ArrowDown, CheckCircle2, Info, AlertCircle, RefreshCw, HelpCircle, Download,
} from "lucide-react";
import { downloadPlanChangePdf } from "@/lib/planChangePdf";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StripeCardForm from "./StripeCardForm";
import PaymentSecurityBadge from "@/components/PaymentSecurityBadge";
import type { PlanOption } from "./plan-change/PlanOption";

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  isDefault?: boolean;
}

interface PlanChangeCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: PlanOption;
  newPlan: PlanOption;
  daysUsed: number;
  totalDays: number;
  /** Called after the plan change succeeds (refresh UI / send notifications). */
  onSuccess?: () => Promise<void> | void;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PlanChangeCheckoutModal({
  open, onOpenChange, currentPlan, newPlan, daysUsed, totalDays, onSuccess,
}: PlanChangeCheckoutModalProps) {
  const [paymentChoice, setPaymentChoice] = useState<string>("new");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<{ clientSecret: string; invoiceId: string } | null>(null);
  const [awaiting3DS, setAwaiting3DS] = useState(false);
  const [success, setSuccess] = useState(false);

  const isUpgrade = newPlan.price > currentPlan.price;
  const daysRemaining = Math.max(0, totalDays - daysUsed);
  const dailyOld = totalDays > 0 ? currentPlan.price / totalDays : 0;
  const dailyNew = totalDays > 0 ? newPlan.price / totalDays : 0;
  const credit = +(dailyOld * daysRemaining).toFixed(2);
  const newPeriodCharge = +(dailyNew * daysRemaining).toFixed(2);
  const dueNow = Math.max(0, +(newPeriodCharge - credit).toFixed(2));
  const creditForNext = isUpgrade ? 0 : Math.max(0, +(credit - newPeriodCharge).toFixed(2));
  const requiresPayment = isUpgrade && dueNow > 0;

  // Fetch saved cards + SetupIntent client secret when modal opens (only if charge is needed).
  useEffect(() => {
    if (!open || !requiresPayment) return;
    let cancelled = false;
    (async () => {
      setLoadingSetup(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-setup-intent");
        if (error) throw error;
        if (cancelled) return;
        setSavedCards(data?.savedCards || []);
        setClientSecret(data?.clientSecret || null);
        // Default to first saved card if available, otherwise "new"
        const defaultId =
          (data?.savedCards || []).find((c: SavedCard) => c.isDefault)?.id ||
          data?.savedCards?.[0]?.id ||
          "new";
        setPaymentChoice(defaultId);
      } catch (e) {
        console.error("[PlanChangeCheckoutModal] setup-intent failed", e);
        toast.error("Não foi possível carregar formas de pagamento.");
      } finally {
        if (!cancelled) setLoadingSetup(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, requiresPayment]);

  const stripePromise = useMemo(() => getStripe(), []);

  const performChange = async (paymentMethodId?: string) => {
    setSubmitting(true);
    setPaymentError(null);
    try {
      const { data, error } = await supabase.functions.invoke("change-subscription-plan", {
        body: { newPlanId: newPlan.id, paymentMethodId },
      });
      if (error) throw error;

      // 3DS / SCA required on the upgrade invoice — run the challenge then retry.
      if (data?.requiresAction && data?.clientSecret && data?.invoiceId) {
        await handle3DSAndRetry(data.clientSecret as string, data.invoiceId as string);
        return;
      }

      if (!data?.ok) {
        setPaymentError(data?.error || "Falha ao alterar plano. Tente outro cartão.");
        return;
      }
      toast.success(
        isUpgrade
          ? `Upgrade para ${newPlan.name} concluído!`
          : `Downgrade para ${newPlan.name} agendado.`,
      );
      setPendingInvoice(null);
      setSuccess(true);
      await onSuccess?.();
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Erro ao alterar plano.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Runs the 3D Secure challenge in a Stripe-hosted modal and, if successful,
   * re-invokes the edge function with retryInvoiceId so the subscription
   * change can be finalized server-side. On failure, keeps the modal open
   * with an inline error so the user can retry with another card.
   */
  const handle3DSAndRetry = async (clientSecret: string, invoiceId: string) => {
    // Remember the invoice so a future "Tentar novamente" can re-run with a new card
    setPendingInvoice({ clientSecret, invoiceId });
    toast.info("Autenticação adicional do banco necessária...");
    const stripe = await stripePromise;
    if (!stripe) {
      setPaymentError("Stripe não pôde ser carregado. Recarregue a página.");
      return;
    }
    setAwaiting3DS(true);
    let confirmError: any;
    let paymentIntent: any;
    try {
      const result = await stripe.confirmCardPayment(clientSecret);
      confirmError = result.error;
      paymentIntent = result.paymentIntent;
    } finally {
      setAwaiting3DS(false);
    }
    if (confirmError) {
      setPaymentError(
        confirmError.message
          ? `Autenticação falhou: ${confirmError.message}. Tente outro cartão.`
          : "Autenticação 3D Secure falhou. Tente outro cartão.",
      );
      // Switch UI back to "new card" so the user can enter another card
      setPaymentChoice("new");
      return;
    }
    if (paymentIntent?.status !== "succeeded") {
      setPaymentError(
        `Autenticação não concluída (status: ${paymentIntent?.status ?? "desconhecido"}). Tente outro cartão.`,
      );
      setPaymentChoice("new");
      return;
    }

    // Re-invoke to finalize the change server-side
    const { data: retry, error: retryErr } = await supabase.functions.invoke(
      "change-subscription-plan",
      { body: { retryInvoiceId: invoiceId } },
    );
    if (retryErr) {
      setPaymentError("Pagamento autenticado, mas falha ao finalizar. Tente novamente.");
      return;
    }
    if (!retry?.ok) {
      setPaymentError(retry?.error || "Não foi possível concluir a troca de plano.");
      return;
    }
    toast.success(`Upgrade para ${newPlan.name} concluído!`);
    setPendingInvoice(null);
    setSuccess(true);
    await onSuccess?.();
  };

  /** Retry an existing pending invoice (e.g., after 3DS failure with same card). */
  const retryPendingInvoice = async () => {
    if (!pendingInvoice) return;
    setSubmitting(true);
    setPaymentError(null);
    try {
      await handle3DSAndRetry(pendingInvoice.clientSecret, pendingInvoice.invoiceId);
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm with a saved card (no Elements interaction needed)
  const handleConfirmSavedOrNoCharge = async () => {
    if (requiresPayment) {
      await performChange(paymentChoice);
    } else {
      // Downgrade or no charge — no payment method needed
      await performChange();
    }
  };

  const showNewCardForm = requiresPayment && paymentChoice === "new";

  const handleClose = (v: boolean) => {
    if (submitting || awaiting3DS) return;
    if (!v) {
      setSuccess(false);
      setPaymentError(null);
      setPendingInvoice(null);
    }
    onOpenChange(v);
  };

  const handleDownloadPdf = () => {
    const today = new Date();
    const effectiveDate = today.toLocaleDateString("pt-BR");
    const balance = isUpgrade ? dueNow : -creditForNext;
    const changeType: "upgrade" | "downgrade" | "change" =
      newPlan.price > currentPlan.price ? "upgrade" : newPlan.price < currentPlan.price ? "downgrade" : "change";
    downloadPlanChangePdf({
      previousPlan: currentPlan.name,
      previousPlanPrice: currentPlan.price,
      newPlan: newPlan.name,
      newPlanPrice: newPlan.price,
      changeType,
      totalDays,
      daysUsed,
      daysRemaining,
      dailyOld,
      dailyNew,
      credit,
      newProRata: newPeriodCharge,
      balance,
      effectiveDate,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl w-[calc(100%-2rem)] sm:w-full max-h-[85vh] sm:max-h-[90vh] p-0 gap-0 !grid-cols-1 grid-rows-[auto_1fr_auto] overflow-hidden top-[50%] translate-y-[-50%]">
        {awaiting3DS && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm rounded-lg">
            <div className="relative">
              <ShieldCheck className="h-10 w-10 text-primary" />
              <Loader2 className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1 bg-background rounded-full" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Aguardando autenticação do banco...
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-[280px]">
              Conclua a verificação 3D Secure na janela do seu banco. Não feche esta tela.
            </p>
          </div>
        )}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {success ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : isUpgrade ? (
              <ArrowUp className="h-5 w-5 text-success" />
            ) : (
              <ArrowDown className="h-5 w-5 text-warning" />
            )}
            <DialogTitle>
              {success
                ? `${isUpgrade ? "Upgrade" : "Downgrade"} concluído`
                : `Confirmar ${isUpgrade ? "Upgrade" : "Downgrade"} de Plano`}
            </DialogTitle>
          </div>
          <DialogDescription>
            {success
              ? "Sua troca de plano foi processada. Baixe o comprovante abaixo."
              : "Revise os valores e a forma de pagamento antes de confirmar."}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">

        {success && (
          <div className="rounded-lg border border-success/40 bg-success/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-success/15 p-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">Troca confirmada com sucesso</p>
                <p className="text-xs text-muted-foreground">
                  {currentPlan.name} → <strong className="text-foreground">{newPlan.name}</strong>
                </p>
              </div>
            </div>
            <div className="rounded-md bg-background/60 border border-border p-3 text-sm space-y-1">
              {isUpgrade && dueNow > 0 ? (
                <p>
                  Saldo pago agora:{" "}
                  <strong className="text-primary">{formatBRL(dueNow)}</strong>
                </p>
              ) : creditForNext > 0 ? (
                <p>
                  Crédito de <strong className="text-success">{formatBRL(creditForNext)}</strong>{" "}
                  será aplicado na próxima fatura.
                </p>
              ) : (
                <p>Sem ajuste financeiro nesta troca.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Baseado em {daysRemaining} dias restantes no ciclo.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar comprovante (PDF)
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Você também pode baixar o comprovante depois no seu extrato de assinatura.
            </p>
          </div>
        )}

        {!success && (<>

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
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Como o cálculo é feito"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[280px] text-xs leading-relaxed space-y-1.5">
                  <p className="font-semibold">Como calculamos</p>
                  <p><strong>Valor diário</strong> = preço do plano ÷ {totalDays} dias</p>
                  <p><strong>Crédito</strong> = valor diário do plano atual × dias restantes</p>
                  <p><strong>Novo proporcional</strong> = valor diário do novo plano × dias restantes</p>
                  <p className="pt-1 border-t border-border/50">
                    <strong>Saldo</strong> = novo proporcional − crédito
                  </p>
                  <p className="text-muted-foreground">
                    Ex.: R$ 49,90 ÷ 30 = R$ 1,66/dia. Se restam 10 dias, crédito = R$ 16,63.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

        {/* Saldo final em linguagem simples */}
        <div
          className={`rounded-lg border p-4 ${
            isUpgrade && dueNow > 0
              ? "border-primary/40 bg-primary/5"
              : "border-success/40 bg-success/5"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 rounded-full p-2 ${
                isUpgrade && dueNow > 0 ? "bg-primary/15" : "bg-success/15"
              }`}
            >
              {isUpgrade && dueNow > 0 ? (
                <ArrowUp className="h-4 w-4 text-primary" />
              ) : (
                <ArrowDown className="h-4 w-4 text-success" />
              )}
            </div>
            <div className="space-y-1 flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                Resumo do saldo
              </p>
              {isUpgrade && dueNow > 0 ? (
                <p className="text-sm leading-relaxed">
                  Saldo a pagar agora:{" "}
                  <strong className="text-primary">{formatBRL(dueNow)}</strong>.{" "}
                  Equivale a <strong>{daysRemaining} dias</strong> restantes no novo plano{" "}
                  ({formatBRL(newPeriodCharge)}) menos seu crédito de{" "}
                  {formatBRL(credit)} do {currentPlan.name}.
                </p>
              ) : creditForNext > 0 ? (
                <p className="text-sm leading-relaxed">
                  Saldo de crédito:{" "}
                  <strong className="text-success">{formatBRL(creditForNext)}</strong>.{" "}
                  Equivale aos <strong>{daysRemaining} dias</strong> restantes do{" "}
                  {currentPlan.name} ({formatBRL(credit)}) menos o custo proporcional do{" "}
                  {newPlan.name} ({formatBRL(newPeriodCharge)}). Será aplicado automaticamente
                  na sua próxima fatura.
                </p>
              ) : (
                <p className="text-sm leading-relaxed">
                  Sem saldo a ajustar nesta troca. A mudança entra em vigor imediatamente.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment method (only required for upgrades that need a charge now) */}
        {requiresPayment && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Forma de pagamento</h3>
            </div>

            {paymentError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Pagamento não concluído</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p className="text-xs">{paymentError}</p>
                  {pendingInvoice && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={retryPendingInvoice}
                      disabled={submitting}
                      className="mt-1"
                    >
                      {submitting ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1.5" />
                      )}
                      Tentar autenticar novamente
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {loadingSetup ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <RadioGroup
                  value={paymentChoice}
                  onValueChange={(v) => { setPaymentChoice(v); setPaymentError(null); }}
                  className="space-y-2"
                >
                  {savedCards.map((card) => (
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
                        <p className="text-sm font-medium capitalize">
                          {card.brand} •••• {card.last4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Vence {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                        </p>
                      </div>
                      {card.isDefault && (
                        <Badge variant="outline" className="text-[10px]">Padrão</Badge>
                      )}
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

                {showNewCardForm && clientSecret && (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: { theme: "stripe" },
                      locale: "pt-BR",
                    }}
                  >
                    <StripeCardForm
                      ctaLabel={`Pagar ${formatBRL(dueNow)} e mudar`}
                      onPaymentMethodReady={(pmId) => performChange(pmId)}
                      disabled={submitting}
                    />
                  </Elements>
                )}
              </>
            )}
          </div>
        )}
        </>)}

        </div>
        {/* /Scrollable body */}

        {/* Sticky footer */}
        <div className="border-t border-border bg-background px-6 py-4 space-y-3 shrink-0">
          {/* Footer — hidden when StripeCardForm renders its own submit button */}
          {!showNewCardForm && (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmSavedOrNoCharge}
                disabled={submitting || loadingSetup}
                className="min-w-[180px]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {requiresPayment
                  ? `Pagar ${formatBRL(dueNow)} e mudar`
                  : `Confirmar ${isUpgrade ? "Upgrade" : "Downgrade"}`}
              </Button>
            </div>
          )}

          <div className="flex justify-center">
            <PaymentSecurityBadge variant="pill" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
