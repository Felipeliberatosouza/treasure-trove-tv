import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface PlanData {
  name: string;
  price: number;
  features: string[];
  highlighted: boolean;
  cancel_text?: string;
  checkout_url?: string;
  allow_free_cancel?: boolean;
  min_commitment_days?: number;
}

const defaultPlans: PlanData[] = [
  {
    name: "PLANO PREMIUM",
    price: 49,
    features: [
      "Acesso a todos os cursos",
      "Novos cursos toda semana",
      "Certificados de conclusão",
      "Suporte prioritário",
      "Acesso offline no app",
      "Comunidade exclusiva",
    ],
    highlighted: true,
    cancel_text: "Cancele quando quiser. Sem compromisso.",
  },
];

const PricingSection = () => {
  const [plans, setPlans] = useState<PlanData[]>(defaultPlans);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("name, price, features, highlighted, cancel_text, checkout_url, allow_free_cancel, min_commitment_days")
        .eq("active", true)
        .order("sort_order");
      if (data?.length) setPlans(data as unknown as PlanData[]);
    };
    fetchPlans();
  }, []);

  return (
    <section className="px-6 py-20 md:px-12 lg:px-20">
      <div className="mx-auto max-w-5xl text-center">
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

        <div className={`mt-12 grid gap-6 ${plans.length === 1 ? "max-w-sm mx-auto" : plans.length === 2 ? "max-w-2xl mx-auto md:grid-cols-2" : "md:grid-cols-3"}`}>
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`relative overflow-hidden rounded-2xl border bg-card p-8 ${
                plan.highlighted ? "border-primary/30" : "border-border"
              }`}
              style={plan.highlighted ? { boxShadow: "var(--shadow-glow)" } : undefined}
            >
              {plan.highlighted && (
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
              )}
              <div className="relative space-y-6">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5 text-accent" />
                  <span className="text-sm font-semibold text-accent">{plan.name}</span>
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-muted-foreground">R$</span>
                  <span className="font-display text-5xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <ul className="space-y-3 text-left text-sm">
                  {plan.features.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  className="w-full font-display font-semibold"
                  onClick={() => {
                    if (plan.checkout_url) {
                      window.open(plan.checkout_url, "_blank");
                    }
                  }}
                >
                  Começar Agora
                </Button>
                {plan.allow_free_cancel !== false && plan.cancel_text && (
                  <p className="flex items-center justify-center gap-1.5 text-xs text-green-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {plan.cancel_text}
                  </p>
                )}
                {plan.allow_free_cancel === false && plan.min_commitment_days && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="flex items-center justify-center gap-1.5 text-xs text-amber-500 cursor-help">
                        <Clock className="h-3.5 w-3.5" />
                        Permanência mínima de {plan.min_commitment_days} dias.
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-center">
                      <p className="text-sm">
                        Este plano possui um período mínimo de <strong>{plan.min_commitment_days} dias</strong>.
                        Se cancelar antes desse prazo, será cobrado o valor proporcional aos dias restantes.
                        Após o período mínimo, o cancelamento é gratuito.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
