import { BookOpen, Users, Star, Target } from "lucide-react";
import { usePlatformSettings, AboutUsSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const defaultIcons = [BookOpen, Users, Star, Target];

const fallback: AboutUsSettings = {
  description: "Acreditamos que a educação de qualidade deve ser acessível a todos. A Revisão Fácil nasceu para transformar a forma como alunos estudam e professores ensinam.",
  mission: "Conectar professores especialistas a alunos que buscam conteúdo de revisão objetivo, didático e acessível.",
  values: "",
  how_it_works_items: [
    { title: "Conteúdo de Qualidade", description: "Videoaulas e resoluções de provas criadas por professores experientes." },
    { title: "Professores Especializados", description: "Profissionais qualificados compartilham seu conhecimento." },
    { title: "Avaliações Reais", description: "Alunos avaliam os conteúdos, garantindo transparência." },
    { title: "Foco no Resultado", description: "Conteúdos direcionados para revisão e preparação para provas." },
  ],
};

const AboutUs = () => {
  const { data, loading } = usePlatformSettings("about_us");
  const d = data && data.description ? data : fallback;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-3xl space-y-10">
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-bold text-gradient">Sobre a Revisão Fácil</h1>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : (
              <>
                {d.description && (
                  <p className="text-lg text-muted-foreground leading-relaxed">{d.description}</p>
                )}

                {d.mission && (
                  <section className="space-y-3 pt-4">
                    <h2 className="text-xl font-semibold">Nossa Missão</h2>
                    <p className="text-muted-foreground leading-relaxed">{d.mission}</p>
                  </section>
                )}

                {d.values && (
                  <section className="space-y-3 pt-4">
                    <h2 className="text-xl font-semibold">Nossos Valores</h2>
                    <p className="text-muted-foreground leading-relaxed">{d.values}</p>
                  </section>
                )}

                {d.how_it_works_items?.length > 0 && (
                  <section className="space-y-3 pt-4">
                    <h2 className="text-xl font-semibold">Como Funciona</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {d.how_it_works_items.map((item, idx) => {
                        const Icon = defaultIcons[idx % defaultIcons.length];
                        return (
                          <div key={idx} className="rounded-xl border border-border bg-card p-5 space-y-2">
                            <Icon className="h-6 w-6 text-primary" />
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          <div className="pt-6 border-t border-border">
            <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AboutUs;
