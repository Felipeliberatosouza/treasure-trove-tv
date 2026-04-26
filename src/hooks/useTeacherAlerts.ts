import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isAgendaOutdated } from "@/utils/agendaFreshness";

export interface TeacherAlerts {
  pendingDoubts: boolean;
  scheduledToday: boolean;
  agendaOutdated: boolean;
}

/**
 * Sinalizadores para o menu do professor:
 * - pendingDoubts: existem dúvidas aprovadas e ainda não respondidas
 * - scheduledToday: existe aula particular agendada para hoje
 * - agendaOutdated: a agenda (recorrente ou exceções) não é atualizada há mais de 7 dias
 */
export const useTeacherAlerts = (): TeacherAlerts => {
  const { user, role } = useAuth();
  const [alerts, setAlerts] = useState<TeacherAlerts>({
    pendingDoubts: false,
    scheduledToday: false,
    agendaOutdated: false,
  });

  useEffect(() => {
    if (!user || role !== "teacher") {
      setAlerts({ pendingDoubts: false, scheduledToday: false, agendaOutdated: false });
      return;
    }

    let cancelled = false;

    const fetchAlerts = async () => {
      const teacherId = user.id;

      // 1) Dúvidas pendentes (aprovadas e ainda sem resposta)
      const doubtsPromise = supabase
        .from("student_doubts")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .eq("status", "approved");

      // 2) Aula particular agendada para hoje
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const scheduledPromise = supabase
        .from("scheduled_lessons")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", teacherId)
        .eq("status", "scheduled")
        .gte("scheduled_at", start.toISOString())
        .lte("scheduled_at", end.toISOString());

      // 3) Agenda desatualizada há > 7 dias (mais recente entre recorrente e exceções)
      const recurringPromise = supabase
        .from("teacher_availability_recurring")
        .select("updated_at")
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const exceptionsPromise = supabase
        .from("teacher_availability_exceptions")
        .select("updated_at")
        .eq("teacher_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const [doubtsRes, scheduledRes, recurringRes, exceptionsRes] = await Promise.all([
        doubtsPromise,
        scheduledPromise,
        recurringPromise,
        exceptionsPromise,
      ]);

      if (cancelled) return;

      const agendaOutdated = isAgendaOutdated({
        recurringUpdatedAt: recurringRes.data?.updated_at ?? null,
        exceptionUpdatedAt: exceptionsRes.data?.updated_at ?? null,
      });

      setAlerts({
        pendingDoubts: (doubtsRes.count ?? 0) > 0,
        scheduledToday: (scheduledRes.count ?? 0) > 0,
        agendaOutdated,
      });
    };

    fetchAlerts();
    // Atualiza a cada 2 minutos enquanto o componente está montado
    const interval = setInterval(fetchAlerts, 120_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, role]);

  return alerts;
};