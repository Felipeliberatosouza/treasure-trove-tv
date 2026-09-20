import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Configuração do chat de dúvidas das aulas com professor virtual (IA).
 * Uma dúvida de IA é aberta para todos os professores da área, que respondem
 * no mesmo histórico. O aluno interage conforme o plano ou pagando com
 * Créditos de IA.
 */
export interface DoubtChatConfig {
  enabled: boolean;
  /** Interações do aluno sem plano assinado. */
  interactions_no_plan: number;
  /** Interações por plano. `null` significa ilimitado. */
  plan_interactions: Record<string, number | null>;
  /** Créditos de IA cobrados por interação extra com professores. */
  credit_cost_per_interaction: number;
  response_deadline_days: number;
  max_teachers_notified: number;
  /** Bônus opcional (R$) pago ao professor por dúvida respondida. */
  teacher_bonus_brl: number;
  blocked_words: string[];
}

export const DEFAULT_BLOCKED_WORDS = [
  "porra", "caralho", "merda", "buceta", "puta", "viado", "corno",
  "arrombado", "desgraçado", "vagabundo", "imbecil", "idiota", "burro",
  "retardado", "otário", "escroto", "babaca",
];

export const DEFAULT_DOUBT_CHAT_CONFIG: DoubtChatConfig = {
  enabled: true,
  interactions_no_plan: 1,
  plan_interactions: {},
  credit_cost_per_interaction: 1,
  response_deadline_days: 3,
  max_teachers_notified: 10,
  teacher_bonus_brl: 0,
  blocked_words: DEFAULT_BLOCKED_WORDS,
};

export const useDoubtChatConfig = () => {
  const [config, setConfig] = useState<DoubtChatConfig>(DEFAULT_DOUBT_CHAT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "doubt_chat_config")
        .maybeSingle();
      if (cancelled) return;
      if (data?.value) {
        setConfig({
          ...DEFAULT_DOUBT_CHAT_CONFIG,
          ...(data.value as Partial<DoubtChatConfig>),
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading };
};
