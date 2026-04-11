import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  hasSubscription: boolean;
  individualPrice: number | null;
}

export function useResourceLimit() {
  const { user } = useAuth();
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [resourcePrices, setResourcePrices] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Fetch subscription + plan
      const { data: sub } = await supabase
        .from("student_subscriptions")
        .select("id, plan_id, subscription_plans(id, name, price, service_revisoes, service_revisoes_qty, service_resumos, service_resumos_qty, service_simulados, service_simulados_qty, service_top_questoes, service_top_questoes_qty, service_colinhas, service_colinhas_qty, service_duvidas, service_duvidas_qty, service_aula_particular, service_aula_particular_qty)")
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

      setLoaded(true);
    };
    load();
  }, [user]);

  const checkLimit = useCallback(
    (resourceType: ResourceType): LimitResult => {
      if (!plan) {
        return { allowed: false, used: 0, total: 0, remaining: 0, hasSubscription: false, individualPrice: resourcePrices[resourceType] ?? null };
      }

      const serviceKey = SERVICE_KEY_MAP[resourceType];
      const enabled = plan[serviceKey] as boolean;
      if (!enabled) {
        return { allowed: false, used: 0, total: 0, remaining: 0, hasSubscription: true, individualPrice: resourcePrices[resourceType] ?? null };
      }

      const total = (plan[`${serviceKey}_qty`] as number) || 0;
      const used = usageCounts[resourceType] || 0;
      const remaining = Math.max(0, total - used);

      return {
        allowed: remaining > 0,
        used,
        total,
        remaining,
        hasSubscription: true,
        individualPrice: resourcePrices[resourceType] ?? null,
      };
    },
    [plan, usageCounts, resourcePrices]
  );

  return { checkLimit, loaded, subscriptionId, planName: (plan?.name as string) || null };
}
