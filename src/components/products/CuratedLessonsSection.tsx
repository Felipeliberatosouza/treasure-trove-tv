import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type CuratedLesson = {
  id: string; product_key: string; title: string; summary: string | null;
  script: string; sources: string | null; audio_path: string | null; created_at: string;
};

/** Divide o roteiro em slides pelos títulos "## " (ou "# "); sem títulos, por blocos de parágrafos. */
export function splitScript(script: string): { title: string; body: string }[] {
  const parts = script.split(/\n(?=#{1,2}\s)/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1 || /^#{1,2}\s/.test(parts[0] || "")) {
    return parts.map((p) => {
      const [first, ...rest] = p.split("\n");
      return { title: first.replace(/^#{1,2}\s*/, ""), body: rest.join("\n").trim() };
    });
  }
  const paras = script.split(/\n\s*\n/).filter((p) => p.trim());
  const out: { title: string; body: string }[] = [];
  for (let i = 0; i < paras.length; i += 2) out.push({ title: `Parte ${out.length + 1}`, body: paras.slice(i, i + 2).join("\n\n") });
  return out;
}

const CuratedLessonsSection = ({ productKey }: { productKey: string }) => {
  const [items, setItems] = useState<CuratedLesson[]>([]);
  const [open, setOpen] = useState<CuratedLesson | null>(null);
  const [idx, setIdx] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("curated_lessons").select("*").eq("product_key", productKey).eq("published", true)
      .order("created_at", { ascending: false }).then(({ data }) => setItems((data as CuratedLesson[]) || []));
  }, [productKey]);

  useEffect(() => {
    setAudioUrl(null);
    if (!open?.audio_path) return;
    supabase.storage.from("curated-audio").createSignedUrl(open.audio_path, 3600).then(({ data }) => setAudioUrl(data?.signedUrl || null));
  }, [open]);

  const slides = useMemo(() => (open ? splitScript(open.script) : []), [open]);
  if (!items.length) return null;

  return (
    <section className="px-4 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-xl font-bold">Conteúdo oficial curado</h2>
        <p className="mt-1 text-sm text-muted-foreground">Roteiros e podcasts preparados pela equipe pedagógica a partir de editais e leis oficiais.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {items.map((it) => (
            <button key={it.id} type="button" onClick={() => { setOpen(it); setIdx(0); }}
              className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                <BadgeCheck className="h-3 w-3" /> Conteúdo oficial curado
              </span>
              <h3 className="mt-2 font-semibold leading-tight">{it.title}</h3>
              {it.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{it.summary}</p>}
              {it.audio_path && <p className="mt-2 flex items-center gap-1 text-xs text-primary"><Headphones className="h-3 w-3" /> Com podcast</p>}
            </button>
          ))}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{open?.title}</DialogTitle></DialogHeader>
          {open?.audio_path && (audioUrl ? <audio controls src={audioUrl} className="w-full" /> : <p className="text-xs text-muted-foreground">Carregando podcast...</p>)}
          {slides[idx] && (
            <div className="min-h-[240px] rounded-xl border border-border bg-muted/40 p-6">
              <p className="text-xs text-muted-foreground">Slide {idx + 1} de {slides.length}</p>
              <h3 className="mt-1 font-display text-lg font-bold">{slides[idx].title}</h3>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed">{slides[idx].body}</div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-4 w-4" /> Anterior</Button>
            <Button variant="outline" size="sm" disabled={idx >= slides.length - 1} onClick={() => setIdx(idx + 1)}>Próximo <ChevronRight className="h-4 w-4" /></Button>
          </div>
          {open?.sources && <p className="whitespace-pre-line text-xs text-muted-foreground"><strong>Fontes oficiais:</strong> {open.sources}</p>}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default CuratedLessonsSection;
