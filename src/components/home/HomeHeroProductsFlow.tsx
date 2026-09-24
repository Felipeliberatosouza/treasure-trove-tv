import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, FileText, Target, Scale, Landmark, ArrowRight, Check, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Product = {
  key: string;
  label: string;
  icon: typeof GraduationCap;
  title: string;
  description: string;
  items: string[];
  cta: string;
};

const PRODUCTS: Product[] = [
  {
    key: "provas",
    label: "Provas",
    icon: GraduationCap,
    title: "Provas escolares e da faculdade",
    description: "Kit de revisão completo do assunto da sua prova, pronto em poucos minutos.",
    items: ["Aula com Professor Virtual em slides", "Resumo, simulado e colinha", "Top Questões comentadas"],
    cta: "Estudar para prova",
  },
  {
    key: "trabalhos",
    label: "Trabalhos",
    icon: FileText,
    title: "Trabalhos em Word e slides",
    description: "Documento Word e apresentação em slides prontos para baixar e ajustar.",
    items: ["Documento Word estruturado", "Slides para apresentação", "Ajustes pedindo no chat"],
    cta: "Criar trabalho",
  },
  {
    key: "enem",
    label: "ENEM",
    icon: Target,
    title: "Preparação para o ENEM",
    description: "Estude pelas quatro áreas do exame com foco no que mais cai.",
    items: ["Linguagens, Humanas, Natureza e Matemática", "Simulados por área", "Orientações para a redação"],
    cta: "Estudar para o ENEM",
  },
  {
    key: "vestibulares",
    label: "Vestibulares",
    icon: BookOpen,
    title: "Vestibulares",
    description: "Revisão para os principais vestibulares do país, com foco no conteúdo que mais cai.",
    items: ["Fuvest, Unicamp, Unesp e outros", "Questões comentadas de provas anteriores", "Resumos por disciplina"],
    cta: "Estudar para vestibulares",
  },
  {
    key: "oab",
    label: "OAB",
    icon: Scale,
    title: "Exame da OAB",
    description: "Revisão para a 1ª e a 2ª fase do Exame da Ordem.",
    items: ["Ética e disciplinas prioritárias", "Questões comentadas", "Estrutura de peças práticas"],
    cta: "Estudar para a OAB",
  },
  {
    key: "concursos",
    label: "Concursos",
    icon: Landmark,
    title: "Concursos Públicos",
    description: "Revisão direcionada por banca, cargo e disciplinas do edital.",
    items: ["Cebraspe, FGV, FCC e outras bancas", "Português e Raciocínio Lógico", "Direito Constitucional e Administrativo"],
    cta: "Estudar para concursos",
  },
];

export default function HomeHeroProductsFlow() {
  const [active, setActive] = useState(PRODUCTS[0].key);
  const current = PRODUCTS.find((p) => p.key === active) ?? PRODUCTS[0];

  const goToGenerator = () => {
    document.getElementById("revision-ai-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="border-b border-border bg-background px-4 pb-10 pt-24 md:px-10 md:pt-28" aria-label="Nossos produtos">
      <div className="mx-auto w-full max-w-6xl">
        <div role="tablist" className="flex gap-2 overflow-x-auto pb-2 md:justify-center">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            const selected = p.key === active;
            return (
              <button
                key={p.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(p.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {p.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-6 rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <div className="text-left">
              <h2 className="font-display text-2xl font-bold md:text-3xl">{current.title}</h2>
              <p className="mt-2 text-muted-foreground">{current.description}</p>
              <Button className="mt-6" onClick={goToGenerator}>
                {current.cta} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
