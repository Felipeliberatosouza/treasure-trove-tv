import { useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, Check, ChevronDown, CreditCard, Loader2, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { useBetaMode, BETA_TEST_CARD } from "@/hooks/useBetaMode";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import InviteFriendsPanel from "@/components/referral/InviteFriendsPanel";
import {
  useCashbackAccount,
  useCashbackConfig,
  maxCashbackForCheckout,
} from "@/hooks/useCashback";
import {
  classifyCheckoutResponse,
  classifyStripeConfirm,
} from "@/lib/checkoutRetry";

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
  const isMobile = useIsMobile();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mobileSubmitting, setMobileSubmitting] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Cashback selection (lifted to parent so summary + form stay in sync)
  const { config: cashbackConfig } = useCashbackConfig();
  const { account: cashbackAccount, refresh: refreshCashbackAccount } = useCashbackAccount();
  const cartTotal =
    state?.mode === "subscription" ? Number(state?.planPrice ?? 0) : Number(state?.unitPrice ?? 0);
  const maxUsableCashback = useMemo(
    () =>
      maxCashbackForCheckout(
        cartTotal,
        cashbackAccount?.balance_available ?? 0,
        cashbackConfig,
      ),
    [cartTotal, cashbackAccount?.balance_available, cashbackConfig],
  );
  const [useCashback, setUseCashback] = useState(false);
  const [cashbackAmount, setCashbackAmount] = useState(0);

  // Initialize cashback amount when toggling on or when max changes
  useEffect(() => {
    if (!useCashback) {
      setCashbackAmount(0);
    } else {
      setCashbackAmount((prev) => {
        if (prev === 0) return Math.round(maxUsableCashback * 100) / 100;
        return Math.min(prev, maxUsableCashback);
      });
    }
  }, [useCashback, maxUsableCashback]);

  const cashbackEnabled =
    cashbackConfig.enabled && (cashbackAccount?.balance_available ?? 0) > 0 && maxUsableCashback > 0;
  const finalAmount = Math.max(cartTotal - (useCashback ? cashbackAmount : 0), 0);

  // Keep summary always open on desktop
  useEffect(() => {
    if (!isMobile) setSummaryOpen(true);
    else setSummaryOpen(false);
  }, [isMobile]);

  // Detect virtual keyboard on mobile by tracking focus on form fields
  // (also covers Stripe iframes, since focusin bubbles from the iframe host)
  useEffect(() => {
    if (!isMobile) {
      setKeyboardOpen(false);
      return;
    }
    const isFormField = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable ||
        el.tagName === "IFRAME"
      );
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isFormField(e.target)) setKeyboardOpen(true);
    };
    const onFocusOut = () => {
      // Defer so a focus that immediately moves to another input doesn't flicker
      window.setTimeout(() => {
        const active = document.activeElement;
        setKeyboardOpen(isFormField(active));
      }, 50);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [isMobile]);

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
  const baseAmountLabel =
    state.mode === "subscription"
      ? `R$ ${Number(state.planPrice ?? 0).toFixed(2).replace(".", ",")}/mês`
      : `R$ ${Number(state.unitPrice ?? 0).toFixed(2).replace(".", ",")}`;
  const amountLabel =
    useCashback && cashbackAmount > 0
      ? state.mode === "subscription"
        ? `R$ ${finalAmount.toFixed(2).replace(".", ",")} (1ª cobrança)`
        : `R$ ${finalAmount.toFixed(2).replace(".", ",")}`
      : baseAmountLabel;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 pt-2 pb-8 md:pt-6 md:pb-12">
        <button
          onClick={() => navigate(state.cancelUrl || -1 as any)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 md:mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-4 md:gap-6 md:grid-cols-[1fr_360px]"
        >
          <div className="order-2 md:order-1">
            <h1 className="font-display text-xl md:text-3xl font-bold mb-1">
              Pagamento seguro
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mb-4 md:mb-6">
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
                initialPhone={profile?.phone_verified ? profile?.phone || "" : ""}
                onStepChange={setStep}
                onReady={(submit) => {
                  submitRef.current = submit;
                }}
                onSubmittingChange={setMobileSubmitting}
                cashbackAmount={useCashback ? cashbackAmount : 0}
                onCashbackRejected={() => {
                  // Server rejected our cashback amount. Clear the selection,
                  // turn off the toggle and refetch the live balance so the UI
                  // matches the source of truth before the next attempt.
                  setCashbackAmount(0);
                  setUseCashback(false);
                  void refreshCashbackAccount();
                }}
                isMobile={isMobile}
                keyboardOpen={keyboardOpen}
              />
            </Elements>
          </div>

          {/* Order summary */}
          <Card className="order-1 md:order-2 p-5 h-fit md:sticky md:top-6">
            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <CollapsibleTrigger
                disabled={!isMobile}
                className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-default"
                aria-label={summaryOpen ? "Recolher resumo" : "Expandir resumo"}
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    Resumo do pedido
                  </h2>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="text-sm truncate">{title}</span>
                    <span className="font-semibold whitespace-nowrap">{amountLabel}</span>
                  </div>
                </div>
                {isMobile && (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      summaryOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="border-t border-border pt-3 mt-3">
                  {state.mode === "subscription" && (
                    <p className="text-xs text-muted-foreground">
                      Cobrança recorrente mensal. Cancele quando quiser pelo painel do aluno.
                    </p>
                  )}
                  {state.mode === "unit" && (
                    <p className="text-xs text-muted-foreground">
                      Compra avulsa. Acesso permanente a este conteúdo.
                    </p>
                  )}
                </div>

                {cashbackEnabled && (
                  <div className="border-t border-border pt-3 mt-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Wallet className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">Usar meu cashback</p>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            Saldo:{" "}
                            <span className="font-medium text-foreground">
                              R$ {(cashbackAccount?.balance_available ?? 0).toFixed(2).replace(".", ",")}
                            </span>
                            {" · "}máx.{" "}
                            <span className="font-medium text-foreground">
                              R$ {maxUsableCashback.toFixed(2).replace(".", ",")}
                            </span>{" "}
                            ({cashbackConfig.max_checkout_pct}% do pedido)
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={useCashback}
                        onCheckedChange={setUseCashback}
                        aria-label="Usar saldo de cashback"
                      />
                    </div>
                    {useCashback && (
                      <div className="space-y-2">
                        <Slider
                          value={[Math.round(cashbackAmount * 100)]}
                          onValueChange={(v) => setCashbackAmount(v[0] / 100)}
                          min={0}
                          max={Math.round(maxUsableCashback * 100)}
                          step={1}
                          aria-label="Valor de cashback a aplicar"
                        />
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Aplicado</span>
                          <span className="font-semibold text-primary">
                            − R$ {cashbackAmount.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {useCashback && cashbackAmount > 0 && (
                  <div className="border-t border-border pt-3 mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{baseAmountLabel}</span>
                    </div>
                    <div className="flex justify-between text-primary">
                      <span>Cashback</span>
                      <span>− R$ {cashbackAmount.toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-border mt-1">
                      <span>Total</span>
                      <span>R$ {finalAmount.toFixed(2).replace(".", ",")}</span>
                    </div>
                    {state.mode === "subscription" && (
                      <p className="text-[10px] text-muted-foreground pt-1">
                        Desconto válido apenas na 1ª cobrança. As próximas voltam ao valor cheio.
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-border pt-3 mt-3">
                  <div className="flex items-center gap-2 text-xs text-success">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Pagamento processado com segurança
                  </div>
                  <div className="mt-3">
                    <PaymentSecurityBadge />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <InviteFriendsPanel
            variant="compact"
            className="order-3 md:order-3 mt-4"
            eyebrow="Indique amigos: Créditos de IA + Cashback"
          />
        </motion.div>
      </div>

      {/* Mobile sticky pay bar — hidden when virtual keyboard is open */}
      {isMobile && !keyboardOpen && (
        <>
          <div
            aria-hidden
            className="h-20"
          />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 shadow-[0_-4px_20px_-4px_hsl(var(--background))]">
            <div className="mx-auto flex max-w-4xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <p className="font-display text-base font-bold leading-tight truncate">
                  {amountLabel}
                </p>
              </div>
              <Button
                onClick={() => submitRef.current?.()}
                disabled={mobileSubmitting}
                size="lg"
                className="font-display whitespace-nowrap"
              >
                {mobileSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...
                  </>
                ) : state.mode === "subscription" ? (
                  "Confirmar e assinar"
                ) : (
                  "Confirmar e pagar"
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface CheckoutFormProps {
  state: EmbeddedCheckoutState;
  initialName: string;
  initialCpf: string;
  initialPhone?: string;
  onStepChange?: (s: CheckoutStep) => void;
  onReady?: (submit: () => void) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  cashbackAmount?: number;
  onCashbackRejected?: (message: string) => void;
  isMobile?: boolean;
  keyboardOpen?: boolean;
}

function CheckoutForm({
  state,
  initialName,
  initialCpf,
  initialPhone,
  onStepChange,
  onReady,
  onSubmittingChange,
  cashbackAmount = 0,
  onCashbackRejected,
  isMobile = false,
  keyboardOpen = false,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user, refreshSubscription } = useAuth();
  const { beta } = useBetaMode();
  const [submitting, setSubmitting] = useState(false);
  // Sticky "we're leaving" flag. Becomes true the moment we commit to
  // navigating away (success, alreadyOwned, alreadySucceededOnRetry,
  // payment-success polling). Stays true for the rest of this
  // component's lifetime so the Pay button is disabled during the
  // brief window between `setSubmitting(false)` running in the
  // `finally` block and the route actually unmounting. Without this,
  // the user could squeeze in an extra click while React is still
  // flushing the navigation.
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // Hard guard against double-navigation. Once we've decided to leave the
  // checkout page (success, already-owned, retry-already-confirmed, …),
  // any further navigate(...) call from this component is dropped. This
  // protects against:
  //   • React StrictMode / re-renders firing handlers twice
  //   • Duplicate edge-function responses (network retries) racing the
  //     Stripe confirm callback
  //   • A late `confirmCardPayment` resolution after we've already
  //     redirected via the `alreadyOwned` branch
  const navigatedRef = useRef(false);
  const safeNavigate: typeof navigate = (...args) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    setRedirecting(true);
    return navigate(...(args as Parameters<typeof navigate>));
  };

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

  const billingValid = validateBilling() === null;

  // Sync step indicator: billing → card → confirm
  useEffect(() => {
    if (submitting) {
      onStepChange?.("confirm");
    } else if (billingValid) {
      onStepChange?.("card");
    } else {
      onStepChange?.("billing");
    }
  }, [billingValid, submitting, onStepChange]);

  // Mirror submitting state to parent (for mobile sticky bar button)
  useEffect(() => {
    // Mirror BOTH `submitting` and the sticky `redirecting` flag so
    // the mobile sticky-bar button stays disabled during the brief
    // post-success window before the route unmounts.
    onSubmittingChange?.(submitting || redirecting);
  }, [submitting, redirecting, onSubmittingChange]);

  // Expose latest handleSubmit to parent via ref-callback
  const handleSubmitRef = useRef<() => void>(() => {});
  useEffect(() => {
    onReady?.(() => handleSubmitRef.current?.());
  }, [onReady]);

  const handleSubmit = async () => {
    if (!beta && (!stripe || !elements)) return;
    // Belt-and-braces: if we've already committed to navigating away,
    // refuse any further submit attempts even if the button somehow
    // received a click (e.g. a keypress queued before the disabled
    // attribute applied).
    if (redirecting) return;
    setError(null);

    const billingError = validateBilling();
    if (billingError) {
      setError(billingError);
      return;
    }

    setSubmitting(true);
    if (beta) {
      try {
        const { error: betaErr } = await supabase.rpc("beta_simulate_checkout", {
          _mode: state.mode,
          _price_id: state.priceId ?? "",
          _content_id: (state.contentId ?? null) as any,
          _content_type: state.contentType ?? "",
          _amount: Number(state.mode === "subscription" ? state.planPrice ?? 0 : state.unitPrice ?? 0),
        });
        if (betaErr) {
          setError(betaErr.message || "Não foi possível concluir a simulação.");
          return;
        }
        toast.success("Simulação concluída! Nenhuma cobrança foi feita.");
        setRedirecting(true);
        if (state.mode === "subscription") {
          try { await refreshSubscription(); } catch { /* ignore */ }
          safeNavigate("/dashboard?tab=subscription", { replace: true });
        } else {
          safeNavigate(`/aula/${state.contentId}`, { replace: true });
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }
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
            email: user?.email || undefined,
            phone: (() => {
              const digits = (initialPhone || "").replace(/\D/g, "");
              if (!digits) return undefined;
              // Already starts with country code 55
              return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
            })(),
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
          ? {
              priceId: state.priceId,
              paymentMethodId: paymentMethod.id,
              billing: billingPayload,
              cashbackAmount,
            }
          : {
              contentId: state.contentId,
              contentType: state.contentType,
              paymentMethodId: paymentMethod.id,
              billing: billingPayload,
              cashbackAmount,
            };

      const { data, error: fnError } = await supabase.functions.invoke(fnName, { body });
      if (fnError) throw fnError;
      const action = classifyCheckoutResponse(data, state.mode);

      if (action.kind === "error") {
        if (action.cashbackRejected) {
          toast.error(action.message, {
            description:
              "Ajustamos seu saldo de cashback. Revise o valor aplicado e tente novamente.",
            duration: 7000,
          });
          onCashbackRejected?.(action.message);
        }
        setError(action.message);
        return;
      }

      if (action.kind === "alreadyOwned") {
        // Idempotent retry: server detected an existing purchase / active
        // sub. No cashback was reapplied server-side. Skip 3DS entirely
        // and go straight to the final destination (subscription tab or
        // lesson page) — bypassing /payment-success polling, which would
        // be confusing for an already-completed purchase.
        toast.success(action.message);
        if (state.mode === "subscription") {
          try {
            await refreshSubscription();
          } catch {
            /* ignore */
          }
          safeNavigate("/dashboard?tab=subscription", { replace: true });
        } else {
          safeNavigate(`/aula/${state.contentId}`, { replace: true });
        }
        return;
      }

      const clientSecret: string | null =
        action.kind === "needsConfirmation" ? action.clientSecret : null;

      // 4. If a client_secret was returned, confirm 3DS / SCA on the card.
      // If cashback covered 100% of the cart, no clientSecret comes back —
      // the purchase is already completed server-side.
      if (clientSecret) {
        const { error: confirmError, paymentIntent } =
          await stripe.confirmCardPayment(clientSecret);
        const decision = classifyStripeConfirm({
          errorCode: (confirmError as { code?: string } | undefined)?.code,
          errorMessage: confirmError?.message,
          paymentIntentStatus: paymentIntent?.status,
        });
        if (decision.kind === "fail") {
          setError(decision.message);
          return;
        }
        if (decision.kind === "alreadySucceededOnRetry") {
          console.info(
            `[Checkout] ${state.mode} payment already confirmed on retry — no cashback reapplied`,
          );
          // Network retry on an already-confirmed PI: webhook already
          // ran (or will shortly), cashback was consumed exactly once.
          // Skip the /payment-success polling page and land the user
          // directly on the final destination.
          toast.success(
            state.mode === "subscription"
              ? "Assinatura já confirmada."
              : "Pagamento já confirmado.",
          );
          if (state.mode === "subscription") {
            try {
              await refreshSubscription();
            } catch {
              /* ignore */
            }
            safeNavigate("/dashboard?tab=subscription", { replace: true });
          } else {
            safeNavigate(`/aula/${state.contentId}`, { replace: true });
          }
          return;
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
        safeNavigate("/payment-success", { replace: true });
      } else {
        safeNavigate(
          `/payment-success?session_id=${data.paymentIntentId || ""}&content_id=${state.contentId}`,
          { replace: true },
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

  // Always point ref at latest closure so parent's stable callback works
  handleSubmitRef.current = handleSubmit;

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
        {beta ? (
          <div className="space-y-3">
            <div role="status" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
              <strong>Versão beta:</strong> este é um cartão fictício, usado apenas para simular o uso. Você não pagará nada pelo uso do sistema.
            </div>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="beta-card">Número do cartão</Label>
                <Input id="beta-card" value={BETA_TEST_CARD.number} readOnly disabled />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="beta-exp">Validade</Label>
                  <Input id="beta-exp" value={BETA_TEST_CARD.expiry} readOnly disabled />
                </div>
                <div>
                  <Label htmlFor="beta-cvc">CVC</Label>
                  <Input id="beta-cvc" value={BETA_TEST_CARD.cvc} readOnly disabled />
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="rounded-md border border-border bg-background p-3">
          <PaymentElement
            options={{
              layout: "tabs",
              fields: { billingDetails: "never" },
              wallets: { applePay: "never", googlePay: "never" },
            }}
          />
        </div>
        )}
        <p className="text-[11px] text-muted-foreground leading-snug">
          Aceitamos Visa, Mastercard, Elo, American Express, Hipercard e outras bandeiras.
        </p>
        {initialPhone && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-snug text-foreground/80"
          >
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" aria-hidden />
            <span>
              Telefone verificado será usado para segurança da transação (antifraude).{" "}
              <a
                href="/privacidade#antifraude"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Saiba mais
              </a>
            </span>
          </div>
        )}
      </Card>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!stripe || submitting || redirecting}
        size="lg"
        className={cn(
          "w-full font-display",
          // On mobile, the sticky footer already has the CTA. Hide the form
          // button while the sticky bar is visible to avoid two identical
          // "Confirmar e assinar" buttons on screen at the same time.
          isMobile && !keyboardOpen && "hidden"
        )}
      >
        {submitting || redirecting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando pagamento...
          </>
        ) : state.mode === "subscription" ? (
          "Confirmar e assinar"
        ) : (
          "Confirmar e pagar"
        )}
      </Button>

      {redirecting && (
        <p
          role="status"
          aria-live="polite"
          className="text-center text-xs text-muted-foreground"
        >
          Estamos confirmando seu pagamento. Não feche esta janela nem clique novamente — você será redirecionado em instantes.
        </p>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Ao confirmar, você concorda com os Termos de Uso e Política de Privacidade.
      </p>
    </div>
  );
}

export default Checkout;
