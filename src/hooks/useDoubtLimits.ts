import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DoubtMessagesLimits {
  individual_purchase: number;
  plans: Record<string, number>;
}

const DEFAULT: DoubtMessagesLimits = {
  individual_purchase: 1,
  plans: {},
};

/**
 * Reads the admin-configurable limit of student questions allowed inside
 * a single purchased "Dúvida" thread. The limit varies per subscription
 * plan and has a separate value for individual one-off purchases.
 */
export const useDoubtLimits = () => {
  const [limits, setLimits] = useState<DoubtMessagesLimits>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "doubt_messages_limits")
        .maybeSingle();
      if (cancelled) return;
      const v = (data?.value as Partial<DoubtMessagesLimits> | null) ?? null;
      setLimits({
        individual_purchase: Math.max(1, Number(v?.individual_purchase ?? 1)),
        plans: (v?.plans as Record<string, number>) ?? {},
      });
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const limitForPlan = (planName: string | null | undefined) =>
    planName && limits.plans[planName] ? limits.plans[planName] : limits.individual_purchase;

  return { limits, loading, limitForPlan };
};