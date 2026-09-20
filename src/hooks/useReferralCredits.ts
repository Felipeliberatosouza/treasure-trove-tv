import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_REFERRAL_ACCESS_SCOPES,
  REFERRAL_ACCESS_LABELS,
  useCashbackConfig,
  type ReferralAccessGrants,
  type ReferralCreditScope,
} from "@/hooks/useCashback";

export interface ReferralCreditRow {
  resource_type: string;
  label: string;
  granted: number;
  used: number;
  remaining: number;
  scope: ReferralCreditScope;
}

export interface ReferralInvite {
  id: string;
  channel: string;
  contact_email: string | null;
  contact_phone: string | null;
  token: string;
  status: string;
  created_at: string;
  visited_at: string | null;
  rewarded_at: string | null;
}

/**
 * Créditos gratuitos ganhos por indicação (por conteúdo e de IA) e
 * acompanhamento dos convites enviados pelo aluno.
 */
export interface AiCreditsBreakdown {
  referral: number;
  purchased: number;
  bonus: number;
  used: number;
}

export function useReferralCredits() {
  const { user } = useAuth();
  const { config } = useCashbackConfig();
  const [rows, setRows] = useState<ReferralCreditRow[]>([]);
  const [aiCredits, setAiCredits] = useState(0);
  const [aiBreakdown, setAiBreakdown] = useState<AiCreditsBreakdown>({
    referral: 0,
    purchased: 0,
    bonus: 0,
    used: 0,
  });
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const scopes = {
    ...DEFAULT_REFERRAL_ACCESS_SCOPES,
    ...(config.referral_access_scopes ?? {}),
  } as Record<keyof ReferralAccessGrants, ReferralCreditScope>;

  const reload = useCallback(async () => {
    if (!user) {
      setRows([]);
      setInvites([]);
      setAiCredits(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [credits, ai, inviteRows, ledger] = await Promise.all([
      supabase
        .from("referral_content_credits")
        .select("resource_type, granted, used")
        .eq("user_id", user.id),
      supabase.from("ai_revision_credits").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("referral_invites")
        .select("id, channel, contact_email, contact_phone, token, status, created_at, visited_at, rewarded_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_revision_credit_ledger")
        .select("delta, reason")
        .eq("user_id", user.id),
    ]);

    setRows(
      (credits.data ?? []).map((r) => ({
        resource_type: r.resource_type,
        label:
          REFERRAL_ACCESS_LABELS[r.resource_type as keyof ReferralAccessGrants] ?? r.resource_type,
        granted: r.granted ?? 0,
        used: r.used ?? 0,
        remaining: Math.max(0, (r.granted ?? 0) - (r.used ?? 0)),
        scope: scopes[r.resource_type as keyof ReferralAccessGrants] ?? "ambos",
      }))
    );
    setAiCredits(ai.data?.balance ?? 0);

    const bd: AiCreditsBreakdown = { referral: 0, purchased: 0, bonus: 0, used: 0 };
    for (const e of ledger.data ?? []) {
      const delta = Number(e.delta ?? 0);
      const reason = String(e.reason ?? "");
      if (delta < 0) {
        bd.used += -delta;
      } else if (reason.startsWith("referral")) {
        bd.referral += delta;
      } else if (reason.startsWith("purchase")) {
        bd.purchased += delta;
      } else {
        bd.bonus += delta;
      }
    }
    setAiBreakdown(bd);
    setInvites((inviteRows.data ?? []) as ReferralInvite[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, config.referral_access_scopes]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);

  return { rows, aiCredits, invites, loading, reload, totalRemaining };
}
