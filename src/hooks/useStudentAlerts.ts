import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StudentAlerts {
  /** Há dúvidas do aluno que já foram respondidas pelo professor. */
  answeredDoubts: boolean;
  /** Há aula particular agendada para hoje. */
  scheduledToday: boolean;
}

const EMPTY: StudentAlerts = {
  answeredDoubts: false,
  scheduledToday: false,
};

/**
 * Sinalizadores para o menu do aluno. Revalida a cada 2 minutos.
 */
export const useStudentAlerts = (): StudentAlerts => {
  const { user, role } = useAuth();
  const [alerts, setAlerts] = useState<StudentAlerts>(EMPTY);

  useEffect(() => {
    if (!user || role !== "student") {
      setAlerts(EMPTY);
      return;
    }

    let cancelled = false;

    const fetchAlerts = async () => {
      const studentId = user.id;

      const doubtsPromise = supabase
        .from("student_doubts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("status", "answered");

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const scheduledPromise = supabase
        .from("scheduled_lessons")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId)
        .eq("status", "scheduled")
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString());

      const [doubtsRes, scheduledRes] = await Promise.all([
        doubtsPromise,
        scheduledPromise,
      ]);

      if (cancelled) return;

      setAlerts({
        answeredDoubts: (doubtsRes.count ?? 0) > 0,
        scheduledToday: (scheduledRes.count ?? 0) > 0,
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