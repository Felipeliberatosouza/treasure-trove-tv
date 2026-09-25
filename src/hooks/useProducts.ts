import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, FileText, Target, Scale, Landmark, BookOpen, type LucideIcon } from "lucide-react";

export type Product = {
  key: string;
  name: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
  page_intro: string;
  active: boolean;
  sort_order: number;
};

export const PRODUCT_ICONS: Record<string, LucideIcon> = {
  GraduationCap, FileText, Target, Scale, Landmark, BookOpen,
};

export const productIcon = (name?: string): LucideIcon => PRODUCT_ICONS[name || ""] || GraduationCap;

/** Rótulo curto por produto, usado em menus e selos. */
export const FALLBACK_PRODUCTS: Product[] = [
  { key: "provas", name: "Provas", icon: "GraduationCap", title: "Provas escolares e da faculdade", description: "Kit de revisão completo do assunto da sua prova, pronto em poucos minutos.", cta: "Estudar para prova", page_intro: "", active: true, sort_order: 1 },
  { key: "trabalhos", name: "Trabalhos", icon: "FileText", title: "Trabalhos em Word e slides", description: "Documento Word e apresentação em slides prontos para baixar e ajustar.", cta: "Criar trabalho", page_intro: "", active: true, sort_order: 2 },
  { key: "enem", name: "ENEM", icon: "Target", title: "Preparação para o ENEM", description: "Estude pelas quatro áreas do exame com foco no que mais cai.", cta: "Estudar para o ENEM", page_intro: "", active: true, sort_order: 3 },
  { key: "vestibulares", name: "Vestibulares", icon: "BookOpen", title: "Vestibulares", description: "Revisão para os principais vestibulares do país, com foco no conteúdo que mais cai.", cta: "Estudar para vestibulares", page_intro: "", active: true, sort_order: 4 },
  { key: "oab", name: "OAB", icon: "Scale", title: "Exame da OAB", description: "Revisão para a 1ª e a 2ª fase do Exame da Ordem.", cta: "Estudar para a OAB", page_intro: "", active: true, sort_order: 5 },
  { key: "concursos", name: "Concursos", icon: "Landmark", title: "Concursos Públicos", description: "Revisão direcionada por banca, cargo e disciplinas do edital.", cta: "Estudar para concursos", page_intro: "", active: true, sort_order: 6 },
];

let cache: Product[] | null = null;
const listeners = new Set<(p: Product[]) => void>();

export async function reloadProducts() {
  const { data } = await supabase.from("products").select("*").order("sort_order");
  cache = (data as Product[] | null)?.length ? (data as Product[]) : FALLBACK_PRODUCTS;
  listeners.forEach((l) => l(cache!));
  return cache;
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
