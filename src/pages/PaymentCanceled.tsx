import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PaymentCanceled = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
        >
          <XCircle className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
        </motion.div>
        <h1 className="font-display text-2xl font-bold mb-2">Pagamento cancelado</h1>
        <p className="text-muted-foreground mb-6">
          Você cancelou o processo de pagamento. Nenhuma cobrança foi realizada.
          Quando estiver pronto, você pode assinar a qualquer momento.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar ao início
          </Button>
          <Button onClick={() => navigate("/#pricing")}>
            Ver planos
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentCanceled;
