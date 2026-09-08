import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, ListChecks } from "lucide-react";

export interface StudyQuestion {
  question: string;
  options: string[];
  correct_index: number;
}

interface Props {
  topico: string;
  questoes: StudyQuestion[];
}

const StudySimuladoCard = ({ topico, questoes }: Props) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!questoes?.length) return null;

  const total = questoes.length;
  const correct = questoes.filter((_, i) => answers[i] === questoes[i].correct_index).length;
  const allAnswered = Object.keys(answers).length === total;

  return (
    <Card className="border-primary/20 bg-card/60 backdrop-blur">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <ListChecks className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Simulado: {topico}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {questoes.map((q, qi) => (
          <div key={qi} className="space-y-2">
            <p className="text-sm font-medium leading-snug">
              {qi + 1}. {q.question}
            </p>
            <div className="grid gap-1.5">
              {q.options.map((opt, oi) => {
                const picked = answers[qi] === oi;
                const isCorrect = q.correct_index === oi;
                const showState = submitted && picked;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                      showState
                        ? isCorrect
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-red-500/50 bg-red-500/10"
                        : picked
                          ? "border-primary/60 bg-primary/10"
                          : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + oi)}</span>
                    <span className="flex-1">{opt || "—"}</span>
                    {showState && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {showState && !isCorrect && <XCircle className="h-4 w-4 text-red-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          {!submitted ? (
            <Button disabled={!allAnswered} onClick={() => setSubmitted(true)} size="sm">
              Ver gabarito
            </Button>
          ) : (
            <>
              <span className="text-sm font-medium">
                Acertou {correct} de {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Refazer
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudySimuladoCard;
