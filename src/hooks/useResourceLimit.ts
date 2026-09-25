import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBetaMode } from "@/hooks/useBetaMode";
import {
  DEFAULT_REFERRAL_ACCESS_SCOPES,
  useCashbackConfig,
  type ReferralAccessGrants,
  type ReferralCreditScope,
} from "@/hooks/useCashback";

/** Origem do conteúdo que o aluno quer acessar. */
export type ContentSource = "ia" | "professor";

export type ResourceType =
  | "revisao"
  | "resumo"
  | "simulado"
  | "top_questoes"
  | "colinha"
  | "duvida"
  | "aula_particular";

const SERVICE_KEY_MAP: Record<ResourceType, string> = {
  revisao: "service_revisoes",
  resumo: "service_resumos",
  simulado: "service_simulados",
  top_questoes: "service_top_questoes",
  colinha: "service_colinhas",
  duvida: "service_duvidas",
  aula_particular: "service_aula_particular",
};

interface SubscriptionPlan {
  [key: string]: unknown;
}

interface LimitResult {
  allowed: boolean;
  used: number;
  total: number;
  remaining: number;
  planNotCovering?: boolean;
  hasSubscription: boolean;
  individualPrice: number | null;
  /** Acessos ganhos por indicação de amigos, ainda não usados. */
  referralCredits: number;
  /** true quando o aluno tem créditos, mas o administrador não permite usá-los neste conteúdo. */
  referralBlocked: boolean;
}

export function useResourceLimit() {
  const { user } = useAuth();
  const { config } = useCashbackConfig();
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [resourcePrices, setResourcePrices] = useState<Record<string, number>>({});
  const [referralCredits, setReferralCredits] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Fetch subscription + plan
      const { data: sub } = await supabase
        .from("student_subscriptions")
        .select("id, plan_id, subscription_plans(id, name, price, product_key, service_revisoes, service_revisoes_qty, service_resumos, service_resumos_qty, service_simulados, service_simulados_qty, service_top_questoes, service_top_questoes_qty, service_colinhas, service_colinhas_qty, service_duvidas, service_duvidas_qty, service_aula_particular, service_aula_particular_qty)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        setSubscriptionId(sub.id);
        setPlan(sub.subscription_plans as unknown as SubscriptionPlan);

        const { data: usage } = await supabase
          .from("resource_usage")
          .select("resource_type")
          .eq("user_id", user.id)
          .eq("subscription_id", sub.id);

        const counts: Record<string, number> = {};
        (usage || []).forEach((u) => {
          counts[u.resource_type] = (counts[u.resource_type] || 0) + 1;
        });
        setUsageCounts(counts);
      }

      // Fetch individual prices
      const { data: prices } = await supabase
        .from("resource_prices")
        .select("resource_type, price, active");

      // Map DB resource_type (plural) to internal keys (singular)
      const PRICE_KEY_MAP: Record<string, string> = {
        revisoes: "revisao",
        resumos: "resumo",
        simulados: "simulado",
        top_questoes: "top_questoes",
        colinhas: "colinha",
        duvidas: "duvida",
        aula_particular: "aula_particular",
      };
      const priceMap: Record<string, number> = {};
      (prices || []).forEach((p) => {
        if (p.active) {
          const key = PRICE_KEY_MAP[p.resource_type] || p.resource_type;
          priceMap[key] = Number(p.price);
        }
      });
      setResourcePrices(priceMap);

      // Acessos ganhos por indicação de amigos (saldo extra ao plano)
      const { data: referral } = await supabase
        .from("referral_content_credits")
        .select("resource_type, granted, used")
        .eq("user_id", user.id);
      const referralMap: Record<string, number> = {};
      (referral || []).forEach((r) => {
        referralMap[r.resource_type] = Math.max(0, (r.granted || 0) - (r.used || 0));
      });
      setReferralCredits(referralMap);

      setLoaded(true);
    };
    load();
  }, [user]);

  /** Regra do administrador: onde o crédito daquele recurso pode ser usado. */
  const scopeOf = useCallback(
    (resourceType: ResourceType): ReferralCreditScope => {
      const scopes = {
        ...DEFAULT_REFERRAL_ACCESS_SCOPES,
        ...(config.referral_access_scopes ?? {}),
      } as Record<keyof ReferralAccessGrants, ReferralCreditScope>;
      return scopes[resourceType] ?? "ambos";
    },
    [config.referral_access_scopes]
  );

  /** Indica se o crédito de indicação pode ser usado naquele conteúdo. */
  const canUseReferralCredit = useCallback(
    (resourceType: ResourceType, source?: ContentSource): boolean => {
      const scope = scopeOf(resourceType);
      if (scope === "nenhum") return false;
      if (!source || scope === "ambos") return true;
      return scope === source;
    },
    [scopeOf]
  );

  // Professor ativo (publicou nos últimos 30 dias) acessa tudo gratuitamente.
  const [activeTeacher, setActiveTeacher] = useState(false);
  const { beta } = useBetaMode();
  useEffect(() => {
    if (!user) { setActiveTeacher(false); return; }
    supabase.rpc("is_active_teacher", { _user_id: user.id }).then(({ data }) => setActiveTeacher(data === true));
  }, [user]);

  const checkLimit = useCallback(
    (resourceType: ResourceType, source?: ContentSource, productKeys?: string[]): LimitResult => {
      if (activeTeacher || beta) {
        return { allowed: true, used: 0, total: 9999, remaining: 9999, hasSubscription: true, individualPrice: null, referralCredits: 0, referralBlocked: false } as LimitResult;
      }
      const owned = referralCredits[resourceType] || 0;
      const usable = canUseReferralCredit(resourceType, source);
      const bonus = usable ? owned : 0;
      const referralBlocked = owned > 0 && !usable;

      // Plano por produto só libera conteúdos do seu produto; pacote completo ("todos") libera tudo.
      const planProduct = ((plan as any)?.product_key as string) || "provas";
      const content = productKeys && productKeys.length ? productKeys : ["provas"];
      const covers = !plan || planProduct === "todos" || content.includes(planProduct);
      if (!plan || !covers) {
        return {
          allowed: bonus > 0,
          used: 0,
          total: bonus,
          remaining: bonus,
          hasSubscription: false,
          planNotCovering: !!plan && !covers,
          individualPrice: resourcePrices[resourceType] ?? null,
          referralCredits: bonus,
          referralBlocked,
        };
      }

      const serviceKey = SERVICE_KEY_MAP[resourceType];
      const enabled = plan[serviceKey] as boolean;
      if (!enabled) {
        return {
          allowed: bonus > 0,
          used: 0,
          total: bonus,
          remaining: bonus,
          hasSubscription: true,
          individualPrice: resourcePrices[resourceType] ?? null,
          referralCredits: bonus,
          referralBlocked,
        };
      }

      const total = ((plan[`${serviceKey}_qty`] as number) || 0) + bonus;
      const used = usageCounts[resourceType] || 0;
      const remaining = Math.max(0, total - used);

      return {
        allowed: remaining > 0,
        used,
        total,
        remaining,
        hasSubscription: true,
        individualPrice: resourcePrices[resourceType] ?? null,
        referralCredits: bonus,
        referralBlocked,
      };
    },
    [beta, activeTeacher, plan, usageCounts, resourcePrices, referralCredits, canUseReferralCredit]
  );

  /** Consome um acesso ganho por indicação antes de cobrar do aluno. */
  const consumeReferralCredit = useCallback(
    async (resourceType: ResourceType, source?: ContentSource): Promise<boolean> => {
      if (!user || (referralCredits[resourceType] || 0) <= 0) return false;
      if (!canUseReferralCredit(resourceType, source)) return false;
      const { data, error } = await supabase.rpc("consume_referral_content_credit", {
        _resource_type: resourceType,
      });
      if (error || !data) return false;
      setReferralCredits((prev) => ({
        ...prev,
        [resourceType]: Math.max(0, (prev[resourceType] || 0) - 1),
      }));
      return true;
    },
    [user, referralCredits, canUseReferralCredit]
  );

  return {
    checkLimit,
    consumeReferralCredit,
    canUseReferralCredit,
    referralCredits,
    loaded,
    subscriptionId,
    planName: (plan?.name as string) || null,
    planProductKey: plan ? (((plan as any).product_key as string) || "provas") : null,
  };
}
