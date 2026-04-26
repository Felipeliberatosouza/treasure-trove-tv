import { useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Floating banner shown when the subscription verification service is
 * temporarily unavailable (Stripe outage, edge cold-start, network blip).
 * Lets the user dismiss it or trigger a manual retry.
 */
const SubscriptionUnavailableBanner = () => {
  const { user, subscriptionUnavailable, refreshSubscription } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!user || !subscriptionUnavailable || dismissed) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshSubscription();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[60] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 rounded-lg border border-border bg-card text-card-foreground shadow-lg"
    >
      <div className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            Verificação da assinatura indisponível
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Não conseguimos confirmar seu plano agora. Tente novamente em instantes.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={handleRetry}
              disabled={retrying}
              className="h-8"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Tentando..." : "Tentar novamente"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDismissed(true)}
              className="h-8"
            >
              Fechar
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Fechar aviso"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default SubscriptionUnavailableBanner;