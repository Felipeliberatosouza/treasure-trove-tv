import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 5 * 60 * 1000; // 5 minutes before timeout

export function useInactivityTimeout() {
  const { user, signOut } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    setShowWarning(false);
  }, []);

  const resetTimers = useCallback(() => {
    if (!user) return;
    clearTimers();

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      toast.warning("Sua sessão expirará em 5 minutos por inatividade", {
        duration: 10000,
      });
    }, TIMEOUT_MS - WARNING_MS);

    timeoutRef.current = setTimeout(async () => {
      toast.info("Sessão encerrada por inatividade");
      await signOut();
      window.location.href = "/login";
    }, TIMEOUT_MS);
  }, [user, signOut, clearTimers]);

  useEffect(() => {
    if (!user) {
      clearTimers();
      return;
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    
    let throttled = false;
    const handleActivity = () => {
      if (throttled) return;
      throttled = true;
      resetTimers();
      setTimeout(() => { throttled = false; }, 1000);
    };

    events.forEach((event) => document.addEventListener(event, handleActivity, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      clearTimers();
    };
  }, [user, resetTimers, clearTimers]);

  return { showWarning };
}
