import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BillingStatus {
  pastDue: boolean;
  status: string | null;
  amountDue: number | null;
  hostedInvoiceUrl: string | null;
  attemptCount: number | null;
}

const EMPTY: BillingStatus = {
  pastDue: false,
  status: null,
  amountDue: null,
  hostedInvoiceUrl: null,
  attemptCount: null,
};

/**
 * Polls Stripe (via the `check-billing-status` edge function) to detect
 * subscriptions whose latest charge failed (past_due / unpaid / incomplete)
 * so the dashboard can prompt the student to update their card.
 */
export function useBillingStatus(): BillingStatus & {
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [data, setData] = useState<BillingStatus>(EMPTY);
  const [loading, setLoading] = useState<boolean>(!!user);

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("check-billing-status");
      if (error) throw error;
      if (!res?.ok) {
        setData(EMPTY);
        return;
      }
      setData({
        pastDue: !!res.pastDue,
        status: res.status ?? null,
        amountDue: typeof res.amountDue === "number" ? res.amountDue : null,
        hostedInvoiceUrl: res.hostedInvoiceUrl ?? null,
        attemptCount: typeof res.attemptCount === "number" ? res.attemptCount : null,
      });
    } catch (e) {
      console.warn("[useBillingStatus] failed", e);
      setData(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Allow other components (e.g. PaymentMethodCard after a successful card
  // update + invoice retry) to trigger an immediate re-check.
  useEffect(() => {
    const handler = () => {
      fetchStatus();
    };
    window.addEventListener("billing-status-refresh", handler);
    return () => window.removeEventListener("billing-status-refresh", handler);
  }, [fetchStatus]);

  return { ...data, loading, refresh: fetchStatus };
}
