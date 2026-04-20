import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Trophy, StickyNote } from "lucide-react";

export type MaterialKind = "resumo" | "top_questoes" | "colinhas";

interface Props {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  kind: MaterialKind;
}

const MaterialViewerModal = ({ open, onClose, lessonId, lessonTitle, kind }: Props) => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string>("");
  const [topQs, setTopQs] = useState<{ question: string; answer: string }[]>([]);
  const [bullets, setBullets] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      if (kind === "resumo") {
        const { data } = await supabase
          .from("lesson_summaries")
          .select("content")
          .eq("lesson_id", lessonId)
          .maybeSingle();
        setSummary(data?.content || "");
      } else if (kind === "top_questoes") {
        const { data } = await supabase
          .from("lesson_top_questions")
          .select("question, answer, position")
          .eq("lesson_id", lessonId)
          .order("position", { ascending: true });
        setTopQs((data || []).map((d) => ({ question: d.question, answer: d.answer })));
      } else if (kind === "colinhas") {
        const { data } = await supabase
          .from("lesson_cheatsheet_items")
          .select("text, position")
          .eq("lesson_id", lessonId)
          .order("position", { ascending: true });
        setBullets((data || []).map((d) => d.text));
      }
      setLoading(false);
    })();
  }, [open, lessonId, kind]);

  const config = {
    resumo: { icon: FileText, label: "Resumo" },
    top_questoes: { icon: Trophy, label: "Top Questões de Prova" },
    colinhas: { icon: StickyNote, label: "Colinha" },
  }[kind];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {config.label} — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : kind === "resumo" ? (
          summary ? (
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{summary}</p>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Resumo ainda não disponível.</p>
          )
        ) : kind === "top_questoes" ? (
          topQs.length > 0 ? (
            <div className="space-y-3">
              {topQs.map((q, i) => (
                <div key={i} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-sm font-semibold text-foreground mb-1">Q{i + 1}. {q.question}</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.answer}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma top questão cadastrada.</p>
          )
        ) : bullets.length > 0 ? (
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-2.5 text-sm">
                <span className="text-primary font-semibold shrink-0">{i + 1}.</span>
                <span className="text-foreground">{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma colinha cadastrada.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MaterialViewerModal;
