import { motion } from "framer-motion";
import { Gift, ArrowRight, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const EMPTY_COUNTDOWN = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function useCountdown(expiresAt: Date | null) {
  const [timeLeft, setTimeLeft] = useState(EMPTY_COUNTDOWN);
  const expiresMs = expiresAt?.getTime() ?? null;

  useEffect(() => {
    if (expiresMs === null) {
      setTimeLeft((prev) =>
        prev.days === 0 && prev.hours === 0 && prev.minutes === 0 && prev.seconds === 0
          ? prev
          : EMPTY_COUNTDOWN,
      );
      return;
    }

    let intervalId: number | null = null;

    const calc = () => {
      const diff = expiresMs - Date.now();

      if (diff <= 0) {
        setTimeLeft((prev) =>
          prev.days === 0 && prev.hours === 0 && prev.minutes === 0 && prev.seconds === 0
            ? prev
            : EMPTY_COUNTDOWN,
        );

        if (intervalId !== null) window.clearInterval(intervalId);
        return;
      }

      const nextTimeLeft = {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };

      setTimeLeft((prev) =>
        prev.days === nextTimeLeft.days &&
        prev.hours === nextTimeLeft.hours &&
        prev.minutes === nextTimeLeft.minutes &&
        prev.seconds === nextTimeLeft.seconds
          ? prev
          : nextTimeLeft,
      );
    };

    calc();
    intervalId = window.setInterval(calc, 1000);

    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [expiresMs]);

  return timeLeft;
}

const CountdownUnit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="font-display text-lg font-bold text-primary tabular-nums leading-none">
      {String(value).padStart(2, "0")}
    </span>
    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
  </div>
);

const FreeTrialBanner = () => {
  const { user, allRoles } = useAuth();
  const trial = useFreeTrial();
  const [starting, setStarting] = useState(false);

  const countdown = useCountdown(trial.hasActiveTrial ? trial.expiresAt : null);

  // Don't render if trial feature is disabled or still loading
  if (trial.loading || !trial.trialEnabled) return null;

  // Admins don't see trial banners — they have full unrestricted access
  if (allRoles.includes("admin")) return null;

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
                {trial.trialType === "days" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex items-center gap-1.5">
                      <CountdownUnit value={countdown.days} label="dias" />
                      <span className="text-muted-foreground font-bold text-xs">:</span>
                      <CountdownUnit value={countdown.hours} label="hrs" />
                      <span className="text-muted-foreground font-bold text-xs">:</span>
                      <CountdownUnit value={countdown.minutes} label="min" />
                      <span className="text-muted-foreground font-bold text-xs">:</span>
                      <CountdownUnit value={countdown.seconds} label="seg" />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" /> {trial.videosRemaining} acesso(s) restante(s)
                    </span>
                  </p>
                )}
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
                  ? "Teste a plataforma por alguns dias sem compromisso. Acesse revisões, resumos, simulados e muito mais."
                  : "Acesse gratuitamente alguns conteúdos (revisões, resumos, simulados, top questões e colinhas) e descubra como a Revisão Fácil pode te ajudar."}
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
