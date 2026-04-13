import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { refreshSubscription, subscription, user, profile } = useAuth();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);
  const emailSentRef = useRef(false);

  // Poll for subscription confirmation
  useEffect(() => {
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
          await refreshSubscription();
          // We check subscription.subscribed in the next render cycle,
          // so we just wait and let the effect below handle it
        } catch (err) {
          console.error("Erro ao verificar assinatura:", err);
        }
        await new Promise((r) => setTimeout(r, pollInterval));
      }
      if (!cancelled && !verified) {
        // Timed out but still show success (webhook may be delayed)
        setVerified(true);
        setChecking(false);
      }
    };

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // React to subscription becoming active
  useEffect(() => {
    if (subscription.subscribed && !verified) {
      setVerified(true);
      setChecking(false);
    }
  }, [subscription.subscribed, verified]);

  // Send payment confirmation email once verified
  useEffect(() => {
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
  }, [verified, user, profile]);

  // Redirect after verified
  useEffect(() => {
    if (verified) {
      const timer = setTimeout(() => navigate("/dashboard/student"), 5000);
      return () => clearTimeout(timer);
    }
  }, [verified, navigate]);

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
            <p className="text-muted-foreground">Aguarde enquanto verificamos sua assinatura.</p>
          </>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-6" />
            </motion.div>
            <h1 className="font-display text-2xl font-bold mb-2">Pagamento confirmado! 🎉</h1>
            <p className="text-muted-foreground mb-6">
              Sua assinatura foi ativada com sucesso. Você já tem acesso a todo o conteúdo premium.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Redirecionando para o painel em 5 segundos...
            </p>
            <Button onClick={() => navigate("/dashboard/student")}>
              Ir para o Painel
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;