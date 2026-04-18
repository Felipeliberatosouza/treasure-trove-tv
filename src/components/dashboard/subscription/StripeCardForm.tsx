import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import PaymentSecurityBadge from "@/components/PaymentSecurityBadge";

interface StripeCardFormProps {
  onPaymentMethodReady: (paymentMethodId: string) => Promise<void> | void;
  ctaLabel: string;
  disabled?: boolean;
}

/**
 * Renders Stripe PaymentElement and confirms a SetupIntent on submit.
 * On success, returns the resulting payment_method ID to the parent.
 */
export default function StripeCardForm({
  onPaymentMethodReady,
  ctaLabel,
  disabled,
}: StripeCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Erro ao validar dados do cartão.");
      setSubmitting(false);
      return;
    }

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message || "Não foi possível salvar o cartão.");
      setSubmitting(false);
      return;
    }

    const pmId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;

    if (!pmId) {
      setError("Cartão não retornou identificador. Tente novamente.");
      setSubmitting(false);
      return;
    }

    try {
      await onPaymentMethodReady(pmId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao concluir pagamento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <PaymentSecurityBadge />
      <p className="text-[11px] text-muted-foreground leading-snug">
        Os dados do cartão são processados em ambiente criptografado certificado PCI-DSS e não passam pelos nossos servidores.
      </p>

      <div className="rounded-md border border-border bg-background p-3">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!stripe || submitting || disabled}
        className="w-full"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {ctaLabel}
      </Button>
    </div>
  );
}
