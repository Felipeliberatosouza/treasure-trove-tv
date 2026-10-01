import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileDown, CheckCircle2, XCircle, Timer, Loader2 } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Exam = {
  id: string; year: number; title: string; board: string | null; phase: string | null; pdf_url: string | null;
  exam_number: string | null; applied_on: string | null; area: string | null; institution: string | null; cargo: string | null; disciplina: string | null;
};
type Question = { id: string; number: number; subject: string | null; statement: string; image_url: string | null; options: { letter: string; text: string }[]; correct: string | null; explanation: string | null };
type Filter = { key: string; label: string; optKey?: string; get: (e: Exam) => string | null; questionLevel?: boolean };

const fmtDate = (d: string | null) => (d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "");
const ENEM_AREA: Record<string, string[]> = {
  "1º dia completo": ["Linguagens", "Ciências Humanas"],
  "2º dia completo": ["Ciências da Natureza", "Matemática"],
};

const FILTERS: Record<string, Filter[]> = {
  enem: [
    { key: "area", label: "Área", optKey: "areas", get: () => null, questionLevel: true },
    { key: "ano", label: "Ano e data da prova", get: (e) => String(e.year) },
  ],
  oab: [
    { key: "exame", label: "Número do Exame e data", get: (e) => e.exam_number || e.title },
    { key: "fase", label: "Fase", optKey: "fases", get: (e) => e.phase },
  ],
  vestibulares: [
    { key: "vestibular", label: "Vestibular", optKey: "vestibulares", get: (e) => e.institution || e.board },
    { key: "ano", label: "Ano", get: (e) => String(e.year) },
    { key: "fase", label: "Fase", optKey: "fases", get: (e) => e.phase },
  ],
  concursos: [
    { key: "banca", label: "Banca", optKey: "bancas", get: (e) => e.board },
    { key: "cargo", label: "Cargo", optKey: "cargos", get: (e) => e.cargo },
    { key: "disciplina", label: "Disciplina", optKey: "disciplinas", get: (e) => e.disciplina, questionLevel: true },
    { key: "ano", label: "Ano", get: (e) => String(e.year) },
    { key: "fase", label: "Fase", optKey: "fases", get: (e) => e.phase },
  ],
};
const PAGE = 10;

export default function RealExamsSection({ productKey, productName }: { productKey: string; productName: string }) {
  const products = useProducts();
  const product = products.find((p) => p.key === productKey);
  const { user } = useAuth() as any;
  const filters = FILTERS[productKey] || [];
  const [exams, setExams] = useState<Exam[]>([]);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"" | "simulado" | "comentada">("");

  useEffect(() => {
    supabase.from("real_exams").select("id, year, title, board, phase, pdf_url, exam_number, applied_on, area, institution, cargo, disciplina")
      .eq("product_key", productKey).eq("active", true).order("year", { ascending: false })
      .then(({ data }) => {
        const all = (data || []) as Exam[];
        const keep = Array.from(new Set(all.map((e) => e.year))).slice(0, 5);
        setExams(all.filter((e) => keep.includes(e.year)));
      });
    setSel({}); setMode("");
  }, [productKey]);

  const optionsFor = (f: Filter) => {
    const fromAdmin = (f.optKey && product?.selector_options?.[f.optKey]) || [];
    const fromExams = exams.map(f.get).filter(Boolean) as string[];
    return Array.from(new Set([...fromAdmin, ...fromExams]));
  };
  const examLabel = (f: Filter, v: string) => {
    if (f.key === "ano" || f.key === "exame") {
      const e = exams.find((x) => f.get(x) === v);
      return e?.applied_on ? `${v} · prova em ${fmtDate(e.applied_on)}` : v;
    }
    return v;
  };

  const matching = exams.filter((e) => filters.every((f) => {
    const v = sel[f.key];
    if (!v) return true;
    if (f.questionLevel) return productKey === "enem" || !e.disciplina || e.disciplina === v;
    return f.get(e) === v;
  }));
  const exam = matching[0];
  const allChosen = filters.every((f) => sel[f.key]);
  const subjectsFilter: string[] | null = productKey === "enem" && sel.area
    ? ENEM_AREA[sel.area] || [sel.area]
    : productKey === "concursos" && sel.disciplina && exam && !exam.disciplina ? [sel.disciplina] : null;

  const cfg = product?.simulado_config || {};
  const optionForCfg = productKey === "enem" ? sel.area : sel.fase;
  const simCfg = { pass_percent: cfg.pass_percent, ...(cfg.default || {}), ...((optionForCfg && cfg.by_option?.[optionForCfg]) || {}) } as { duration_min?: number; has_essay?: boolean; instructions?: string; pass_percent?: number };

  const selCls = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <section id="provas-reais" className="px-4 py-8 md:px-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-xl font-bold">Provas reais de {productName} (últimos 5 anos)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Escolha as opções abaixo e depois se quer fazer o Simulado ou ver a Resolução Comentada.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {filters.map((f) => (
            <label key={f.key} className="text-xs font-medium">{f.label}
              <select className={selCls} value={sel[f.key] || ""} onChange={(e) => { setSel((s) => ({ ...s, [f.key]: e.target.value })); setMode(""); }}>
                <option value="">Selecione</option>
                {optionsFor(f).map((o) => <option key={o} value={o}>{examLabel(f, o)}</option>)}
              </select>
            </label>
          ))}
          <label className="text-xs font-medium">O que você quer fazer?
            <select className={selCls} value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="">Selecione</option>
              <option value="simulado">Simulado</option>
              <option value="comentada">Resolução Comentada</option>
            </select>
          </label>
        </div>

        {exam?.pdf_url && allChosen && (
          <Button asChild variant="outline" className="mt-4"><a href={exam.pdf_url} target="_blank" rel="noreferrer"><FileDown className="mr-2 h-4 w-4" />Caderno oficial (PDF)</a></Button>
        )}

        {mode && !allChosen && <p className="mt-6 text-sm text-muted-foreground">Preencha todas as opções acima para começar.</p>}
        {mode && allChosen && !exam && <p className="mt-6 text-sm text-muted-foreground">Esta prova ainda não foi cadastrada. Escolha outra combinação.</p>}
        {mode === "comentada" && allChosen && exam && <Commented key={exam.id + (subjectsFilter || []).join()} exam={exam} subjects={subjectsFilter} loggedIn={!!user} />}
        {mode === "simulado" && allChosen && exam && (
          <Simulado key={exam.id + (subjectsFilter || []).join()} exam={exam} subjects={subjectsFilter} cfg={simCfg} productKey={productKey} option={optionForCfg || ""} userId={user?.id} />
        )}
      </div>
    </section>
  );
}

function baseQuery(examId: string, subjects: string[] | null) {
  let q = supabase.from("real_exam_questions").select("id, number, subject, statement, image_url, options, correct, explanation").eq("exam_id", examId).order("number");
  if (subjects?.length) q = q.in("subject", subjects);
  return q;
}

function QuestionBody({ q }: { q: Question }) {
  return (
    <>
      <p className="text-xs font-medium text-primary">Questão {q.number}{q.subject ? ` · ${q.subject}` : ""}</p>
      <p className="mt-2 whitespace-pre-line text-sm">{q.statement}</p>
      {q.image_url && <img src={q.image_url} alt={`Figura da questão ${q.number}`} loading="lazy" className="mt-3 max-h-80 rounded-md" />}
    </>
  );
}

function Commented({ exam, subjects, loggedIn }: { exam: Exam; subjects: string[] | null; loggedIn: boolean }) {
  const [page, setPage] = useState(0);
  const [qs, setQs] = useState<Question[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    baseQuery(exam.id, subjects).range(page * PAGE, page * PAGE + PAGE).then(async ({ data }) => {
      const rows = (data || []) as unknown as Question[];
      setHasMore(rows.length > PAGE);
      const list = rows.slice(0, PAGE);
      setQs(list);
      const missing = list.filter((q) => !q.explanation).map((q) => q.id);
      if (!missing.length || !loggedIn) return;
      setBusy(true);
      const { data: r } = await supabase.functions.invoke("exam-tools", { body: { action: "comment", question_ids: missing } });
      setBusy(false);
      if (r?.ok) {
        const map = new Map((r.items || []).map((i: any) => [i.id, i.explanation]));
        setQs((cur) => cur.map((q) => (map.has(q.id) ? { ...q, explanation: map.get(q.id) as string } : q)));
      } else if (r?.error) toast.error(r.error);
    });
  }, [exam.id, page, subjects?.join()]);

  return (
    <div className="mt-6 space-y-4">
      {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />O Professor Virtual está preparando os comentários desta página…</p>}
      {qs.length === 0 && <p className="text-sm text-muted-foreground">As questões desta prova ainda não foram cadastradas.</p>}
      {qs.map((q) => (
        <div key={q.id} className="rounded-xl border border-border bg-card p-4">
          <QuestionBody q={q} />
          <div className="mt-3 space-y-1 text-sm">
            {(q.options || []).map((o) => (
              <p key={o.letter} className={o.letter === q.correct ? "font-semibold text-primary" : ""}><b>{o.letter})</b> {o.text}</p>
            ))}
          </div>
          <div className="mt-3 rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Resposta correta: {q.correct || "não informada"}</p>
            {q.explanation ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{q.explanation}</p>
              : <p className="mt-1 text-muted-foreground">{loggedIn ? "Comentário sendo preparado…" : "Entre na sua conta para ver o comentário explicado."}</p>}
          </div>
        </div>
      ))}
      {(page > 0 || hasMore) && (
        <div className="flex justify-between">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anteriores</Button>
          <Button variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Próximas</Button>
        </div>
      )}
    </div>
  );
}

function Simulado({ exam, subjects, cfg, productKey, option, userId }: {
  exam: Exam; subjects: string[] | null; cfg: { duration_min?: number; has_essay?: boolean; instructions?: string; pass_percent?: number }; productKey: string; option: string; userId?: string;
}) {
  const minutes = cfg.duration_min || 180;
  const [qs, setQs] = useState<Question[]>([]);
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [essay, setEssay] = useState("");
  const [tema, setTema] = useState("");
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<any>(null);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => { baseQuery(exam.id, subjects).limit(200).then(({ data }) => setQs((data || []) as unknown as Question[])); }, [exam.id]);

  useEffect(() => {
    if (!started || done) return;
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); finish(true); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [started, done]);

  const start = async () => {
    setStarted(true); setLeft(minutes * 60);
    if (userId) {
      const { data } = await supabase.from("exam_attempts").insert({ user_id: userId, exam_id: exam.id, product_key: productKey, area: option || null, duration_min: minutes, total: qs.length }).select("id").single();
      setAttemptId(data?.id || null);
    }
  };

  const score = useMemo(() => qs.filter((q) => q.correct && answers[q.id] === q.correct).length, [qs, answers]);

  const finish = async (timeout = false) => {
    setDone(true);
    if (timeout) toast.info("O tempo oficial acabou. Sua prova foi entregue.");
    if (attemptId) await supabase.from("exam_attempts").update({ answers, score, total: qs.length, finished_at: new Date().toISOString() }).eq("id", attemptId);
  };

  const gradeEssay = async () => {
    setGrading(true);
    const { data } = await supabase.functions.invoke("exam-tools", { body: { action: "grade_essay", essay_text: essay, tema, product_key: productKey, option, attempt_id: attemptId } });
    setGrading(false);
    if (data?.ok) setGrade(data.result); else toast.error(data?.error || "Não foi possível corrigir agora.");
  };

  const hh = String(Math.floor(left / 3600)).padStart(2, "0"), mm = String(Math.floor((left % 3600) / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");

  if (!started) {
    return (
      <div className="mt-6 rounded-xl border border-border bg-card p-5 text-sm">
        <p className="font-semibold">{exam.title}</p>
        <p className="mt-1 text-muted-foreground">{cfg.instructions}</p>
        <p className="mt-2">Tempo oficial: <b>{Math.floor(minutes / 60)}h{minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}</b> · {qs.length} questões na ordem da prova{cfg.has_essay ? " · com redação/discursiva corrigida por IA" : ""}.</p>
        {!userId && <p className="mt-2 text-muted-foreground">Entre na sua conta para salvar o resultado e ter a redação corrigida.</p>}
        <Button className="mt-4" disabled={!qs.length} onClick={start}><Timer className="mr-2 h-4 w-4" />Começar simulado</Button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="sticky top-20 z-20 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`flex items-center gap-2 font-mono text-lg font-bold ${left < 600 && !done ? "text-destructive" : ""}`}><Timer className="h-5 w-5" />{hh}:{mm}:{ss}</span>
          <span className="text-sm text-muted-foreground">{Object.keys(answers).length} de {qs.length} respondidas</span>
          {!done && <Button size="sm" onClick={() => { if (confirm("Entregar a prova agora?")) finish(); }}>Entregar prova</Button>}
        </div>
        <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto" aria-label="Folha de respostas">
          {qs.map((q) => {
            const a = answers[q.id];
            const cls = done ? (a && a === q.correct ? "bg-primary text-primary-foreground" : "bg-destructive/80 text-destructive-foreground") : a ? "bg-primary/20" : "bg-muted";
            return <button key={q.id} onClick={() => refs.current[q.number]?.scrollIntoView({ behavior: "smooth", block: "center" })} className={`h-7 min-w-[2.6rem] rounded px-1 text-xs ${cls}`}>{q.number}{a ? `-${a}` : ""}</button>;
          })}
        </div>
      </div>

      {done && (
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-lg font-bold">Resultado: {score} de {qs.length} acertos ({qs.length ? Math.round((score / qs.length) * 100) : 0}%)</p>
          {cfg.pass_percent && qs.length > 0 && <p className="text-sm">{(score / qs.length) * 100 >= cfg.pass_percent ? `Você atingiria a nota de corte (${cfg.pass_percent}%).` : `Ainda abaixo da nota de corte (${cfg.pass_percent}%).`}</p>}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {qs.map((q) => (
          <div key={q.id} ref={(el) => (refs.current[q.number] = el)} className="rounded-xl border border-border bg-card p-4">
            <QuestionBody q={q} />
            <div className="mt-3 space-y-2">
              {(q.options || []).map((o) => {
                const picked = answers[q.id] === o.letter;
                const right = done && o.letter === q.correct;
                const wrong = done && picked && o.letter !== q.correct;
                return (
                  <button key={o.letter} disabled={done} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.letter }))}
                    className={`flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm ${right ? "border-primary bg-primary/10" : wrong ? "border-destructive bg-destructive/10" : picked ? "border-primary" : "border-border hover:border-primary/50"}`}>
                    <span className="font-bold">{o.letter})</span><span className="flex-1">{o.text}</span>
                    {right && <CheckCircle2 className="h-4 w-4 text-primary" />}{wrong && <XCircle className="h-4 w-4 text-destructive" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {cfg.has_essay && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">Redação / questões discursivas</h3>
          <Input className="mt-2" placeholder="Tema ou enunciado da proposta (copie do caderno oficial)" value={tema} onChange={(e) => setTema(e.target.value)} />
          <Textarea className="mt-2" rows={14} placeholder="Escreva aqui seu texto" value={essay} onChange={(e) => setEssay(e.target.value)} />
          <Button className="mt-3" disabled={grading || !userId} onClick={gradeEssay}>{grading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Corrigindo…</> : "Corrigir com IA pelos critérios oficiais"}</Button>
          {grade && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-lg font-bold">Nota: {grade.nota_total} / {grade.nota_maxima}</p>
              {(grade.criterios || []).map((c: any, i: number) => (
                <div key={i} className="rounded-md bg-muted p-2"><p className="font-medium">{c.nome}: {c.nota} / {c.maximo}</p><p className="text-muted-foreground">{c.comentario}</p></div>
              ))}
              {grade.pontos_fortes?.length > 0 && <p><b>Pontos fortes:</b> {grade.pontos_fortes.join("; ")}</p>}
              {grade.melhorias?.length > 0 && <p><b>O que melhorar:</b> {grade.melhorias.join("; ")}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
