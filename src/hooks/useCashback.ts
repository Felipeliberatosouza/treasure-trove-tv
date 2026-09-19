import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CashbackTier {
  id: string;
  name: string;
  min_spent_12m: number;
  percent: number;
}

/** Quantidade de acessos liberados por indicação, para cada tipo de conteúdo. */
export interface ReferralAccessGrants {
  revisao: number;
  resumo: number;
  simulado: number;
  top_questoes: number;
  colinha: number;
  duvida: number;
  aula_particular: number;
  /** Créditos de geração de material com IA */
  ai_credits: number;
}

export const REFERRAL_ACCESS_LABELS: Record<keyof ReferralAccessGrants, string> = {
  revisao: "Revisões",
  resumo: "Resumos",
  simulado: "Simulados",
  top_questoes: "Top Questões",
  colinha: "Colinhas",
  duvida: "Dúvidas",
  aula_particular: "Aula particular",
  ai_credits: "Créditos de IA",
};

export const DEFAULT_REFERRAL_ACCESS_GRANTS: ReferralAccessGrants = {
  revisao: 1,
  resumo: 1,
  simulado: 1,
  top_questoes: 1,
  colinha: 1,
  duvida: 0,
  aula_particular: 0,
  ai_credits: 1,
};

/** Onde os créditos ganhos por indicação podem ser usados. */
export type ReferralCreditScope = "ambos" | "ia" | "professor" | "nenhum";

export const REFERRAL_SCOPE_LABELS: Record<ReferralCreditScope, string> = {
  ambos: "Conteúdo de IA e de professores",
  ia: "Somente conteúdo de IA",
  professor: "Somente conteúdo de professores",
  nenhum: "Não pode ser usado com créditos",
};

export type ReferralAccessScopes = Record<keyof ReferralAccessGrants, ReferralCreditScope>;

export const DEFAULT_REFERRAL_ACCESS_SCOPES: ReferralAccessScopes = {
  revisao: "ambos",
  resumo: "ambos",
  simulado: "ambos",
  top_questoes: "ambos",
  colinha: "ambos",
  duvida: "ambos",
  aula_particular: "professor",
  ai_credits: "ia",
};

/** Texto padrão do convite enviado por e-mail, WhatsApp ou SMS. */
export const DEFAULT_REFERRAL_INVITE_MESSAGE =
  "{nome} te convidou para estudar na {plataforma}! Revisões, resumos, simulados, colinhas e aulas com professores em um só lugar. Acesse pelo link: {link}";

export interface CashbackProgramConfig {
  enabled: boolean;
  grace_period_days: number;
  validity_days: number;
  max_checkout_pct: number;
  min_purchase_amount: number;
  referral_percent: number;
  referral_min_purchase: number;
  /** Prêmio em acessos quando o amigo indicado entra pelo link do convite */
  referral_access_enabled: boolean;
  referral_access_grants: ReferralAccessGrants;
  /** 0 = sem limite de indicações premiadas por aluno */
  referral_access_max_rewards: number;
  /** Onde cada crédito ganho por indicação pode ser usado */
  referral_access_scopes: ReferralAccessScopes;
  /** Texto do convite enviado ao amigo */
  referral_invite_message: string;
  tiers: CashbackTier[];
}

export const DEFAULT_CASHBACK_CONFIG: CashbackProgramConfig = {
  enabled: true,
  grace_period_days: 30,
  validity_days: 365,
  max_checkout_pct: 50,
  min_purchase_amount: 0,
  referral_percent: 10,
  referral_min_purchase: 0,
  referral_access_enabled: true,
  referral_access_grants: DEFAULT_REFERRAL_ACCESS_GRANTS,
  referral_access_max_rewards: 0,
  referral_access_scopes: DEFAULT_REFERRAL_ACCESS_SCOPES,
  referral_invite_message: DEFAULT_REFERRAL_INVITE_MESSAGE,
  tiers: [
    { id: "bronze", name: "Bronze", min_spent_12m: 0, percent: 2 },
    { id: "silver", name: "Prata", min_spent_12m: 300, percent: 4 },
    { id: "gold", name: "Ouro", min_spent_12m: 1000, percent: 6 },
    { id: "diamond", name: "Diamante", min_spent_12m: 3000, percent: 10 },
  ],
};

export interface CashbackAccount {
  id: string;
  user_id: string;
  referral_code: string;
  balance_available: number;
  balance_pending: number;
  total_earned: number;
  total_spent: number;
  total_expired: number;
  current_tier: string;
}

export interface CashbackTransaction {
  id: string;
  kind: "earn_purchase" | "earn_referral" | "spend" | "expire" | "adjust" | "reverse";
  status: "pending" | "available" | "used" | "expired" | "reversed";
  amount: number;
  source_type: string | null;
  source_purchase_amount: number | null;
  source_reference: string | null;
  referred_user_id: string | null;
  available_at: string | null;
  expires_at: string | null;
  consumed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Public read of program configuration. */
export function useCashbackConfig() {
  const [config, setConfig] = useState<CashbackProgramConfig>(DEFAULT_CASHBACK_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "cashback_program")
        .maybeSingle();
      if (data?.value) setConfig({ ...DEFAULT_CASHBACK_CONFIG, ...(data.value as Partial<CashbackProgramConfig>) });
      setLoading(false);
    })();
  }, []);

  return { config, loading };
}

/** Loads/auto-creates the cashback account for the logged user. */
export function useCashbackAccount() {
  const { user } = useAuth();
  const [account, setAccount] = useState<CashbackAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setAccount(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("cashback_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setAccount(data as unknown as CashbackAccount);
    } else {
      // Lazily create via RPC (security definer function ensure_cashback_account)
      await supabase.rpc("ensure_cashback_account" as never, { _user_id: user.id } as never);
      const { data: created } = await supabase
        .from("cashback_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setAccount((created as unknown as CashbackAccount) ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { account, loading, refresh };
}

export function useCashbackTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<CashbackTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setTransactions([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("cashback_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setTransactions((data as unknown as CashbackTransaction[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  return { transactions, loading, refresh };
}

export interface CashbackReferral {
  id: string;
  referred_user_id: string;
  referral_code_used: string;
  status: "pending" | "rewarded" | "expired" | "cancelled";
  reward_amount: number;
  first_purchase_amount: number | null;
  first_purchase_at: string | null;
  rewarded_at: string | null;
  created_at: string;
}

export function useCashbackReferrals() {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<CashbackReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setReferrals([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("cashback_referrals")
      .select("*")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false });
    setReferrals((data as unknown as CashbackReferral[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  return { referrals, loading, refresh };
}

/** Returns the maximum cashback amount that can be applied to a checkout total. */
export function maxCashbackForCheckout(
  total: number,
  available: number,
  config: CashbackProgramConfig
): number {
  const cap = (total * (config.max_checkout_pct ?? 100)) / 100;
  return Math.max(0, Math.min(available, cap, total));
}