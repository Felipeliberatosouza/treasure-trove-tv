import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import CpfInput from "@/components/CpfInput";
import PaymentSecurityBadge from "@/components/PaymentSecurityBadge";
import { isValidCPF } from "@/lib/cpfValidator";
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type CheckoutStep = "billing" | "card" | "confirm";

const STEPS: { key: CheckoutStep; label: string; Icon: typeof UserRound }[] = [
  { key: "billing", label: "Dados", Icon: UserRound },
  { key: "card", label: "Cartão", Icon: CreditCard },
  { key: "confirm", label: "Confirmação", Icon: ShieldCheck },
];

function CheckoutStepper({ current }: { current: CheckoutStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3" aria-label="Progresso do checkout">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const Icon = s.Icon;
        return (
          <li key={s.key} className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                  !done && !active && "border-border bg-muted text-muted-foreground"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "text-xs sm:text-sm font-medium truncate",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border"
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Embedded checkout state passed via router state from PricingSection or
 * unit purchase flow. We require this to be set — visiting /checkout
 * directly redirects home.
 */
export interface EmbeddedCheckoutState {
  mode: "subscription" | "unit";
  // Subscription mode
  priceId?: string;
  planName?: string;
  planPrice?: number; // monthly price in BRL
  // Unit mode
  contentId?: string;
  contentType?: "lesson" | "exam_solution";
  contentTitle?: string;
  unitPrice?: number;
  // Where to go on cancel
  cancelUrl?: string;
}

interface BillingForm {
  name: string;
  cpf: string;
  postal_code: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshSubscription } = useAuth();
  const state = (location.state || null) as EmbeddedCheckoutState | null;
  const stripePromise = useMemo(() => getStripe(), []);
  const [step, setStep] = useState<CheckoutStep>("billing");

  // Guard: missing context
  useEffect(() => {
    if (!state || (state.mode !== "subscription" && state.mode !== "unit")) {
      toast.error("Sessão de pagamento expirada. Selecione novamente.");
      navigate("/");
    }
  }, [state, navigate]);

  // Guard: must be logged in
  useEffect(() => {
    if (state && !user) navigate("/login");
  }, [state, user, navigate]);

  if (!state || !user) return null;

  const title =
    state.mode === "subscription"
      ? `Assinar ${state.planName ?? "plano"}`
      : `Comprar ${state.contentTitle ?? "aula"}`;
  const amountLabel =
    state.mode === "subscription"
      ? `R$ ${Number(state.planPrice ?? 0).toFixed(2).replace(".", ",")}/mês`
      : `R$ ${Number(state.unitPrice ?? 0).toFixed(2).replace(".", ",")}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 pt-4 pb-8 md:pt-6 md:pb-12">
        <button
          onClick={() => navigate(state.cancelUrl || -1 as any)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 md:grid-cols-[1fr_360px]"
        >
          <div className="order-2 md:order-1">
            <h1 className="font-display text-2xl md:text-3xl font-bold mb-1">
              Pagamento seguro
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Preencha seus dados de cobrança e do cartão. Tudo é processado em ambiente
              criptografado certificado PCI-DSS — seus dados nunca passam pelos nossos servidores.
            </p>

            <CheckoutStepper current={step} />

            <Elements
              stripe={stripePromise}
              options={{
                mode: state.mode === "subscription" ? "subscription" : "payment",
                amount:
                  state.mode === "subscription"
                    ? Math.round((state.planPrice ?? 0) * 100)
                    : Math.round((state.unitPrice ?? 0) * 100),
                currency: "brl",
                paymentMethodCreation: "manual",
                appearance: { theme: "night", labels: "floating" },
              }}
            >
              <CheckoutForm
                state={state}
                initialName={profile?.name || ""}
                initialCpf={profile?.cpf || ""}
                onStepChange={setStep}
              />
            </Elements>
          </div>

          {/* Order summary */}
          <Card className="order-1 md:order-2 p-5 h-fit md:sticky md:top-6 space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              Resumo do pedido
            </h2>
            <div className="border-t border-border pt-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm">{title}</span>
                <span className="font-semibold whitespace-nowrap">{amountLabel}</span>
              </div>
              {state.mode === "subscription" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Cobrança recorrente mensal. Cancele quando quiser pelo painel do aluno.
                </p>
              )}
              {state.mode === "unit" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Compra avulsa. Acesso permanente a este conteúdo.
                </p>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 text-xs text-success">
                <ShieldCheck className="h-3.5 w-3.5" />
                Pagamento processado com segurança
              </div>
              <div className="mt-3">
                <PaymentSecurityBadge />
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

interface CheckoutFormProps {
  state: EmbeddedCheckoutState;
  initialName: string;
  initialCpf: string;
  onStepChange?: (s: CheckoutStep) => void;
}

function CheckoutForm({ state, initialName, initialCpf, onStepChange }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { refreshSubscription } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  const [billing, setBilling] = useState<BillingForm>({
    name: initialName,
    cpf: initialCpf,
    postal_code: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
  });

  const set = (k: keyof BillingForm, v: string) => setBilling((b) => ({ ...b, [k]: v }));

  const formatCep = (raw: string) => {
    const c = raw.replace(/\D/g, "").slice(0, 8);
    return c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
  };

  // Auto-fill from CEP via ViaCEP
  const onCepBlur = async () => {
    const clean = billing.postal_code.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data?.erro) {
        setBilling((b) => ({
          ...b,
          line1: data.logradouro || b.line1,
          line2: data.bairro || b.line2,
          city: data.localidade || b.city,
          state: data.uf || b.state,
        }));
      }
    } catch {
      /* silent — user can fill manually */
    } finally {
      setCepLoading(false);
    }
  };

  const validateBilling = (): string | null => {
    if (!billing.name.trim() || billing.name.trim().length < 3) return "Informe o nome completo.";
    const cleanCpf = billing.cpf.replace(/\D/g, "");
    if (!isValidCPF(cleanCpf)) return "CPF inválido.";
    const cleanCep = billing.postal_code.replace(/\D/g, "");
    if (cleanCep.length !== 8) return "CEP inválido.";
    if (!billing.line1.trim()) return "Informe o endereço.";
    if (!billing.city.trim()) return "Informe a cidade.";
    if (!BR_STATES.includes(billing.state)) return "Selecione o estado.";
    return null;
  };

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setError(null);

    const billingError = validateBilling();
    if (billingError) {
      setError(billingError);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Validate Elements
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Erro ao validar dados do cartão.");
        return;
      }

      // 2. Create PaymentMethod from Elements
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        elements,
        params: {
          billing_details: {
            name: billing.name.trim(),
            address: {
              line1: billing.line1.trim(),
              line2: billing.line2.trim() || undefined,
              city: billing.city.trim(),
              state: billing.state,
              postal_code: billing.postal_code.replace(/\D/g, ""),
              country: "BR",
            },
          },
        },
      });
      if (pmError || !paymentMethod) {
        setError(pmError?.message || "Não foi possível processar os dados do cartão.");
        return;
      }

      const billingPayload = {
        name: billing.name.trim(),
        cpf: billing.cpf.replace(/\D/g, ""),
        postal_code: billing.postal_code.replace(/\D/g, ""),
        line1: billing.line1.trim(),
        line2: billing.line2.trim(),
        city: billing.city.trim(),
        state: billing.state,
        country: "BR",
      };

      // 3. Call backend to create Subscription / PaymentIntent with this PM
      const fnName =
        state.mode === "subscription"
          ? "create-subscription-embedded"
          : "create-payment-embedded";
      const body =
        state.mode === "subscription"
          ? { priceId: state.priceId, paymentMethodId: paymentMethod.id, billing: billingPayload }
          : {
              contentId: state.contentId,
              contentType: state.contentType,
              paymentMethodId: paymentMethod.id,
              billing: billingPayload,
            };

      const { data, error: fnError } = await supabase.functions.invoke(fnName, { body });
      if (fnError) throw fnError;
      if (!data?.ok) {
        setError(data?.error || "Não foi possível concluir o pagamento.");
        return;
      }

      const clientSecret: string | null = data.clientSecret;

      // 4. If a client_secret was returned, confirm 3DS / SCA on the card
      if (clientSecret) {
        if (state.mode === "subscription") {
          const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);
          if (confirmError) {
            setError(confirmError.message || "Pagamento não autorizado.");
            return;
          }
        } else {
          const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
            clientSecret
          );
          if (confirmError) {
            setError(confirmError.message || "Pagamento não autorizado.");
            return;
          }
          if (paymentIntent?.status !== "succeeded") {
            setError("Pagamento não foi concluído. Tente novamente.");
            return;
          }
        }
      }

      // 5. Success → poll & redirect
      toast.success("Pagamento aprovado!");
      if (state.mode === "subscription") {
        try {
          await refreshSubscription();
        } catch {
          /* ignore — PaymentSuccess will poll */
        }
        navigate("/payment-success");
      } else {
        navigate(
          `/payment-success?session_id=${data.paymentIntentId || ""}&content_id=${state.contentId}`
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao processar pagamento.";
      setError(msg);
      console.error("Checkout error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-sm">Dados de cobrança</h3>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="bn">Nome completo *</Label>
            <Input
              id="bn"
              value={billing.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Como está no cartão"
            />
          </div>
          <div>
            <Label htmlFor="bc">CPF *</Label>
            <CpfInput value={billing.cpf} onChange={(v) => set("cpf", v)} />
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div>
              <Label htmlFor="bz">CEP *</Label>
              <div className="relative">
                <Input
                  id="bz"
                  value={formatCep(billing.postal_code)}
                  onChange={(e) => set("postal_code", e.target.value)}
                  onBlur={onCepBlur}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {cepLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="bl1">Endereço *</Label>
              <Input
                id="bl1"
                value={billing.line1}
                onChange={(e) => set("line1", e.target.value)}
                placeholder="Rua, número"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bl2">Complemento / bairro</Label>
            <Input
              id="bl2"
              value={billing.line2}
              onChange={(e) => set("line2", e.target.value)}
              placeholder="Apto, bloco, bairro"
            />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <Label htmlFor="bcity">Cidade *</Label>
              <Input
                id="bcity"
                value={billing.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bst">UF *</Label>
              <select
                id="bst"
                value={billing.state}
                onChange={(e) => set("state", e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">--</option>
                {BR_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Dados do cartão</h3>
        <div className="rounded-md border border-border bg-background p-3">
          <PaymentElement
            options={{
              layout: "tabs",
              fields: { billingDetails: "never" },
              wallets: { applePay: "never", googlePay: "never" },
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Aceitamos Visa, Mastercard, Elo, American Express, Hipercard e outras bandeiras.
        </p>
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!stripe || submitting}
        size="lg"
        className="w-full font-display"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando pagamento...
          </>
        ) : state.mode === "subscription" ? (
          "Confirmar e assinar"
        ) : (
          "Confirmar e pagar"
        )}
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        Ao confirmar, você concorda com os Termos de Uso e Política de Privacidade.
      </p>
    </div>
  );
}

export default Checkout;
