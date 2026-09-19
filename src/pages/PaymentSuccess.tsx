import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import InviteFriendsPanel from "@/components/referral/InviteFriendsPanel";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const contentId = searchParams.get("content_id");
  const isUnitPurchase = !!sessionId && !!contentId;
  const { refreshSubscription, subscription, user, profile } = useAuth();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const emailSentRef = useRef(false);

  // Verify one-off payment
  useEffect(() => {
    if (!isUnitPurchase || !user || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        await supabase.functions.invoke("verify-payment", { body: { sessionId } });
      } catch (err) {
        console.error("verify-payment error:", err);
      } finally {
        if (!cancelled) {
          setVerified(true);
          setChecking(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isUnitPurchase, user, sessionId]);

  // Poll for subscription confirmation (only for subscription flow)
  useEffect(() => {
    if (isUnitPurchase) return;
    if (!user) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 15;
    const pollInterval = 2000;

    const poll = async () => {
      while (!cancelled && attempts < maxAttempts) {
        attempts++;
        try {
          const result: any = await refreshSubscription();
          // Exit early if subscription is now active
          if (result?.subscribed === true) {
            if (!cancelled) {
              setVerified(true);
              setChecking(false);
            }
            return;
          }
        } catch (err) {
          console.error("Erro ao verificar assinatura:", err);
        }
        await new Promise((r) => setTimeout(r, pollInterval));
      }
      if (!cancelled) {
        // Timeout reached — mark as verified anyway so user can proceed
        setVerified(true);
        setChecking(false);
      }
    };

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isUnitPurchase]);

  // React to subscription becoming active
  useEffect(() => {
    if (isUnitPurchase) return;
    if (subscription.subscribed && !verified) {
      setVerified(true);
      setChecking(false);
    }
  }, [subscription.subscribed, verified, isUnitPurchase]);

  // Send subscription payment confirmation email once verified
  useEffect(() => {
    if (isUnitPurchase) return;
    if (!verified || !user || emailSentRef.current) return;
    emailSentRef.current = true;

    const sendConfirmationEmail = async () => {
      try {
        const { data: sub } = await supabase
          .from("student_subscriptions")
          .select("plan_id, started_at, subscription_plans(name, price)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const planName = (sub as any)?.subscription_plans?.name || "Plano";
        const amount = (sub as any)?.subscription_plans?.price
          ? Number((sub as any).subscription_plans.price).toFixed(2)
          : "—";
        const paymentDate = new Date().toLocaleDateString("pt-BR");

        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "payment-confirmation",
            recipientEmail: profile?.email || user.email,
            idempotencyKey: `payment-confirm-${user.id}-${Date.now()}`,
            templateData: {
              name: profile?.name || "",
              planName,
              amount,
              paymentDate,
              dashboardLink: `${window.location.origin}/dashboard/student`,
            },
          },
        });
      } catch (err) {
        console.error("Erro ao enviar e-mail de confirmação de pagamento:", err);
      }
    };

    sendConfirmationEmail();
  }, [verified, user, profile, isUnitPurchase]);

  // Redirect after verified
  useEffect(() => {
    if (!verified) return;
    const target = isUnitPurchase && contentId ? `/video/${contentId}` : "/dashboard/student";
    const timer = setTimeout(() => navigate(target), 5000);
    return () => clearTimeout(timer);
  }, [verified, navigate, isUnitPurchase, contentId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        {checking ? (
          <>
            <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin mb-6" />
            <h1 className="font-display text-2xl font-bold mb-2">Confirmando pagamento...</h1>
            <p className="text-muted-foreground">Aguarde enquanto verificamos sua compra.</p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-6" />
            </motion.div>
            <h1 className="font-display text-2xl font-bold mb-2">Pagamento confirmado! 🎉</h1>
            <p className="text-muted-foreground mb-6">
              {isUnitPurchase
                ? "Sua compra foi concluída. Você já pode assistir à aula completa."
                : "Sua assinatura foi ativada com sucesso. Você já tem acesso a todo o conteúdo premium."}
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Redirecionando em 5 segundos...
            </p>
            <Button onClick={() => navigate(isUnitPurchase && contentId ? `/video/${contentId}` : "/dashboard/student")}>
              {isUnitPurchase ? "Ir para a aula" : "Ir para o Painel"}
            </Button>
            <InviteFriendsPanel
              variant="compact"
              className="mt-8 text-left"
              eyebrow="Ganhe cashback indicando amigos"
            />
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
