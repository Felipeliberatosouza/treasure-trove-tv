import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Loader2, ShieldCheck, Trash2, Star } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StripeCardForm from "./StripeCardForm";
import PaymentSecurityBadge from "@/components/PaymentSecurityBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  isDefault?: boolean;
}

/**
 * Lets the student manage the credit card used for subscription billing
 * 100% in-app (no portal redirect):
 *  - lists saved cards from the payment provider
 *  - lets the student add a new card via Stripe Elements (SetupIntent)
 *  - automatically sets the new card as default on the subscription
 *  - optionally removes the previous cards
 */
export default function PaymentMethodCard() {
  const [loading, setLoading] = useState(true);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const stripePromise = useMemo(() => getStripe(), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-setup-intent");
      if (error) throw error;
      setSavedCards((data?.savedCards as SavedCard[]) || []);
      setClientSecret((data?.clientSecret as string) || null);
    } catch (e) {
      console.error("[PaymentMethodCard] load failed", e);
      toast.error("Não foi possível carregar suas formas de pagamento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Allow other parts of the dashboard (e.g. the past-due billing alert) to
  // open the "add new card" form by dispatching a window event.
  useEffect(() => {
    const open = () => {
      setReplaceMode(false);
      setShowForm(true);
      // Defer scroll until the form is rendered.
      setTimeout(() => {
        const el = document.getElementById("payment-method-card");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };
    window.addEventListener("open-payment-method-form", open);
    return () => window.removeEventListener("open-payment-method-form", open);
  }, []);

  const handlePaymentMethodReady = async (pmId: string) => {
    const { data, error } = await supabase.functions.invoke("update-payment-method", {
      body: { paymentMethodId: pmId, removeOthers: replaceMode },
    });
    if (error) {
      toast.error("Falha ao salvar o cartão. Tente novamente.");
      throw error;
    }
    if (!data?.ok) {
      toast.error(data?.error || "Não foi possível atualizar o cartão.");
      throw new Error(data?.error || "update failed");
    }

    const paid = Number(data?.paidInvoices ?? 0);
    const failed = Number(data?.failedInvoices ?? 0);

    if (paid > 0) {
      toast.success(
        paid === 1
          ? "Cartão atualizado e fatura em aberto regularizada com sucesso."
          : `Cartão atualizado e ${paid} faturas em aberto regularizadas com sucesso.`
      );
    } else if (failed > 0) {
      toast.warning(
        "Cartão atualizado, mas a tentativa de pagar a fatura em aberto falhou. Tentaremos novamente em breve."
      );
    } else {
      toast.success(
        replaceMode
          ? "Cartão substituído com sucesso. Próximas cobranças usarão o novo cartão."
          : "Cartão adicionado com sucesso e definido como padrão."
      );
    }

    setShowForm(false);
    setReplaceMode(false);
    await load();
    // Notify the dashboard so the past-due alert can refresh.
    window.dispatchEvent(new CustomEvent("billing-status-refresh"));
  };

  const handleRemoveCard = async (pmId: string) => {
    setRemovingId(pmId);
    try {
      const { data, error } = await supabase.functions.invoke("detach-payment-method", {
        body: { paymentMethodId: pmId },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.error || "Não foi possível remover o cartão.");
        return;
      }
      toast.success("Cartão removido.");
      await load();
    } catch (e) {
      console.error("[PaymentMethodCard] remove failed", e);
      toast.error("Falha ao remover o cartão. Tente novamente.");
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  const handleSetDefault = async (pmId: string) => {
    setSettingDefaultId(pmId);
    try {
      const { data, error } = await supabase.functions.invoke("update-payment-method", {
        body: { paymentMethodId: pmId, removeOthers: false },
      });
      if (error) throw error;
      if (!data?.ok) {
        toast.error(data?.error || "Não foi possível definir como padrão.");
        return;
      }
      toast.success("Cartão definido como padrão. Próximas cobranças usarão este cartão.");
      await load();
    } catch (e) {
      console.error("[PaymentMethodCard] set default failed", e);
      toast.error("Falha ao definir como padrão. Tente novamente.");
    } finally {
      setSettingDefaultId(null);
    }
  };

  const defaultCard = savedCards.find((c) => c.isDefault) || savedCards[0];
  const otherCards = savedCards.filter((c) => c.id !== defaultCard?.id);
  const cardToRemove = otherCards.find((c) => c.id === confirmRemoveId);

  return (
    <Card id="payment-method-card" className="border border-border scroll-mt-24">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CreditCard className="h-4 w-4 text-primary" />
          Forma de pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {defaultCard ? (
              <div className="rounded-md border border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md bg-background border border-border px-2 py-1 text-[10px] font-semibold uppercase">
                    {defaultCard.brand}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      •••• {defaultCard.last4}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Validade {String(defaultCard.exp_month).padStart(2, "0")}/
                      {String(defaultCard.exp_year).slice(-2)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Padrão
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhum cartão cadastrado. Adicione um cartão para suas próximas cobranças.
              </p>
            )}

            {otherCards.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Outros cartões
                </p>
                {otherCards.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-md border border-border px-3 py-2 flex items-center gap-2 text-xs"
                  >
                    <span className="font-semibold uppercase text-[10px]">{c.brand}</span>
                    <span>•••• {c.last4}</span>
                    <span className="text-muted-foreground ml-auto">
                      {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => handleSetDefault(c.id)}
                      disabled={settingDefaultId === c.id || removingId === c.id}
                      aria-label={`Tornar padrão o cartão ${c.brand} final ${c.last4}`}
                    >
                      {settingDefaultId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star className="h-3.5 w-3.5 mr-1" />
                      )}
                      Tornar padrão
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmRemoveId(c.id)}
                      disabled={removingId === c.id || settingDefaultId === c.id}
                      aria-label={`Remover cartão ${c.brand} final ${c.last4}`}
                    >
                      {removingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!showForm && (
              <div className="flex flex-wrap gap-2">
                {defaultCard ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplaceMode(true);
                        setShowForm(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Substituir cartão
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReplaceMode(false);
                        setShowForm(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar outro
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setReplaceMode(false);
                      setShowForm(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar cartão
                  </Button>
                )}
              </div>
            )}

            {showForm && clientSecret && (
              <div className="rounded-md border border-border p-3 space-y-3 bg-background">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {replaceMode ? "Substituir cartão" : "Adicionar novo cartão"}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      setReplaceMode(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {replaceMode && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    O cartão atual será removido e o novo passará a ser usado nas próximas cobranças.
                  </p>
                )}
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret, appearance: { theme: "stripe" } }}
                >
                  <StripeCardForm
                    onPaymentMethodReady={handlePaymentMethodReady}
                    ctaLabel={replaceMode ? "Substituir cartão" : "Salvar cartão"}
                  />
                </Elements>
              </div>
            )}

            {!showForm && <PaymentSecurityBadge />}
          </>
        )}
      </CardContent>

      <AlertDialog
        open={!!confirmRemoveId}
        onOpenChange={(o) => !o && setConfirmRemoveId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              {cardToRemove ? (
                <>
                  O cartão{" "}
                  <span className="font-semibold uppercase">{cardToRemove.brand}</span>{" "}
                  final <span className="font-mono">•••• {cardToRemove.last4}</span> será
                  removido permanentemente. Esta ação não pode ser desfeita.
                </>
              ) : (
                "Tem certeza que deseja remover este cartão?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemoveId && handleRemoveCard(confirmRemoveId)}
              disabled={!!removingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
