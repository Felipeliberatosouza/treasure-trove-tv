export interface PlanOption {
  id: string;
  name: string;
  price: number;
  highlighted: boolean;
  features?: string[];
  service_revisoes?: boolean;
  service_revisoes_qty?: number;
  service_resumos?: boolean;
  service_resumos_qty?: number;
  service_simulados?: boolean;
  service_simulados_qty?: number;
  service_top_questoes?: boolean;
  service_top_questoes_qty?: number;
  service_colinhas?: boolean;
  service_colinhas_qty?: number;
  service_duvidas?: boolean;
  service_duvidas_qty?: number;
  service_aula_particular?: boolean;
  service_aula_particular_qty?: number;
}

export const SERVICE_LABELS: Record<string, string> = {
  service_revisoes: "Revisões",
  service_resumos: "Resumos",
  service_simulados: "Simulados",
  service_top_questoes: "Top Questões",
  service_colinhas: "Colinhas",
  service_duvidas: "Dúvidas",
  service_aula_particular: "Aula Particular",
};

export const SERVICE_KEYS = Object.keys(SERVICE_LABELS);

export const hasAnyService = (plan: PlanOption) =>
  SERVICE_KEYS.some(k => plan[k as keyof PlanOption]);
