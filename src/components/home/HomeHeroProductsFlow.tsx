import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { productIcon, type Product } from "@/hooks/useProducts";

type Props = {
  products: Product[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Esconde o link da página do produto (usado dentro da própria página). */
  hideLink?: boolean;
};

/** Abas de produtos da página inicial, com o link da página do produto logo abaixo. */
export default function HomeHeroProductsFlow({ products, activeKey, onSelect, hideLink }: Props) {
  const current = products.find((p) => p.key === activeKey) ?? products[0];
  if (!current) return null;

  return (
    <section className="bg-background px-4 pb-2 pt-24 md:px-10 md:pt-28" aria-label="Nossos produtos">
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
                onClick={() => onSelect(p.key)}
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
        {!hideLink && <div className="mt-3 text-center">
          <Link
            to={`/${current.key}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {current.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>}
      </div>
    </section>
  );
}
