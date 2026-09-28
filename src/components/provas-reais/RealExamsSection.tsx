import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileDown, CheckCircle2, XCircle } from "lucide-react";

type Exam = { id: string; year: number; title: string; board: string | null; phase: string | null; pdf_url: string | null };
type Question = { id: string; number: number; subject: string | null; statement: string; image_url: string | null; options: { letter: string; text: string }[]; correct: string | null; explanation: string | null };

const PAGE = 5;

export default function RealExamsSection({ productKey, productName }: { productKey: string; productName: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [examId, setExamId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("real_exams").select("id, year, title, board, phase, pdf_url")
      .eq("product_key", productKey).eq("active", true)
      .order("year", { ascending: false }).then(({ data }) => {
        const all = (data || []) as Exam[];
        const keep = Array.from(new Set(all.map((e) => e.year))).slice(0, 5);
        const list = all.filter((e) => keep.includes(e.year));
        setExams(list);
        setYear(list[0]?.year ?? null);
        setExamId(list[0]?.id ?? "");
      });
  }, [productKey]);

  useEffect(() => {
    if (!examId) { setSubjects([]); return; }
    supabase.from("real_exam_questions").select("subject").eq("exam_id", examId).then(({ data }) =>
      setSubjects(Array.from(new Set((data || []).map((d: any) => d.subject).filter(Boolean))).sort()));
    setSubject(""); setPage(0);
  }, [examId]);

  useEffect(() => {
    if (!examId) { setQuestions([]); return; }
    let q = supabase.from("real_exam_questions").select("id, number, subject, statement, image_url, options, correct, explanation")
      .eq("exam_id", examId).order("number").range(page * PAGE, page * PAGE + PAGE);
    if (subject) q = q.eq("subject", subject);
    q.then(({ data }) => {
      const rows = (data || []) as any[];
      setHasMore(rows.length > PAGE);
      setQuestions(rows.slice(0, PAGE));
    });
  }, [examId, subject, page]);

  const years = Array.from(new Set(exams.map((e) => e.year)));
  const exam = exams.find((e) => e.id === examId);
  const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <section id="provas-reais" className="px-4 py-8 md:px-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-xl font-bold">Provas reais de {productName} (últimos 5 anos)</h2>
        {exams.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">As provas reais de {productName} estão sendo cadastradas e aparecerão aqui em breve.</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-3">
              <select className={sel} value={year ?? ""} onChange={(e) => { const y = Number(e.target.value); setYear(y); setExamId(exams.find((x) => x.year === y)?.id || ""); }}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select className={sel} value={examId} onChange={(e) => setExamId(e.target.value)}>
                {exams.filter((e) => e.year === year).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              {subjects.length > 0 && (
                <select className={sel} value={subject} onChange={(e) => { setSubject(e.target.value); setPage(0); }}>
                  <option value="">Todas as disciplinas</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {exam?.pdf_url && (
                <Button asChild variant="outline"><a href={exam.pdf_url} target="_blank" rel="noreferrer"><FileDown className="mr-2 h-4 w-4" />Caderno oficial (PDF)</a></Button>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {questions.length === 0 && <p className="text-sm text-muted-foreground">As questões desta prova ainda não foram cadastradas.</p>}
              {questions.map((q) => {
                const picked = answers[q.id];
                return (
                  <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium text-primary">Questão {q.number}{q.subject ? ` · ${q.subject}` : ""}</p>
                    <p className="mt-2 whitespace-pre-line text-sm">{q.statement}</p>
                    {q.image_url && <img src={q.image_url} alt={`Figura da questão ${q.number}`} loading="lazy" className="mt-3 max-h-80 rounded-md" />}
                    <div className="mt-3 space-y-2">
                      {(q.options || []).map((o) => {
                        const isRight = picked && o.letter === q.correct;
                        const isWrong = picked === o.letter && o.letter !== q.correct;
                        return (
                          <button key={o.letter} disabled={!!picked} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.letter }))}
                            className={`flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm ${isRight ? "border-primary bg-primary/10" : isWrong ? "border-destructive bg-destructive/10" : "border-border hover:border-primary/50"}`}>
                            <span className="font-bold">{o.letter})</span><span className="flex-1">{o.text}</span>
                            {isRight && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            {isWrong && <XCircle className="h-4 w-4 text-destructive" />}
                          </button>
                        );
                      })}
                    </div>
                    {picked && (
                      <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                        <p className="font-medium">Gabarito oficial: {q.correct || "não informado"}</p>
                        {q.explanation && <p className="mt-1 whitespace-pre-line text-muted-foreground">{q.explanation}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {(page > 0 || hasMore) && (
              <div className="mt-4 flex justify-between">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anteriores</Button>
                <Button variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Próximas</Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
