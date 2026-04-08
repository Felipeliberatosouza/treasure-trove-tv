import { motion } from "framer-motion";
import { Gift, ArrowRight, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";

const FreeTrialBanner = () => {
  const { user } = useAuth();
  const trial = useFreeTrial();
  const [starting, setStarting] = useState(false);

  // Don't render if trial feature is disabled or still loading
  if (trial.loading || !trial.trialEnabled) return null;

  // Don't show if user already has an expired trial
  if (trial.trialRow && !trial.hasActiveTrial) return null;

  const handleStart = async () => {
    if (!user) return;
    setStarting(true);
    const ok = await trial.startTrial();
    if (ok) toast.success("Teste grátis ativado! Aproveite.");
    else toast.error("Não foi possível iniciar o teste grátis.");
    setStarting(false);
  };

  // Active trial — show remaining info
  if (trial.hasActiveTrial) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-6 md:mx-12 lg:mx-20 -mt-6 mb-6"
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-5 md:p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-foreground">Teste Grátis Ativo</p>
                <p className="text-xs text-muted-foreground">
                  {trial.trialType === "days" ? (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {trial.daysRemaining} dia(s) restante(s)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" /> {trial.videosRemaining} vídeo(s) restante(s)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button size="sm" className="gap-2 font-display font-semibold" asChild>
              <a href="#pricing">
                <ArrowRight className="h-4 w-4" /> Assinar para acesso total
              </a>
            </Button>
          </div>
        </div>
      </motion.section>
    );
  }

  // Not logged in or hasn't started trial yet
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-6 md:mx-12 lg:mx-20 -mt-6 mb-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/10 via-primary/5 to-primary/10 p-5 md:p-8">
        <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/20">
              <Gift className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                Experimente grátis!
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {trial.trialType === "days"
                  ? "Teste a plataforma por alguns dias sem compromisso. Acesse aulas, revisões e muito mais."
                  : "Assista a alguns vídeos gratuitamente e descubra como a Revisão Fácil pode te ajudar."}
              </p>
            </div>
          </div>
          {user ? (
            <Button
              onClick={handleStart}
              disabled={starting}
              size="lg"
              className="gap-2 font-display font-semibold shrink-0"
            >
              <Gift className="h-4 w-4" />
              {starting ? "Ativando..." : "Iniciar Teste Grátis"}
            </Button>
          ) : (
            <Button size="lg" className="gap-2 font-display font-semibold shrink-0" asChild>
              <Link to="/login">
                <Gift className="h-4 w-4" /> Entrar e Testar Grátis
              </Link>
            </Button>
          )}
        </div>
      </div>
    </motion.section>
  );
};

export default FreeTrialBanner;
