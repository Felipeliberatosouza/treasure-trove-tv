import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { KitQuizQuestion } from "@/lib/revisionKit";

interface Props {
  questoes: KitQuizQuestion[];
}

/** Simulado do Kit de Revisão — mesmo comportamento dos simulados da plataforma. */
const KitQuiz = ({ questoes }: Props) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (!questoes?.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma questão foi gerada para este kit.</p>;
  }

  const correct = questoes.filter((q, i) => answers[i] === q.resposta_correta).length;

  return (
    <div className="space-y-4">
      {questoes.map((q, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">
              {i + 1}. {q.enunciado}
            </p>
            <div className="space-y-2">
              {q.alternativas.map((alt, a) => {
                const selected = answers[i] === a;
                const isRight = submitted && a === q.resposta_correta;
                const isWrong = submitted && selected && a !== q.resposta_correta;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => !submitted && setAnswers((p) => ({ ...p, [i]: a }))}
                    className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isRight
                        ? "border-primary bg-primary/10"
                        : isWrong
                          ? "border-destructive bg-destructive/10"
                          : selected
                            ? "border-primary bg-muted"
                            : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="mt-0.5 font-semibold">{String.fromCharCode(65 + a)})</span>
                    <span className="flex-1">{alt}</span>
                    {isRight && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                    {isWrong && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="mb-1 font-semibold">Explicação</p>
                <p className="text-muted-foreground">{q.explicacao}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {submitted ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold">
            Você acertou {correct} de {questoes.length} questões.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Refazer
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={Object.keys(answers).length < questoes.length}
          onClick={() => setSubmitted(true)}
        >
          Corrigir simulado
        </Button>
      )}
    </div>
  );
};

export default KitQuiz;
