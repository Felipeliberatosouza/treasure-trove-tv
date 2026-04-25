// Configuração editável das mensagens contextuais e limiares ("strong threshold")
// exibidas no tooltip do gráfico de tendência (TeacherCompensationTrendChart).
//
// Persistido em platform_settings.teacher_compensation.tooltip_messages.

export type TooltipMetricKey = "rf" | "qb" | "share" | "pool";

export interface TooltipMetricMessages {
  /** Magnitude absoluta a partir da qual a variação é considerada "expressiva". */
  strong_threshold: number;
  /** Variação positiva normal (ex: melhora discreta). */
  up: string;
  /** Variação positiva forte (>= strong_threshold). */
  up_strong: string;
  /** Variação negativa normal. */
  down: string;
  /** Variação negativa forte. */
  down_strong: string;
  /** Mensagem quando |variação| < 0.05 (estável). */
  stable: string;
  /** Mensagem quando não há mês anterior para comparar. */
  no_data: string;
}

export interface TooltipMessagesConfig {
  enabled: boolean;
  rf: TooltipMetricMessages;
  qb: TooltipMetricMessages;
  share: TooltipMetricMessages;
  pool: TooltipMetricMessages;
}

export const TOOLTIP_METRIC_LABELS: Record<TooltipMetricKey, string> = {
  rf: "RF Score",
  qb: "Bônus de Qualidade",
  share: "Fatia do Pool",
  pool: "Pool em R$",
};

export const TOOLTIP_METRIC_UNIT_HINT: Record<TooltipMetricKey, string> = {
  rf: "variação em % do RF Score",
  qb: "variação em pontos percentuais do bônus",
  share: "variação em pontos percentuais da fatia",
  pool: "variação em % do valor em R$",
};

export const DEFAULT_TOOLTIP_MESSAGES: TooltipMessagesConfig = {
  enabled: true,
  rf: {
    strong_threshold: 10,
    up: "Seu RF Score melhorou vs mês anterior — bom ritmo de entregas.",
    up_strong: "Salto importante no RF Score! Continue mantendo o engajamento.",
    down: "Seu RF Score caiu um pouco — atenção às metas do mês.",
    down_strong: "Queda expressiva no RF Score — revise inserções, aulas e dúvidas em aberto.",
    stable: "Estável vs mês anterior — sem variação relevante.",
    no_data: "Sem comparação disponível com o mês anterior.",
  },
  qb: {
    strong_threshold: 5,
    up: "Bônus de Qualidade subiu — alunos avaliaram melhor seus conteúdos.",
    up_strong: "Forte aumento no Bônus de Qualidade — excelente recepção dos alunos!",
    down: "Bônus de Qualidade reduziu — fique de olho nas avaliações recentes.",
    down_strong: "Queda forte no Bônus de Qualidade — vale revisar feedbacks dos alunos.",
    stable: "Estável vs mês anterior — sem variação relevante.",
    no_data: "Sem comparação disponível com o mês anterior.",
  },
  share: {
    strong_threshold: 2,
    up: "Sua fatia do Pool aumentou — você ganhou espaço relativo na plataforma.",
    up_strong: "Grande ganho de fatia do Pool — seu conteúdo cresceu bem em relação aos outros.",
    down: "Sua fatia do Pool diminuiu — outros professores cresceram mais este mês.",
    down_strong: "Queda significativa de fatia — consumo do seu conteúdo perdeu peso relativo.",
    stable: "Estável vs mês anterior — sem variação relevante.",
    no_data: "Sem comparação disponível com o mês anterior.",
  },
  pool: {
    strong_threshold: 20,
    up: "Pool em R$ melhorou vs mês anterior.",
    up_strong: "Pool em R$ teve forte alta — combinação de mais consumo e/ou melhores bônus.",
    down: "Pool em R$ ficou abaixo do mês anterior.",
    down_strong: "Queda expressiva no Pool em R$ — confira piso/teto e seu RF Score.",
    stable: "Estável vs mês anterior — sem variação relevante.",
    no_data: "Sem comparação disponível com o mês anterior.",
  },
};

/** Garante todos os campos preenchidos, sobrescrevendo apenas o que veio configurado. */
export function mergeTooltipMessages(
  cfg: Partial<TooltipMessagesConfig> | null | undefined
): TooltipMessagesConfig {
  if (!cfg) return DEFAULT_TOOLTIP_MESSAGES;
  const out: TooltipMessagesConfig = {
    enabled: cfg.enabled ?? true,
    rf: { ...DEFAULT_TOOLTIP_MESSAGES.rf, ...(cfg.rf ?? {}) },
    qb: { ...DEFAULT_TOOLTIP_MESSAGES.qb, ...(cfg.qb ?? {}) },
    share: { ...DEFAULT_TOOLTIP_MESSAGES.share, ...(cfg.share ?? {}) },
    pool: { ...DEFAULT_TOOLTIP_MESSAGES.pool, ...(cfg.pool ?? {}) },
  };
  return out;
}
