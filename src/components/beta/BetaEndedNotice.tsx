import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBetaMode } from "@/hooks/useBetaMode";
import { useActiveSubscription } from "@/hooks/useActiveSubscription";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EndedPlan = { name: string; price: number; stripe_price_id: string | null };

/**
 * Após o fim da Versão Beta, quem assinou com o cartão fictício precisa
 * cadastrar um cartão real para continuar no plano escolhido.
 */
export default function BetaEndedNotice() {
  const { user, role } = useAuth();
  const { beta: betaOn, loaded } = useBetaMode();
  const loading = !loaded;
  const { isActive, loading: subLoading } = useActiveSubscription();
  const [plan, setPlan] = useState<EndedPlan | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!user || role !== "student" || loading || betaOn || subLoading || isActive) {
      setPlan(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("student_subscriptions")
        .select("id, subscription_plans(name, price, stripe_price_id)")
        .eq("user_id", user.id)
        .eq("status", "beta_ended")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const p = (data as any)?.subscription_plans as EndedPlan | undefined;
      if (p) {
        setPlan(p);
        if (sessionStorage.getItem("rf_beta_ended_seen") !== user.id) setOpen(true);
      }
    })();
  }, [user, role, loading, betaOn, subLoading, isActive]);

  if (!plan || pathname === "/checkout") return null;

  const goCheckout = () => {
    if (user) sessionStorage.setItem("rf_beta_ended_seen", user.id);
    setOpen(false);
    if (!plan.stripe_price_id) {
      navigate("/#pricing");
      return;
    }
    navigate("/checkout", {
      state: { mode: "subscription", priceId: plan.stripe_price_id, planName: plan.name, planPrice: plan.price, cancelUrl: "/" },
    });
  };

  const close = () => {
    if (user) sessionStorage.setItem("rf_beta_ended_seen", user.id);
    setOpen(false);
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 shadow-lg">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center text-sm md:flex-row md:justify-between md:text-left">
          <span className="text-foreground">
            A versão beta terminou. Para continuar no <strong>Plano {plan.name}</strong>, cadastre seu cartão de crédito.
          </span>
          <Button size="sm" onClick={goCheckout}>
            <CreditCard className="mr-2 h-4 w-4" /> Cadastrar cartão
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>A versão beta terminou</DialogTitle>
            <DialogDescription>
              Obrigado por testar a Revisão Fácil! Durante a versão beta você usou um cartão fictício, então não há cartão
              cadastrado na sua conta. Para continuar usando o Plano {plan.name}, atualize seu cadastro com os dados do seu
              cartão de crédito.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => { close(); navigate("/#pricing"); }}>Ver outros planos</Button>
            <Button onClick={goCheckout}><CreditCard className="mr-2 h-4 w-4" /> Cadastrar cartão e continuar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
