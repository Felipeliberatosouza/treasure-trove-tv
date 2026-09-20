import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Check, Loader2, Infinity as InfinityIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import PaymentSecurityBadge from "@/components/PaymentSecurityBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralCredits } from "@/hooks/useReferralCredits";
import { toast } from "sonner";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  highlighted: boolean;
}

const AiCredits = () => {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const { user } = useAuth();
  const { aiCredits } = useReferralCredits();
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("ai_credit_packages")
        .select("id, name, credits, price, highlighted")
        .eq("active", true)
        .order("sort_order");
      setPackages((data || []) as unknown as CreditPackage[]);
      setLoading(false);
    };
    load();
  }, []);

  const handleBuy = async (pkg: CreditPackage) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setBuying(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke("buy-ai-credits", {
        body: { action: "checkout", packageId: pkg.id },
      });
      if (error || !data?.ok || !data?.url) {
        toast.error(data?.error || "Não foi possível iniciar a compra. Tente novamente.");
        return;
      }
      window.location.href = data.url as string;
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 px-6 pb-20 md:px-12 lg:px-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="flex items-center justify-center gap-2 text-accent">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold">CRÉDITOS DE IA</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">
            Compre seus <span className="text-gradient">Créditos de IA</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Cada Crédito de IA gera um material completo: revisão em aula com professor virtual,
            resumo, simulado, Top Questões e colinha.
          </p>
          {user && (
            <p className="mt-2 text-sm font-medium">
              Você tem <span className="text-primary">{aiCredits}</span> Créditos de IA
            </p>
          )}

          {loading ? (
            <p className="mt-12 text-sm text-muted-foreground">Carregando pacotes...</p>
          ) : packages.length === 0 ? (
            <p className="mt-12 text-sm text-muted-foreground">
              Ainda não há pacotes de Créditos de IA disponíveis para compra.
            </p>
          ) : (
            <div
              className={`mt-12 grid gap-6 ${
                packages.length === 1
                  ? "max-w-sm mx-auto"
                  : packages.length === 2
                    ? "max-w-2xl mx-auto md:grid-cols-2"
                    : "md:grid-cols-3"
              }`}
            >
              {packages.map((pkg, idx) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08 }}
                  className={`relative overflow-hidden rounded-2xl border bg-card p-8 ${
                    pkg.highlighted ? "border-primary/30" : "border-border"
                  }`}
                  style={pkg.highlighted ? { boxShadow: "var(--shadow-glow)" } : undefined}
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-center gap-2 text-accent">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-semibold">{pkg.name}</span>
                    </div>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-muted-foreground">R$</span>
                      <span className="font-display text-5xl font-bold">
                        {Number(pkg.price).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <ul className="space-y-2 text-left text-sm">
                      <li className="flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0 text-accent" />
                        <span className="font-medium">{pkg.credits} Créditos de IA</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">
                          R$ {(Number(pkg.price) / pkg.credits).toFixed(2).replace(".", ",")} por
                          crédito
                        </span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">Sem prazo de validade</span>
                      </li>
                    </ul>
                    <Button
                      size="lg"
                      className="w-full font-display font-semibold"
                      disabled={buying === pkg.id}
                      onClick={() => handleBuy(pkg)}
                    >
                      {buying === pkg.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...
                        </>
                      ) : (
                        "Comprar Créditos de IA"
                      )}
                    </Button>
                    <div className="flex justify-center">
                      <PaymentSecurityBadge />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-12 rounded-2xl border border-border bg-card/50 p-6 text-left">
            <p className="flex items-center gap-2 font-display font-semibold">
              <InfinityIcon className="h-4 w-4 text-primary" /> Quer Créditos de IA todo mês?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os planos de assinatura já incluem Créditos de IA — alguns com uso ilimitado.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/#planos")}>
              Ver planos
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AiCredits;
