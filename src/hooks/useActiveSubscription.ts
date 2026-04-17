import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActiveSubscription {
  id: string;
  status: string;
  plan_id: string;
  started_at: string | null;
  expires_at: string | null;
}

interface UseActiveSubscriptionResult {
  subscription: ActiveSubscription | null;
  isActive: boolean;
  loading: boolean;
  /** Re-fetches the active subscription. Returns the freshest value. */
  refresh: () => Promise<ActiveSubscription | null>;
}

/**
 * Centralized check for whether the logged-in user has an active subscription
 * in our own DB (`student_subscriptions`). Used to:
 * - Skip the Stripe round-trip on the pricing page (avoids overlay flashing)
 * - Toggle navbar entries / dashboard CTAs
 *
 * Returns `null` subscription when there is none or the user is logged out.
 */
export function useActiveSubscription(): UseActiveSubscriptionResult {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(!!user);

  const fetchSub = useCallback(async (): Promise<ActiveSubscription | null> => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_subscriptions")
        .select("id, status, plan_id, started_at, expires_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      const result = (data as ActiveSubscription | null) ?? null;
      setSubscription(result);
      return result;
    } catch (err) {
      console.warn("useActiveSubscription fetch failed:", err);
      setSubscription(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSub();
  }, [fetchSub]);

  return {
    subscription,
    isActive: !!subscription,
    loading,
    refresh: fetchSub,
  };
}
