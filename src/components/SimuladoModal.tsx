import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ForensicWatermark from "@/components/ForensicWatermark";
import { useContentProtection } from "@/hooks/useContentProtection";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ClipboardList, ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizQuestion {
  id: string;
  position: number;
  question: string;
  options: string[];
  correct_index: number;
}

interface SimuladoModalProps {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
}

const SimuladoModal = ({ open, onClose, lessonId, lessonTitle }: SimuladoModalProps) => {
  useContentProtection({ context: `material:simulado:${lessonId}`, enabled: open });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setAnswers({});
    setCurrent(0);
    setSubmitted(false);
    (async () => {
      const { data } = await supabase
        .from("lesson_quiz_questions")
        .select("id, position, question, options, correct_index")
        .eq("lesson_id", lessonId)
        .order("position", { ascending: true });
      const parsed: QuizQuestion[] = (data || []).map((q: any) => ({
        id: q.id,
        position: q.position,
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correct_index: q.correct_index ?? 0,
      }));
      setQuestions(parsed);
      setLoading(false);
    })();
  }, [open, lessonId]);

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = total > 0 && answeredCount === total;

  const correctCount = questions.filter((q) => answers[q.id] === q.correct_index).length;
  const wrongCount = total - correctCount;
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleAnswer = (qId: string, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Simulado — {lessonTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando questões...</div>
        ) : total === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Este simulado ainda não tem questões cadastradas.
          </div>
        ) : !submitted ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Questão {current + 1} de {total}</span>
                <span>{answeredCount} respondida(s)</span>
              </div>
              <Progress value={((current + 1) / total) * 100} className="h-1.5" />
            </div>

            {(() => {
              const q = questions[current];
              const selected = answers[q.id];
              return (
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <p className="text-sm font-semibold text-foreground mb-3">{q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const isSelected = selected === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => handleAnswer(q.id, oi)}
                          className={cn(
                            "w-full text-left rounded-md border p-3 text-sm transition-colors",
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-background hover:bg-secondary/60",
                          )}
                        >
                          <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={current === 0}
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                className="gap-1"
              >
                <ArrowLeft className="h-4 w-4" /> Anterior
              </Button>
              {current < total - 1 ? (
                <Button
                  size="sm"
                  onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
                  className="gap-1"
                >
                  Próxima <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!allAnswered}
                  onClick={() => setSubmitted(true)}
                  className="gap-1"
                >
                  Finalizar simulado
                </Button>
              )}
            </div>
            {!allAnswered && current === total - 1 && (
              <p className="text-xs text-center text-muted-foreground">
                Responda todas as questões para finalizar.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-center">
              <Trophy className="mx-auto h-8 w-8 text-primary mb-2" />
              <p className="text-3xl font-display font-bold text-foreground">{percent}%</p>
              <p className="text-sm text-muted-foreground mt-1">de aproveitamento</p>
              <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> {correctCount} acerto(s)
                </span>
                <span className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="h-4 w-4" /> {wrongCount} erro(s)
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gabarito</p>
              {questions.map((q, qi) => {
                const userAns = answers[q.id];
                const isRight = userAns === q.correct_index;
                return (
                  <div key={q.id} className="rounded-md border border-border bg-secondary/30 p-3">
                    <div className="flex items-start gap-2 mb-2">
                      {isRight ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      )}
                      <p className="text-sm font-medium text-foreground">
                        Q{qi + 1}. {q.question}
                      </p>
                    </div>
                    <div className="space-y-1 pl-6 text-xs">
                      {q.options.map((opt, oi) => {
                        const isCorrect = oi === q.correct_index;
                        const isUser = oi === userAns;
                        return (
                          <div
                            key={oi}
                            className={cn(
                              "rounded px-2 py-1",
                              isCorrect && "bg-green-500/10 text-green-700 dark:text-green-400 font-medium",
                              !isCorrect && isUser && "bg-destructive/10 text-destructive line-through",
                            )}
                          >
                            <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                            {opt}
                            {isCorrect && <span className="ml-2 text-[10px] uppercase">(correta)</span>}
                            {!isCorrect && isUser && <span className="ml-2 text-[10px] uppercase">(sua resposta)</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setCurrent(0); setAnswers({}); }}>
                Refazer
              </Button>
              <Button size="sm" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SimuladoModal;
