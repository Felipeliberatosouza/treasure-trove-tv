import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const { refreshSubscription, user } = useAuth();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const verify = async () => {
      await refreshSubscription();
      attempts++;
      // Give Stripe a moment to process
      if (attempts < maxAttempts) {
        setTimeout(() => {
          setVerified(true);
          setChecking(false);
        }, 2000);
      } else {
        setVerified(true);
        setChecking(false);
      }
    };

    if (user) {
      verify();
    } else {
      setChecking(false);
    }
  }, [user, refreshSubscription]);

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
