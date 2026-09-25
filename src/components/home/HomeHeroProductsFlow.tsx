import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProducts, productIcon } from "@/hooks/useProducts";

export default function HomeHeroProductsFlow() {
  const products = useProducts();
  const navigate = useNavigate();
  const [active, setActive] = useState<string | null>(null);
  const current = products.find((p) => p.key === active) ?? products[0];
  if (!current) return null;

  return (
    <section className="border-b border-border bg-background px-4 pb-10 pt-24 md:px-10 md:pt-28" aria-label="Nossos produtos">
      <div className="mx-auto w-full max-w-6xl">
        <div role="tablist" className="flex gap-2 overflow-x-auto pb-2 md:justify-center">
          {products.map((p) => {
            const Icon = productIcon(p.icon);
            const selected = p.key === current.key;
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
                {p.name}
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
              <Button className="mt-6" onClick={() => navigate(`/${current.key}`)}>
                {current.cta} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
