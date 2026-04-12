import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = useCallback(
    async (
      action: string,
      options?: {
        targetTable?: string;
        targetId?: string;
        metadata?: Record<string, unknown>;
      }
    ) => {
      if (!user) return;
      try {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action,
          target_table: options?.targetTable ?? null,
          target_id: options?.targetId ?? null,
          metadata: options?.metadata ?? {},
        });
      } catch (err) {
        console.error("Audit log error:", err);
      }
    },
    [user]
  );

  return { logAction };
}
