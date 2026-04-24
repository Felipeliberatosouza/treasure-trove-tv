import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ForensicWatermark from "@/components/ForensicWatermark";
import { useContentProtection } from "@/hooks/useContentProtection";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { StickyNote, ArrowLeft, ArrowRight, RotateCcw, Shuffle, List } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
}

const ColinhaFlashcardModal = ({ open, onClose, lessonId, lessonTitle }: Props) => {
  useContentProtection({ context: `material:colinhas:${lessonId}`, enabled: open });
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"flashcard" | "list">("flashcard");
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [order, setOrder] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCurrent(0);
    setFlipped(false);
    setMode("flashcard");
    (async () => {
      const { data } = await supabase
        .from("lesson_cheatsheet_items")
        .select("text, position")
        .eq("lesson_id", lessonId)
        .order("position", { ascending: true });
      const list = (data || []).map((d) => d.text);
      setBullets(list);
      setOrder(list.map((_, i) => i));
      setLoading(false);
    })();
  }, [open, lessonId]);

  const total = bullets.length;
  const currentIdx = order[current] ?? 0;
  const text = bullets[currentIdx] ?? "";

  const shuffle = () => {
    const arr = [...order];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
    setCurrent(0);
    setFlipped(false);
  };

  const next = () => { setFlipped(false); setCurrent((c) => Math.min(total - 1, c + 1)); };
  const prev = () => { setFlipped(false); setCurrent((c) => Math.max(0, c - 1)); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Colinha — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma colinha cadastrada.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "flashcard" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("flashcard")}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Flashcards
              </Button>
              <Button
                variant={mode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("list")}
                className="gap-1.5"
              >
                <List className="h-3.5 w-3.5" /> Lista completa
              </Button>
              {mode === "flashcard" && (
                <Button variant="ghost" size="sm" onClick={shuffle} className="gap-1.5 ml-auto">
                  <Shuffle className="h-3.5 w-3.5" /> Embaralhar
                </Button>
              )}
            </div>

            {mode === "flashcard" ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Cartão {current + 1} de {total}</span>
                    <span>{flipped ? "Mostrando dica" : "Toque para revelar"}</span>
                  </div>
                  <Progress value={((current + 1) / total) * 100} className="h-1.5" />
                </div>

                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  className={cn(
                    "w-full min-h-[220px] rounded-2xl border-2 p-6 text-center transition-all",
                    "flex items-center justify-center cursor-pointer select-none",
                    flipped
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/50",
                  )}
                  aria-label="Virar cartão"
                >
                  {flipped ? (
                    <p className="text-base md:text-lg font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                      {text}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-5xl font-display font-bold text-primary">#{current + 1}</div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Toque para revelar a colinha</p>
                    </div>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" disabled={current === 0} onClick={prev} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Button
                    size="sm"
                    disabled={current === total - 1}
                    onClick={next}
                    className="gap-1"
                  >
                    Próximo <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <ul className="space-y-2">
                {bullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-2.5 text-sm"
                  >
                    <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                    <span className="text-foreground">{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ColinhaFlashcardModal;
