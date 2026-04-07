import { BookOpen, Users, Star, Target } from "lucide-react";

const AboutUs = () => (
  <div className="min-h-screen bg-background text-foreground px-6 py-12 md:px-16 lg:px-32">
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-bold text-gradient">Sobre a Revisão Fácil</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Acreditamos que a educação de qualidade deve ser acessível a todos. A Revisão Fácil nasceu para transformar a forma como alunos estudam e professores ensinam.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Nossa Missão</h2>
        <p className="text-muted-foreground leading-relaxed">
          Conectar professores especialistas a alunos que buscam conteúdo de revisão objetivo, didático e acessível. Queremos democratizar o acesso a videoaulas e resoluções de provas de alta qualidade, ajudando estudantes a alcançarem seus objetivos acadêmicos e profissionais.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Como Funciona</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: BookOpen, title: "Conteúdo de Qualidade", desc: "Videoaulas e resoluções de provas criadas por professores experientes e aprovadas pela nossa equipe." },
            { icon: Users, title: "Professores Especializados", desc: "Profissionais qualificados compartilham seu conhecimento e são remunerados de forma justa." },
            { icon: Star, title: "Avaliações Reais", desc: "Alunos avaliam os conteúdos, garantindo transparência e melhoria contínua." },
            { icon: Target, title: "Foco no Resultado", desc: "Conteúdos direcionados para revisão e preparação para provas, vestibulares e concursos." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 space-y-2">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Nossa História</h2>
        <p className="text-muted-foreground leading-relaxed">
          A Revisão Fácil foi criada em 2026 por educadores e desenvolvedores que identificaram uma lacuna no mercado: a falta de uma plataforma que reunisse, de forma organizada e acessível, conteúdos de revisão produzidos por professores independentes. Desde então, temos crescido com o compromisso de oferecer a melhor experiência de aprendizado online.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Nossos Valores</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong className="text-foreground">Qualidade:</strong> cada conteúdo passa por revisão antes de ser publicado.</li>
          <li><strong className="text-foreground">Acessibilidade:</strong> preços justos para alunos e remuneração transparente para professores.</li>
          <li><strong className="text-foreground">Transparência:</strong> avaliações abertas e comunicação clara com todos os usuários.</li>
          <li><strong className="text-foreground">Inovação:</strong> buscamos constantemente novas formas de melhorar a experiência de ensino e aprendizagem.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Entre em Contato</h2>
        <p className="text-muted-foreground leading-relaxed">
          Tem dúvidas, sugestões ou quer fazer parte da nossa equipe? Escreva para{" "}
          <a href="mailto:contato@revisaofacil.com" className="underline hover:text-foreground transition-colors">
            contato@revisaofacil.com
          </a>
        </p>
      </section>

      <div className="pt-6 border-t border-border">
        <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
      </div>
    </div>
  </div>
);

export default AboutUs;
