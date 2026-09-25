import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import PricingSection from "@/components/PricingSection";
import HomeKitGenerator from "@/components/revisao-ia/HomeKitGenerator";
import NotFound from "@/pages/NotFound";
import { useProducts, productIcon } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ExtraField = { key: string; label: string; placeholder: string; options?: string[] };

const EXTRA_FIELDS: Record<string, ExtraField[]> = {
  enem: [{ key: "area", label: "Área do ENEM", placeholder: "Escolha a área", options: ["Linguagens", "Ciências Humanas", "Ciências da Natureza", "Matemática", "Redação"] }],
  vestibulares: [{ key: "instituicao", label: "Vestibular", placeholder: "Ex.: Fuvest, Unicamp, Unesp" }],
  oab: [
    { key: "fase", label: "Fase", placeholder: "Escolha a fase", options: ["1ª fase", "2ª fase"] },
    { key: "disciplina", label: "Disciplina", placeholder: "Ex.: Ética, Direito Civil" },
  ],
  concursos: [
    { key: "banca", label: "Banca", placeholder: "Ex.: Cebraspe, FGV, FCC" },
    { key: "cargo", label: "Cargo", placeholder: "Ex.: Analista, Técnico" },
    { key: "disciplina", label: "Disciplina", placeholder: "Ex.: Português, Direito Administrativo" },
  ],
};

type Item = { id: string; title: string; href: string };

export default function ProductPage() {
  const { pathname } = useLocation();
  const key = pathname.replace(/^\//, "").split("/")[0];
  const products = useProducts();
  const product = products.find((p) => p.key === key);
  const { user, profile } = useAuth() as any;
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [mine, setMine] = useState<Item[]>([]);
  const [lessons, setLessons] = useState<Item[]>([]);

  useEffect(() => {
    if (!product) return;
    document.title = `${product.title} | Revisão Fácil`;
    // Aulas de professores deste produto
    if (product.key !== "trabalhos") {
      supabase
        .from("lessons")
        .select("id, title")
        .contains("product_keys", [product.key])
        .eq("published", true)
        .eq("admin_approved", true)
        .limit(12)
        .then(({ data }) => setLessons((data || []).map((l: any) => ({ id: l.id, title: l.title, href: `/video/${l.id}` }))));
    }
  }, [product?.key]);

  useEffect(() => {
    if (!product || !user) { setMine([]); return; }
    (async () => {
      if (product.key === "trabalhos") {
        const { data } = await supabase.from("work_documents").select("id, tema").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
        setMine((data || []).map((d: any) => ({ id: d.id, title: d.tema, href: `/trabalho/${d.id}` })));
        return;
      }
      const { data: reqs } = await supabase.from("ai_revision_requests").select("canonical_id").eq("user_id", user.id).not("canonical_id", "is", null).limit(200);
      const ids = Array.from(new Set((reqs || []).map((r: any) => r.canonical_id)));
      if (!ids.length) { setMine([]); return; }
      const { data } = await supabase.from("ai_canonical_contents").select("id, assunto, product_keys").in("id", ids).contains("product_keys", [product.key]).limit(20);
      setMine((data || []).map((c: any) => ({ id: c.id, title: c.assunto, href: `/conteudo-ia/${c.id}` })));
    })();
  }, [product?.key, user?.id]);

  if (!product) return products.length ? <NotFound /> : null;

  const Icon = productIcon(product.icon);
  const fields = EXTRA_FIELDS[product.key] || [];
  const productExtra = fields.map((f) => extra[f.key] ? `${f.label}: ${extra[f.key]}` : "").filter(Boolean).join("; ");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24">
        <section className="border-b border-border px-4 pb-8 md:px-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">{product.name}</p>
            <p className="mt-2 text-muted-foreground">{product.page_intro || product.description}</p>
          </div>

          {fields.length > 0 && (
            <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
              {fields.map((f) => (
                <div key={f.key} className="text-left">
                  <Label className="text-xs">{f.label}</Label>
                  {f.options ? (
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={extra[f.key] || ""}
                      onChange={(e) => setExtra((x) => ({ ...x, [f.key]: e.target.value }))}
                    >
                      <option value="">{f.placeholder}</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <Input className="mt-1" placeholder={f.placeholder} value={extra[f.key] || ""} onChange={(e) => setExtra((x) => ({ ...x, [f.key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <HomeKitGenerator productKey={product.key} productExtra={productExtra} fixedHeadline={product.title + (profile?.name ? `, ${String(profile.name).split(" ")[0]}` : "")} />

        {user && (
          <section id="meus" className="px-4 py-8 md:px-10">
            <div className="mx-auto max-w-6xl">
              <h2 className="font-display text-xl font-bold">Meus materiais de {product.name}</h2>
              {mine.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Você ainda não tem materiais de {product.name}.</p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {mine.map((m) => (
                    <Link key={m.id} to={m.href} className="rounded-xl border border-border bg-card p-4 text-sm font-medium hover:border-primary/50">{m.title}</Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {lessons.length > 0 && (
          <section className="px-4 py-8 md:px-10">
            <div className="mx-auto max-w-6xl">
              <h2 className="font-display text-xl font-bold">Aulas Gravadas por Professor: {product.name}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {lessons.map((m) => (
                  <Link key={m.id} to={m.href} className="rounded-xl border border-border bg-card p-4 text-sm font-medium hover:border-primary/50">{m.title}</Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <PricingSection productKey={product.key} />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
