import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, GraduationCap, Loader2, Sparkles, Video } from "lucide-react";
import KitQuiz from "./KitQuiz";
import NarratedSlidesPlayer from "@/components/study/NarratedSlidesPlayer";
import { buildKitPdf, type KitResponse } from "@/lib/revisionKit";
import VideoShareButtons from "@/components/VideoShareButtons";
import VLibrasWidget from "@/components/VLibrasWidget";
import ForensicWatermark from "@/components/ForensicWatermark";
import BrandStamp from "@/components/branding/BrandStamp";
import { CONTENT_SECTIONS, getSection, type SectionKey } from "@/lib/contentSections";

interface Props {
  result: KitResponse;
  sectionKey: SectionKey;
  onNewKit: () => void;
}

const sectionItems = (kit: any, key: SectionKey): any[] => {
  const list =
    key === "revisoes"
      ? kit?.slides
      : key === "resumo"
      ? kit?.resumo
      : key === "simulado"
      ? kit?.simulado
      : key === "top_questoes"
      ? kit?.top_questoes
      : kit?.colinha;
  return Array.isArray(list) ? list : [];
};

const KitSectionView = ({ result, sectionKey, onNewKit }: Props) => {
  const kit = result.kit as any;
  const section = getSection(sectionKey);
  const Icon = section.icon;
  const [downloading, setDownloading] = useState(false);

  const assunto = kit.assunto || kit.titulo || "";
  const items = sectionItems(kit, sectionKey);

  const others = CONTENT_SECTIONS.filter(
    (s) => s.key !== sectionKey && sectionItems(kit, s.key).length > 0,
  );

  const handlePdf = async () => {
    setDownloading(true);
    try {
      const doc = await buildKitPdf(kit);
      doc.save(
        `${section.itemPrefix}-${(assunto || "revisao").slice(0, 40).replace(/\s+/g, "-").toLowerCase()}.pdf`,
      );
    } catch {
      toast.error("Não foi possível gerar o PDF agora.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative space-y-6">
      <ForensicWatermark variant="document" cols={3} rows={6} />
      <VLibrasWidget enabled />

      <div className="space-y-2">
        <Link to={section.href} className="text-sm text-muted-foreground hover:text-primary">
          ← Voltar para {section.label}
        </Link>
        <div className="flex items-center gap-3">
          <Icon className="h-7 w-7 shrink-0 text-primary" />
          <h1 className="font-display text-2xl font-bold">
            {section.itemPrefix}: {assunto}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {["Professora virtual da Revisão Fácil", kit.disciplina].filter(Boolean).join(" • ")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Produzido com apoio de IA — confira com seu professor</Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {sectionKey !== "revisoes" && (
            <Button variant="outline" onClick={handlePdf} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar PDF
            </Button>
          )}
          <Button onClick={onNewKit}>
            <Sparkles className="mr-2 h-4 w-4" /> Novo kit
          </Button>
        </div>
      </div>

      <BrandStamp />

      {sectionKey === "revisoes" && (
        <div className="ai-slide-shell overflow-hidden rounded-xl bg-muted shadow-xl">
          <NarratedSlidesPlayer
            topico={kit.assunto}
            disciplina={kit.disciplina}
            slides={kit.slides ?? []}
            canonicalId={result.canonical_id}
            areas={result.areas}
            faixaEtaria={kit.faixa_etaria}
          />
        </div>
      )}

      {sectionKey === "revisoes" && (
        <DoubtForm
          contentId={result.canonical_id ?? undefined}
          contentType="ai_content"
          title="Enviar Dúvida sobre esta aula"
          placeholder="Descreva sua dúvida sobre esta aula com professor virtual..."
        />
      )}

      {sectionKey === "resumo" && (
        <div className="space-y-4">
          {items.map((s: any, i: number) => (
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
                  {kit.conceitos_chave.map((c: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {sectionKey === "simulado" && <KitQuiz questoes={kit.simulado ?? []} />}

      {sectionKey === "top_questoes" && (
        <div className="space-y-3">
          {items.map((q: any, i: number) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold">
                  {i + 1}. {q.enunciado}
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{q.gabarito}</p>
                <div className="flex flex-wrap gap-2">
                  {q.subtopico && <Badge variant="outline">{q.subtopico}</Badge>}
                  {q.dificuldade && <Badge variant="secondary">{q.dificuldade}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sectionKey === "colinha" && (
        <Card>
          <CardContent className="p-4">
            <ul className="space-y-2 text-sm">
              {items.map((c: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <VideoShareButtons
          videoTitle={`${section.itemPrefix}: ${assunto}`}
          videoUrl={window.location.href}
        />
      </div>

      {others.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="space-y-3 p-5">
            <h3 className="font-semibold">Outros materiais sobre {assunto}</h3>
            <div className="flex flex-wrap gap-2">
              {others.map((s) => (
                <Button key={s.key} asChild variant="outline" size="sm">
                  <Link to={`/conteudo-ia/${result.canonical_id}?secao=${s.key}`}>
                    <s.icon className="mr-2 h-4 w-4" />
                    {s.key === "revisoes" ? "Aula com Professor Virtual" : s.shortLabel}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30">
        <CardContent className="space-y-3 p-5">
          <h3 className="font-semibold">Quer revisar com um professor?</h3>
          <p className="text-sm text-muted-foreground">
            Agende uma aula particular ou assista a uma aula gravada sobre este assunto.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/minhas-aulas-agendadas">
                <GraduationCap className="mr-2 h-4 w-4" /> Agendar aula
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/revisoes">
                <Video className="mr-2 h-4 w-4" /> Ver Aulas Gravadas por Professor
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KitSectionView;
