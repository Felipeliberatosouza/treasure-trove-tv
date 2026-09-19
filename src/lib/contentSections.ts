// Seções de conteúdo da plataforma (Revisões, Resumos, Simulados, Top Questões, Colinhas).
// Cada seção reúne, no mesmo lugar, o material de professores e o material gerado com IA.
import { BookOpen, FileText, ListChecks, Trophy, StickyNote, type LucideIcon } from "lucide-react";

export type SectionKey = "revisoes" | "resumo" | "simulado" | "top_questoes" | "colinha";

export interface SectionMeta {
  key: SectionKey;
  label: string;
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  description: string;
  searchPlaceholder: string;
  /** Coluna de URL no conteúdo do professor (lessons / exam_solutions). */
  urlColumn?: string;
  /** Valor gravado em lesson_material_meta.material_type. */
  metaType?: string;
}

export const CONTENT_SECTIONS: SectionMeta[] = [
  {
    key: "revisoes",
    label: "Revisões",
    shortLabel: "Revisões",
    href: "/revisoes",
    icon: BookOpen,
    description:
      "Aulas gravadas por professores e aulas com professor virtual, organizadas por assunto.",
    searchPlaceholder: "Procure uma revisão… qual assunto você deseja?",
  },
  {
    key: "resumo",
    label: "Resumos",
    shortLabel: "Resumos",
    href: "/resumos",
    icon: FileText,
    description: "Resumos objetivos para agilizar seus estudos.",
    searchPlaceholder: "Procure um resumo… qual assunto você deseja?",
    urlColumn: "resumo_url",
    metaType: "resumo",
  },
  {
    key: "simulado",
    label: "Simulados",
    shortLabel: "Simulados",
    href: "/simulados",
    icon: ListChecks,
    description: "Questões para praticar e testar o que você já sabe.",
    searchPlaceholder: "Procure um simulado… qual assunto você deseja?",
    urlColumn: "simulado_url",
    metaType: "simulado",
  },
  {
    key: "top_questoes",
    label: "Top Questões de Provas",
    shortLabel: "Top Questões",
    href: "/top-questoes",
    icon: Trophy,
    description: "As questões que mais caem, com resolução comentada.",
    searchPlaceholder: "Procure uma questão… qual assunto você deseja?",
    urlColumn: "top_questoes_url",
    metaType: "top_questoes",
  },
  {
    key: "colinha",
    label: "Colinhas",
    shortLabel: "Colinhas",
    href: "/colinhas",
    icon: StickyNote,
    description: "Bullets rápidos para relembrar o conteúdo essencial em segundos.",
    searchPlaceholder: "Procure uma colinha… qual assunto você deseja?",
    urlColumn: "colinha_url",
    metaType: "colinha",
  },
];

export const getSection = (key: SectionKey): SectionMeta =>
  CONTENT_SECTIONS.find((s) => s.key === key) as SectionMeta;
