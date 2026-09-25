import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, FileText, Target, Scale, Landmark, BookOpen, type LucideIcon } from "lucide-react";

export type Subproduct = {
  key: string;
  name: string;
  /** "ai" abre o gerador com a ferramenta; "link" leva a uma página. */
  kind: "ai" | "link";
  tool?: "revisao" | "resumo" | "simulado" | "top_questoes" | "colinha" | "trabalho";
  href?: string;
  active: boolean;
};

const std = (resolucao: string, resumo: string, simulado: string, top: string): Subproduct[] => [
  { key: "revisoes", name: "Revisões (Aula)", kind: "ai", tool: "revisao", active: true },
  { key: "resolucao", name: resolucao, kind: "link", href: "/revisoes", active: true },
  { key: "resumo", name: resumo, kind: "ai", tool: "resumo", active: true },
  { key: "simulado", name: simulado, kind: "ai", tool: "simulado", active: true },
  { key: "top_questoes", name: top, kind: "ai", tool: "top_questoes", active: true },
  { key: "colinha", name: "Colinha", kind: "ai", tool: "colinha", active: true },
  { key: "aula_particular", name: "Aula Particular", kind: "link", href: "/#agendar-aula", active: true },
];
const EXAM = (top = "Top Questões de Provas Comentadas") =>
  std("Resolução de Provas (Aula) - Últimos 5 anos", "Resumo de Conteúdos Específicos", "Simulado (Tendência e Últimas 5 provas por área)", top);

export const FALLBACK_SUBPRODUCTS: Record<string, Subproduct[]> = {
  provas: std("Resolução de Provas (Aula)", "Resumo One Page", "Simulado", "Top Questões de Provas Comentadas"),
  trabalhos: [
    { key: "documento", name: "Documento Personalizado para Entrega", kind: "ai", tool: "trabalho", active: true },
    { key: "slides", name: "Slide Personalizado Apresentação", kind: "ai", tool: "trabalho", active: true },
    { key: "dicas", name: "Dicas para a apresentação ou aula", kind: "ai", tool: "trabalho", active: true },
    { key: "perguntas", name: "Perguntas que podem ser feitas na apresentação", kind: "ai", tool: "trabalho", active: true },
    { key: "aula_particular", name: "Aula Particular", kind: "link", href: "/#agendar-aula", active: true },
  ],
  enem: EXAM(), vestibulares: EXAM("Top Questões de Provas"), oab: EXAM(), concursos: EXAM(),
};

/** Subprodutos ativos de um produto, com a lista padrão da planilha como reserva. */
export const activeSubproducts = (p?: Product | null): Subproduct[] => {
  if (!p) return [];
  const list = Array.isArray(p.subproducts) && p.subproducts.length ? p.subproducts : FALLBACK_SUBPRODUCTS[p.key] || [];
  return list.filter((s) => s.active !== false);
};

export type Product = {
  key: string;
  name: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
  page_intro: string;
  badge?: string;
  headline?: string;
  input_hint?: string;
  active: boolean;
  sort_order: number;
  subproducts?: Subproduct[];
};

export const PRODUCT_ICONS: Record<string, LucideIcon> = {
  GraduationCap, FileText, Target, Scale, Landmark, BookOpen,
};

export const productIcon = (name?: string): LucideIcon => PRODUCT_ICONS[name || ""] || GraduationCap;

/** Rótulo curto por produto, usado em menus e selos. */
export const FALLBACK_PRODUCTS: Product[] = [
  { key: "provas", name: "Provas", icon: "GraduationCap", title: "Provas escolares e da faculdade", description: "Kit de revisão completo do assunto da sua prova, pronto em poucos minutos.", cta: "Estudar para prova", page_intro: "", badge: "Seu Kit de Revisão completo em poucos minutos", headline: "Qual o assunto da sua próxima prova?", input_hint: "Digite o assunto ou tópicos da sua prova (seja detalhista para ter melhores resultados!)", active: true, sort_order: 1 },
  { key: "trabalhos", name: "Trabalhos", icon: "FileText", title: "Trabalhos em Word e slides", description: "Documento Word e apresentação em slides prontos para baixar e ajustar.", cta: "Criar trabalho", page_intro: "", badge: "Seu trabalho escolar pronto: documento do Word e slides para entrega ao professor e apresentação!", headline: "Quer gerar documento Word e slides para um trabalho?", input_hint: "Digite o assunto ou tópicos do seu trabalho (seja detalhista para ter melhores resultados!)", active: true, sort_order: 2 },
  { key: "enem", name: "ENEM", icon: "Target", title: "Preparação para o ENEM", description: "Estude pelas quatro áreas do exame com foco no que mais cai.", cta: "Estudar para o ENEM", page_intro: "", active: true, sort_order: 3 },
  { key: "vestibulares", name: "Vestibulares", icon: "BookOpen", title: "Vestibulares", description: "Revisão para os principais vestibulares do país, com foco no conteúdo que mais cai.", cta: "Estudar para vestibulares", page_intro: "", active: true, sort_order: 4 },
  { key: "oab", name: "OAB", icon: "Scale", title: "Exame da OAB", description: "Revisão para a 1ª e a 2ª fase do Exame da Ordem.", cta: "Estudar para a OAB", page_intro: "", active: true, sort_order: 5 },
  { key: "concursos", name: "Concursos", icon: "Landmark", title: "Concursos Públicos", description: "Revisão direcionada por banca, cargo e disciplinas do edital.", cta: "Estudar para concursos", page_intro: "", active: true, sort_order: 6 },
];

let cache: Product[] | null = null;
const listeners = new Set<(p: Product[]) => void>();

export async function reloadProducts() {
  const { data } = await supabase.from("products").select("*").order("sort_order");
  cache = (data as unknown as Product[] | null)?.length ? (data as unknown as Product[]) : FALLBACK_PRODUCTS;
  listeners.forEach((l) => l(cache!));
  return cache;
}

/** Atualiza um produto na memória compartilhada para que todas as telas abertas mostrem o mesmo valor na hora. */
export function updateProductDraft(key: string, patch: Partial<Product>) {
  const base = cache || FALLBACK_PRODUCTS;
  cache = base.map((p) => (p.key === key ? { ...p, ...patch } : p));
  listeners.forEach((l) => l(cache!));
}


/** Lista de produtos (todos, inclusive inativos, quando includeInactive). */
export function useProducts(includeInactive = false) {
  const [all, setAll] = useState<Product[]>(cache || FALLBACK_PRODUCTS);
  useEffect(() => {
    listeners.add(setAll);
    if (!cache) reloadProducts();
    return () => { listeners.delete(setAll); };
  }, []);
  return includeInactive ? all : all.filter((p) => p.active);
}
