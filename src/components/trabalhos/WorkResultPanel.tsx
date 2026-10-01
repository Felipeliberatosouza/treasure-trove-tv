import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Presentation, Lightbulb, MessageCircleQuestion, Loader2 } from "lucide-react";
import { downloadWord, downloadSlides, getWorkExtras, type WorkContent, type WorkExtras } from "@/lib/workDocument";
import { toast } from "sonner";

/** Resultado de um pedido de trabalho: downloads exclusivos + Dicas e Perguntas da apresentação. */
export default function WorkResultPanel({ docId }: { docId: string }) {
  const [doc, setDoc] = useState<{ titulo: string; content: WorkContent; layout_theme: string | null } | null>(null);
  const [extras, setExtras] = useState<WorkExtras | null>(null);
  const [open, setOpen] = useState<"dicas" | "perguntas" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("work_documents").select("titulo, content, layout_theme, presentation_extras").eq("id", docId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setDoc({ titulo: data.titulo, content: data.content as unknown as WorkContent, layout_theme: data.layout_theme });
        if (data.presentation_extras) setExtras(data.presentation_extras as WorkExtras);
      });
  }, [docId]);

  const show = async (which: "dicas" | "perguntas") => {
    setOpen(which);
    if (extras) return;
    setLoading(true);
    const { data, error } = await getWorkExtras(docId);
    setLoading(false);
    if (error) { toast.error(error); setOpen(null); return; }
    setExtras(data || null);
  };

  if (!doc) return null;
  const footer = "Gerado na Revisão Fácil";

  return (
    <section id="resultado-trabalho" className="px-4 py-8 md:px-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-primary/30 bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Seu trabalho exclusivo</p>
        <h2 className="mt-1 font-display text-xl font-bold">{doc.titulo}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => void downloadWord(doc.content, footer, doc.layout_theme)}><FileText className="mr-2 h-4 w-4" />Baixar documento Word</Button>
          <Button variant="outline" onClick={() => void downloadSlides(doc.content, footer, doc.layout_theme)}><Presentation className="mr-2 h-4 w-4" />Baixar slides (PowerPoint)</Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button onClick={() => show("dicas")} className={`flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium hover:border-primary/60 ${open === "dicas" ? "border-primary" : "border-border"}`}>
            <Lightbulb className="h-5 w-5 text-primary" />Dicas para a apresentação ou aula
          </button>
          <button onClick={() => show("perguntas")} className={`flex items-center gap-3 rounded-xl border p-4 text-left text-sm font-medium hover:border-primary/60 ${open === "perguntas" ? "border-primary" : "border-border"}`}>
            <MessageCircleQuestion className="h-5 w-5 text-primary" />Perguntas que podem ser feitas na apresentação
          </button>
        </div>
        {open && (
          <div className="mt-4 rounded-xl bg-muted p-4 text-sm">
            {loading || !extras ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparando com base nos seus slides…</p>
            ) : open === "dicas" ? (
              <div className="space-y-3">
                {(extras.dicas_gerais || []).length > 0 && (
                  <ul className="list-disc space-y-1 pl-5">{extras.dicas_gerais!.map((d, i) => <li key={i}>{d}</li>)}</ul>
                )}
                {(extras.dicas || []).map((d, i) => (
                  <div key={i}><p className="font-semibold">{d.slide}{d.tempo ? ` · ${d.tempo}` : ""}</p><p className="text-muted-foreground">{d.dica}</p></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(extras.perguntas || []).map((p, i) => (
                  <div key={i}><p className="font-semibold">{i + 1}. {p.pergunta}</p><p className="text-muted-foreground">{p.resposta}</p></div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
