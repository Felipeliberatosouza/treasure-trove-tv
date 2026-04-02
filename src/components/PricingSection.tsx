import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const PricingSection = () => {
  return (
    <section className="px-6 py-20 md:px-12 lg:px-20">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-4"
        >
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Acesso <span className="text-gradient">ilimitado</span> a todos os cursos
          </h2>
          <p className="text-muted-foreground">
            Assine e tenha acesso completo a todos os cursos da plataforma
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="relative mx-auto mt-12 max-w-sm overflow-hidden rounded-2xl border border-primary/30 bg-card p-8"
          style={{ boxShadow: "var(--shadow-glow)" }}
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-6">
            <div className="flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <span className="text-sm font-semibold text-accent">PLANO PREMIUM</span>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-muted-foreground">R$</span>
              <span className="font-display text-5xl font-bold">49</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <ul className="space-y-3 text-left text-sm">
              {[
                "Acesso a todos os cursos",
                "Novos cursos toda semana",
                "Certificados de conclusão",
                "Suporte prioritário",
                "Acesso offline no app",
                "Comunidade exclusiva",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button size="lg" className="w-full font-display font-semibold">
              Começar Agora
            </Button>
            <p className="text-xs text-muted-foreground">
              Cancele quando quiser. Sem compromisso.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
