import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import KitResult from "@/components/revisao-ia/KitResult";
import { Button } from "@/components/ui/button";
import { fetchKitById, type KitResponse } from "@/lib/revisionKit";

const ConteudoIA = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<KitResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    void fetchKitById(id).then((data) => {
      setResult(data);
      setLoading(false);
    });
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 px-4 pb-14 pt-20 md:px-8">
        <div className="mx-auto w-full max-w-4xl">
          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Abrindo sua revisão…
            </div>
          ) : result ? (
            sectionKey ? (
              <KitSectionView result={result} sectionKey={sectionKey} onNewKit={() => navigate("/")} />
            ) : (
              <KitResult result={result} onNewKit={() => navigate("/")} />
            )
          ) : (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <h1 className="font-display text-2xl font-bold">Revisão não encontrada</h1>
              <Button onClick={() => navigate("/")}>Criar nova revisão</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConteudoIA;