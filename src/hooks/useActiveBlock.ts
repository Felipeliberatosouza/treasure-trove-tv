import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveBlockInfo {
  id: string;
  reason: string | null;
  blocked_at: string;
  blocked_until: string;
}

/**
 * Consulta `user_blocks` para o usuário autenticado. Retorna o bloqueio ativo
 * (se houver) e agenda uma limpeza automática quando `blocked_until` expirar.
 */
export const useActiveBlock = () => {
  const { user } = useAuth();
  const [block, setBlock] = useState<ActiveBlockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setBlock(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const check = async () => {
      const { data } = await supabase
        .from("user_blocks")
        .select("id, reason, blocked_at, blocked_until")
        .eq("user_id", user.id)
        .is("unblocked_at", null)
        .gt("blocked_until", new Date().toISOString())
        .order("blocked_until", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (data) {
        setBlock(data as ActiveBlockInfo);
        if (expiryTimer.current) clearTimeout(expiryTimer.current);
        const ms = Math.max(
          1_000,
          new Date(data.blocked_until).getTime() - Date.now() + 1_000
        );
        expiryTimer.current = setTimeout(() => {
          if (!cancelled) setBlock(null);
        }, ms);
      } else {
        setBlock(null);
      }
      setLoading(false);
    };

    void check();
    const t = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
    };
  }, [user?.id]);

  return { block, loading };
};