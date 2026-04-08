import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const fallbackHtml = `<p>Última atualização: 7 de abril de 2026</p>
<h2>1. Introdução</h2>
<p>A <strong>Revisão Fácil</strong> valoriza a privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais.</p>`;

const PrivacyPolicy = () => {
  const { data, loading } = usePlatformSettings("privacy_policy");

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
          <div
            className="prose prose-sm max-w-none text-muted-foreground leading-relaxed
                       prose-headings:text-foreground prose-headings:font-semibold
                       prose-strong:text-foreground prose-a:text-primary prose-a:underline"
            dangerouslySetInnerHTML={{ __html: data?.content || fallbackHtml }}
          />
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
