import { BookOpen, Users, Star, Target } from "lucide-react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";

const fallbackContent = `Acreditamos que a educação de qualidade deve ser acessível a todos. A Revisão Fácil nasceu para transformar a forma como alunos estudam e professores ensinam.`;

const AboutUs = () => {
  const { data, loading } = usePlatformSettings("about_us");

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-12 md:px-16 lg:px-32">
      <div className="mx-auto max-w-3xl space-y-10">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold text-gradient">Sobre a Revisão Fácil</h1>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : data?.content ? (
            <div
              className="prose prose-sm max-w-none text-muted-foreground leading-relaxed
                         prose-headings:text-foreground prose-headings:font-semibold
                         prose-strong:text-foreground prose-a:text-primary prose-a:underline"
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          ) : (
            <>
              <p className="text-lg text-muted-foreground leading-relaxed">{fallbackContent}</p>

              <section className="space-y-3 pt-4">
                <h2 className="text-xl font-semibold">Nossa Missão</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Conectar professores especialistas a alunos que buscam conteúdo de revisão objetivo, didático e acessível.
                </p>
              </section>

              <section className="space-y-3 pt-4">
                <h2 className="text-xl font-semibold">Como Funciona</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { icon: BookOpen, title: "Conteúdo de Qualidade", desc: "Videoaulas e resoluções de provas criadas por professores experientes." },
                    { icon: Users, title: "Professores Especializados", desc: "Profissionais qualificados compartilham seu conhecimento." },
                    { icon: Star, title: "Avaliações Reais", desc: "Alunos avaliam os conteúdos, garantindo transparência." },
                    { icon: Target, title: "Foco no Resultado", desc: "Conteúdos direcionados para revisão e preparação para provas." },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="rounded-xl border border-border bg-card p-5 space-y-2">
                      <Icon className="h-6 w-6 text-primary" />
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="pt-6 border-t border-border">
          <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
