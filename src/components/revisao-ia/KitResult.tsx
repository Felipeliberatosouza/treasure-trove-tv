import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, ListChecks, Trophy, StickyNote, Presentation, Download,
  ThumbsUp, ThumbsDown, GraduationCap, Video, Sparkles, Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import KitQuiz from "./KitQuiz";
import NarratedSlidesPlayer from "@/components/study/NarratedSlidesPlayer";
import { buildKitPdf, type KitResponse } from "@/lib/revisionKit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import VideoShareButtons from "@/components/VideoShareButtons";
import VLibrasWidget from "@/components/VLibrasWidget";
import ForensicWatermark from "@/components/ForensicWatermark";

interface Props {
  result: KitResponse;
  onNewKit: () => void;
}

const KitResult = ({ result, onNewKit }: Props) => {
  const kit = result.kit;
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handlePdf = async () => {
    setDownloading(true);
    try {
      const doc = await buildKitPdf(kit);
      doc.save(`kit-revisao-${(kit.assunto || "revisao").slice(0, 40).replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch {
      toast.error("Não foi possível gerar o PDF agora.");
    } finally {
      setDownloading(false);
    }
  };

  const sendFeedback = async (helpful: boolean) => {
    setFeedbackSent(true);
    if (!user) return;
    await supabase.from("ai_content_feedback").insert({
      canonical_id: result.canonical_id ?? null,
      request_id: result.request_id ?? null,
      user_id: user.id,
      helpful,
    });
    toast.success("Obrigado pelo retorno!");
  };

  return (
    <div className="relative space-y-6">
      <ForensicWatermark variant="document" cols={3} rows={6} />
      <VLibrasWidget enabled />
      <div className="space-y-2">
        <div>
          <h1 className="font-display text-2xl font-bold">{kit.titulo || kit.assunto}</h1>
          <p className="text-sm text-muted-foreground">
            {["Professora virtual da Revisão Fácil", kit.disciplina, kit.assunto].filter(Boolean).join(" • ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Produzido com apoio de IA — confira com seu professor</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePdf} disabled={downloading}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Baixar PDF
          </Button>
          <Button onClick={onNewKit}>
            <Sparkles className="mr-2 h-4 w-4" /> Novo kit
          </Button>
        </div>
      </div>

      <div className="ai-slide-shell overflow-hidden rounded-xl bg-muted shadow-xl">
        <NarratedSlidesPlayer topico={kit.assunto} disciplina={kit.disciplina} slides={kit.slides ?? []} canonicalId={result.canonical_id} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <VideoShareButtons videoTitle={kit.titulo || kit.assunto} videoUrl={window.location.href} />
        <Badge variant="outline">Áudio, imagens e legendas inclusos</Badge>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="resumo"><FileText className="mr-1 h-4 w-4" /> Resumo</TabsTrigger>
          <TabsTrigger value="simulado"><ListChecks className="mr-1 h-4 w-4" /> Simulado</TabsTrigger>
          <TabsTrigger value="top"><Trophy className="mr-1 h-4 w-4" /> Top Questões</TabsTrigger>
          <TabsTrigger value="colinha"><StickyNote className="mr-1 h-4 w-4" /> Colinha</TabsTrigger>
          <TabsTrigger value="slides"><Presentation className="mr-1 h-4 w-4" /> Apresentação</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4 pt-4">
          {kit.resumo?.map((s, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold">{s.titulo}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{s.conteudo}</p>
              </CardContent>
            </Card>
          ))}
          {kit.conceitos_chave?.length ? (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold">Conceitos-chave</h3>
                <ul className="space-y-1 text-sm">
                  {kit.conceitos_chave.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          {kit.pontos_de_atencao?.length ? (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 font-semibold">Pontos de atenção</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {kit.pontos_de_atencao.map((c, i) => <li key={i}>• {c}</li>)}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="simulado" className="pt-4">
          <KitQuiz questoes={kit.simulado ?? []} />
        </TabsContent>

        <TabsContent value="top" className="space-y-3 pt-4">
          {(kit.top_questoes ?? []).map((q, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold">{i + 1}. {q.enunciado}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{q.gabarito}</p>
                <div className="flex flex-wrap gap-2">
                  {q.subtopico && <Badge variant="outline">{q.subtopico}</Badge>}
                  {q.dificuldade && <Badge variant="secondary">{q.dificuldade}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="colinha" className="pt-4">
          <Card>
            <CardContent className="p-4">
              <ul className="space-y-2 text-sm">
                {(kit.colinha ?? []).map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {c}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slides" className="pt-4">
          <p className="text-sm text-muted-foreground">A apresentação audiovisual está disponível no player principal acima.</p>
        </TabsContent>
      </Tabs>

      {/* Ponte para o conteúdo humano da plataforma */}
      <Card className="border-primary/30">
        <CardContent className="space-y-3 p-5">
          <h3 className="font-semibold">Quer revisar com um professor?</h3>
          <p className="text-sm text-muted-foreground">
            Agende uma aula particular ou assista a uma aula gravada sobre este assunto.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/minhas-aulas-agendadas"><GraduationCap className="mr-2 h-4 w-4" /> Agendar aula</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/revisoes"><Video className="mr-2 h-4 w-4" /> Ver aulas gravadas</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/#pricing">Conhecer os planos</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {feedbackSent ? (
          <span>Obrigado! Seu retorno ajuda a melhorar as revisões.</span>
        ) : (
          <>
            <span>Este conteúdo ajudou?</span>
            <Button size="sm" variant="outline" onClick={() => sendFeedback(true)}>
              <ThumbsUp className="mr-1 h-4 w-4" /> Sim
            </Button>
            <Button size="sm" variant="outline" onClick={() => sendFeedback(false)}>
              <ThumbsDown className="mr-1 h-4 w-4" /> Reportar erro
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default KitResult;
