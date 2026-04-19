import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useEffect } from "react";

const fallbackSections = [
  { title: "1. Introdução", content: "A Revisão Fácil valoriza a privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais." },
];

/** Normalize a title into a URL-safe anchor id. */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\d+\.\s*/, "") // strip leading "12. "
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const sectionId = (sec: { id?: string; title?: string }, idx: number) =>
  sec.id?.trim() || (sec.title ? slugify(sec.title) : `secao-${idx + 1}`);

const PrivacyPolicy = () => {
  const { data, loading } = usePlatformSettings("privacy_policy");
  const sections = data?.sections?.length ? data.sections : fallbackSections;

  // Smooth-scroll to hash anchor after sections render
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, sections.length]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-3xl space-y-8">
          <h1 className="font-display text-3xl font-bold text-gradient">Política de Privacidade</h1>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((sec, idx) => {
                const id = sectionId(sec, idx);
                return (
                  <section key={idx} id={id} className="space-y-2 scroll-mt-24">
                    {sec.title && <h2 className="text-xl font-semibold">{sec.title}</h2>}
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{sec.content}</p>
                  </section>
                );
              })}
            </div>
          )}

          <div className="pt-6 border-t border-border">
            <a href="/" className="text-sm text-primary hover:underline transition-colors">← Voltar para a página inicial</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
