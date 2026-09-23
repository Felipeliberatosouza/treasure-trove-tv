import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPdfBranding } from "@/lib/pdfBranding";
import {
  downloadSlides, downloadWord, reviseWork, type WorkContent,
} from "@/lib/workDocument";
import {
  ArrowLeft, FileText, Presentation, Loader2, Send, Download, Sparkles,
} from "lucide-react";

const TrabalhoIA = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [content, setContent] = useState<WorkContent | null>(null);
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [instrucao, setInstrucao] = useState("");
  const [historico, setHistorico] = useState<{ role: string; content: string }[]>([]);
  const [footer, setFooter] = useState("Revisão Fácil");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void getPdfBranding().then((b) => setFooter(`${b.platformName} — ${b.commercialDomain}`));
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("work_documents")
      .select("id, titulo, content")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      setContent(data.content as unknown as WorkContent);
      setTitulo(data.titulo);
    }
    const { data: msgs } = await supabase
      .from("work_document_messages")
      .select("role, content")
      .eq("document_id", id)
      .order("created_at");
    setHistorico((msgs ?? []) as { role: string; content: string }[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const handleRevise = async () => {
    const msg = instrucao.trim();
    if (!msg || !id) return;
    setInstrucao("");
    setHistorico((h) => [...h, { role: "user", content: msg }]);
    setBusy(true);
    const { data, error } = await reviseWork(id, msg);
    setBusy(false);
    if (error) {
      if (error.kind === "paywall") {
        toast({
          title: "Seus Créditos de IA acabaram",
          description: "Compre Créditos de IA ou assine um plano para continuar ajustando o trabalho.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Não foi possível ajustar", description: error.message, variant: "destructive" });
      return;
    }
    setContent(data!.content);
    setTitulo(data!.content.titulo || titulo);
    setHistorico((h) => [...h, { role: "ai", content: "Ajuste aplicado ao trabalho." }]);
    toast({ title: "Trabalho atualizado", description: "Baixe novamente para pegar a versão nova." });
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-lg px-4 pt-32 text-center">
          <p className="mb-4 text-muted-foreground">Entre na sua conta para ver o seu trabalho.</p>
          <Button onClick={() => navigate("/login")}>Entrar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 pt-24 pb-16">
        <Link to="/meus-trabalhos" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Meus trabalhos
        </Link>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !content ? (
          <p className="text-sm text-muted-foreground">Trabalho não encontrado.</p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Trabalho gerado com IA
                </p>
                <h1 className="font-display text-2xl font-bold md:text-3xl">{titulo}</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void downloadWord(content, footer)}>
                  <Download className="h-4 w-4" /> Baixar Word
                </Button>
                <Button variant="outline" onClick={() => void downloadSlides(content, footer)}>
                  <Presentation className="h-4 w-4" /> Baixar slides
                </Button>
              </div>
            </div>

            <Card className="mb-6">
              <CardContent className="space-y-4 p-6 text-left">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <FileText className="h-5 w-5 text-primary" /> Documento
                </h2>
                {content.resumo_executivo && (
                  <section>
                    <h3 className="font-semibold">Resumo</h3>
                    <p className="text-sm text-muted-foreground">{content.resumo_executivo}</p>
                  </section>
                )}
                {content.introducao && (
                  <section>
                    <h3 className="font-semibold">Introdução</h3>
                    <p className="text-sm text-muted-foreground">{content.introducao}</p>
                  </section>
                )}
                {(content.secoes ?? []).map((s, i) => (
                  <section key={`${s.titulo}-${i}`}>
                    <h3 className="font-semibold">{s.titulo}</h3>
                    {(s.paragrafos ?? []).map((p, j) => (
                      <p key={j} className="mb-2 text-sm text-muted-foreground">{p}</p>
                    ))}
                  </section>
                ))}
                {content.conclusao && (
                  <section>
                    <h3 className="font-semibold">Conclusão</h3>
                    <p className="text-sm text-muted-foreground">{content.conclusao}</p>
                  </section>
                )}
                {content.referencias?.length ? (
                  <section>
                    <h3 className="font-semibold">Referências</h3>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground">
                      {content.referencias.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </section>
                ) : null}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardContent className="space-y-4 p-6 text-left">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Presentation className="h-5 w-5 text-primary" /> Slides
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(content.slides ?? []).map((s, i) => (
                    <div key={`${s.titulo}-${i}`} className="rounded-lg border border-border p-4">
                      <p className="mb-2 text-xs text-muted-foreground">Slide {i + 1}</p>
                      <p className="mb-2 font-semibold">{s.titulo}</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {(s.bullets ?? []).map((b, j) => <li key={j}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div ref={bottomRef} />

            <Card>
              <CardContent className="space-y-3 p-5 text-left">
                <h2 className="font-display text-base font-semibold">Peça ajustes para a IA</h2>
                {historico.length > 0 && (
                  <ul className="space-y-2">
                    {historico.map((m, i) => (
                      <li
                        key={i}
                        className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {m.content}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 rounded-2xl border border-border p-2">
                  <input
                    value={instrucao}
                    onChange={(e) => setInstrucao(e.target.value)}
                    disabled={busy}
                    placeholder="Ex.: reduza para 5 páginas, resuma a introdução, coloque mais exemplos..."
                    aria-label="Pedido de ajuste do trabalho"
                    className="w-full border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleRevise();
                      }
                    }}
                  />
                  <Button size="icon" className="rounded-full" disabled={busy || !instrucao.trim()} onClick={() => void handleRevise()} aria-label="Enviar pedido de ajuste">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada ajuste consome Créditos de IA conforme a configuração da plataforma.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default TrabalhoIA;
