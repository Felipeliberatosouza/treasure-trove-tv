import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminAlerts {
  /** Há aulas ou resoluções aguardando aprovação. */
  pendingContent: boolean;
  /** Há dúvidas de alunos aguardando aprovação do admin. */
  pendingDoubts: boolean;
  /** Há assinaturas vencendo nos próximos 7 dias. */
  expiringSubscriptions: boolean;
}

const EMPTY: AdminAlerts = {
  pendingContent: false,
  pendingDoubts: false,
  expiringSubscriptions: false,
};

/**
 * Sinalizadores para o menu do administrador. Dispara um count(*) leve em cada
 * tabela e revalida a cada 2 minutos enquanto o menu estiver montado.
 */
export const useAdminAlerts = (): AdminAlerts => {
  const { user, role } = useAuth();
  const [alerts, setAlerts] = useState<AdminAlerts>(EMPTY);

  useEffect(() => {
    if (!user || role !== "admin") {
      setAlerts(EMPTY);
      return;
    }

    let cancelled = false;

    const fetchAlerts = async () => {
      const lessonsPromise = supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("admin_approved", false);
      const examsPromise = supabase
        .from("exam_solutions")
        .select("id", { count: "exact", head: true })
        .eq("admin_approved", false);
      const doubtsPromise = supabase
        .from("student_doubts")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval");

      const now = new Date();
      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);
      const subsPromise = supabase
        .from("student_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("expires_at", now.toISOString())
        .lte("expires_at", in7days.toISOString());

      const [lessonsRes, examsRes, doubtsRes, subsRes] = await Promise.all([
        lessonsPromise,
        examsPromise,
        doubtsPromise,
        subsPromise,
      ]);

      if (cancelled) return;

      setAlerts({
        pendingContent: ((lessonsRes.count ?? 0) + (examsRes.count ?? 0)) > 0,
        pendingDoubts: (doubtsRes.count ?? 0) > 0,
        expiringSubscriptions: (subsRes.count ?? 0) > 0,
      });
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, role]);

  return alerts;
};