import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURSO_OPCOES = [
  "Ensino Infantil",
  "Ensino Fundamental I",
  "Ensino Fundamental II",
  "Ensino Médio",
  "Graduação",
  "Pós-graduação Latu Sensu (Especialização)",
  "Mestrado",
  "Doutorado",
];
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, Send, Loader2, CheckCircle2, Lock, Plus, SlidersHorizontal,
  BookOpen, FileQuestion, ListChecks, StickyNote, Square,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cancelKit, requestKit } from "@/lib/revisionKit";
import InviteFriendsPanel from "@/components/referral/InviteFriendsPanel";

interface GenPhase {
  label: string;
  tasks: string[];
}

const buildPhases = (assunto: string, disciplina: string, nivel: string): GenPhase[] => [
  {
    label: "Pesquisando",
    tasks: [
      `Lendo o seu pedido: "${assunto}"`,
      disciplina
        ? `Confirmando a disciplina informada: ${disciplina}`
        : "Identificando a disciplina e a área do conhecimento do assunto",
      `Definindo a profundidade do material (${nivel === "aprofundado" ? "revisão aprofundada" : "revisão rápida"})`,
      "Consultando o acervo da Revisão Fácil sobre esse assunto",
      "Separando os tópicos que mais aparecem em provas sobre esse assunto",
    ],
  },
  {
    label: "Trabalhando",
    tasks: [
      "Escrevendo o resumo estruturado em seções",
      "Elaborando as questões do simulado com gabarito comentado",
      "Selecionando as Top Questões e escrevendo os comentários",
      "Condensando a colinha em tópicos de última hora",
      "Roteirizando os slides e a narração da professora virtual",
    ],
  },
  {
    label: "Entregando",
    tasks: [
      "Preparando o PDF para download",
      "Conferindo a consistência de todo o Kit de Revisão",
      "Abrindo sua revisão",
    ],
  },
];

/** Achata as fases em uma lista de passos com a fase de origem. */
const flattenPhases = (phases: GenPhase[]) =>
  phases.flatMap((p, pi) => p.tasks.map((t) => ({ phase: pi, label: p.label, task: t })));

const STEP_MS = 8000;
const FAST_STEP_MS = 500;
const ESTIMATED_TOTAL_MS = 180_000;

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};


/** Três pontinhos animados. */
const Dots = () => (
  <span className="inline-flex items-end gap-0.5 pb-0.5" aria-hidden="true">
    {[0, 150, 300].map((delay) => (
      <span
        key={delay}
        className="h-1 w-1 animate-bounce rounded-full bg-current"
        style={{ animationDelay: `${delay}ms` }}
      />
    ))}
  </span>
);

const CHIPS = [
  { label: "Criar resumo", icon: BookOpen },
  { label: "Criar simulado", icon: FileQuestion },
  { label: "Top Questões", icon: ListChecks },
  { label: "Criar colinha", icon: StickyNote },
];

/** Guarda o pedido em andamento para o usuário não perder o que digitou ao fazer login. */
const DRAFT_KEY = "rf_kit_draft";

interface KitDraft {
  assunto: string;
  disciplina: string;
  curso: string;
  serie: string;
  instituicao: string;
  examDate: string;
  nivel: "rapido" | "aprofundado";
}

const readDraft = (): Partial<KitDraft> => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<KitDraft>) : {};
  } catch {
    return {};
  }
};

const HomeKitGenerator = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const draft = useRef<Partial<KitDraft>>(readDraft()).current;
  const [assunto, setAssunto] = useState(draft.assunto || "");
  const [disciplina, setDisciplina] = useState(draft.disciplina || "");
  const [curso, setCurso] = useState(draft.curso || "");
  const [serie, setSerie] = useState(draft.serie || "");
  const [instituicao, setInstituicao] = useState(draft.instituicao || "");
  const [examDate, setExamDate] = useState(draft.examDate || "");
  const [nivel, setNivel] = useState<"rapido" | "aprofundado">(draft.nivel === "aprofundado" ? "aprofundado" : "rapido");
  const [showExtras, setShowExtras] = useState(
    Boolean(draft.disciplina || draft.curso || draft.serie || draft.instituicao || draft.examDate),
  );

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<ReturnType<typeof flattenPhases>>([]);
  const [fast, setFast] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [blocked, setBlocked] = useState<"signup_required" | "paywall" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatMsg, setChatMsg] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const submittingRef = useRef(false);
  const runIdRef = useRef(0);
  const pendingKeyRef = useRef<string | null>(null);
  const resultRef = useRef<{ runId: number; canonicalId?: string | null; error?: { kind: string; message?: string } } | null>(null);

  const firstName = useMemo(() => (profile?.name || "").trim().split(" ")[0] || "", [profile?.name]);

  // Mantém o pedido salvo enquanto o usuário navega (login, criar conta, planos).
  useEffect(() => {
    try {
      if (assunto.trim() || disciplina || curso || serie || instituicao || examDate) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ assunto, disciplina, curso, serie, instituicao, examDate, nivel }),
        );
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [assunto, disciplina, curso, serie, instituicao, examDate, nivel]);

  // Avança as tarefas uma a uma; acelera quando o material já está pronto.
  useEffect(() => {
    if (!loading || steps.length === 0) return;
    const interval = fast ? FAST_STEP_MS : STEP_MS;
    const t = setInterval(() => setStep((s) => {
      // Só anuncia a abertura depois que o servidor confirmar que o material está pronto.
      const lastAvailableStep = fast ? steps.length - 1 : Math.max(steps.length - 2, 0);
      return Math.min(s + 1, lastAvailableStep);
    }), interval);
    return () => clearInterval(t);
  }, [loading, steps.length, fast]);

  // Contagem regressiva para a conclusão de todo o material.
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setRemainingMs((ms) => {
      if (!fast) return Math.max(1000, ms - 1000);
      return Math.max(0, ms - 1000);
    }), 1000);
    return () => clearInterval(t);
  }, [loading, fast]);

  useEffect(() => {
    if (!loading || !fast || steps.length === 0) return;
    const left = steps.length - 1 - step;
    setRemainingMs(left * FAST_STEP_MS);
  }, [step, fast, loading, steps.length]);

  /** Conclui quando a simulação chega ao fim e o material já está pronto. */
  useEffect(() => {
    if (!loading || steps.length === 0) return;
    const res = resultRef.current;
    if (!res || res.runId !== runIdRef.current) return;
    if (step < steps.length - 1) return;
    setLoading(false);
    setRemainingMs(0);
    submittingRef.current = false;
    resultRef.current = null;
    if (res.error) {
      if (res.error.kind === "error") setErrorMsg(res.error.message ?? "Não foi possível gerar agora.");
      else setBlocked(res.error.kind as "signup_required" | "paywall");
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* armazenamento indisponível */
    }
    if (res.canonicalId) navigate(`/conteudo-ia/${res.canonicalId}`);
  }, [step, loading, steps.length, navigate, fast]);

  const handleSubmit = async (overridePrompt?: string) => {
    const pedido = (overridePrompt ?? assunto).trim();
    if (pedido.length < 3) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    submittingRef.current = true;
    resultRef.current = null;
    const flat = flattenPhases(buildPhases(pedido, disciplina.trim(), nivel));
    setSteps(flat);
    setStep(0);
    setFast(false);
    setRemainingMs(ESTIMATED_TOTAL_MS);
    setLoading(true);
    setErrorMsg(null);
    setNotice(null);
    setBlocked(null);
    const idempotencyKey = crypto.randomUUID();
    pendingKeyRef.current = idempotencyKey;
    const { data, error } = await requestKit({
      assunto: pedido,
      disciplina: disciplina.trim() || undefined,
      curso: curso.trim() || undefined,
      serie: serie.trim() || undefined,
      instituicao: instituicao.trim() || undefined,
      exam_date: examDate || undefined,
      nivel,
      idempotency_key: idempotencyKey,
    });
    // Pedido cancelado ou substituído por uma nova mensagem: ignora este resultado.
    if (runIdRef.current !== runId) return;
    if (pendingKeyRef.current === idempotencyKey) pendingKeyRef.current = null;
    resultRef.current = { runId, canonicalId: data?.canonical_id, error };
    // Material pronto: encerra a apresentação das tarefas em poucos segundos.
    setFast(true);
  };

  /** Devolve o Crédito de IA de uma geração que o aluno abandonou. */
  const abandonPendingRun = () => {
    const key = pendingKeyRef.current;
    pendingKeyRef.current = null;
    if (key) void cancelKit(key);
  };

  /** Interrompe o processamento em andamento. */
  const handleStop = () => {
    abandonPendingRun();
    runIdRef.current += 1;
    submittingRef.current = false;
    resultRef.current = null;
    setLoading(false);
    setRemainingMs(0);
    setNotice("Processamento interrompido. Ajuste o pedido e envie novamente quando quiser.");
  };


  /** Envia uma nova instrução durante o processamento: reinicia com o pedido atualizado. */
  const handleSendMessage = () => {
    const msg = chatMsg.trim();
    if (!msg) return;
    setMessages((prev) => [...prev, msg]);
    setChatMsg("");
    const novoPedido = `${assunto.trim()}\n\nAjuste solicitado: ${msg}`;
    setAssunto(novoPedido);
    abandonPendingRun();
    runIdRef.current += 1;
    submittingRef.current = false;
    void handleSubmit(novoPedido);
  };

  const blockedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!blocked) return;
    const id = window.setTimeout(() => {
      blockedRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [blocked]);



  if (blocked) {
    return (
      <Card ref={blockedRef} className="mx-auto max-w-lg scroll-mt-28 text-center">
        <CardContent className="space-y-4 p-8">
          <Lock className="mx-auto h-8 w-8 text-primary" />
          {blocked === "signup_required" ? (
            <>
              <h2 className="text-xl font-bold">Crie sua conta para continuar</h2>
              <p className="text-sm text-muted-foreground">
                Você já usou sua revisão gratuita. Ao criar a conta você ganha 2 Créditos de IA,
                sem cartão e sem assinatura.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate("/signup/student")}>Criar conta grátis</Button>
                <Button variant="outline" onClick={() => navigate("/login")}>Já tenho conta</Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Seus Créditos de IA acabaram</h2>
              <p className="text-sm text-muted-foreground">
                Compre Créditos de IA avulsos, assine um plano com Créditos de IA inclusos, ou escolha
                uma aula com professor e conteúdos avulsos do catálogo.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link to="/creditos-ia">Comprar Créditos de IA</Link></Button>
                <Button asChild variant="outline"><Link to="/#pricing">Ver planos</Link></Button>
                <Button asChild variant="ghost"><Link to="/minhas-aulas-agendadas">Aula com professor</Link></Button>
              </div>
            </>
          )}
          <InviteFriendsPanel variant="compact" eyebrow="Ganhe cashback indicando amigos" />
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="mx-auto w-full max-w-4xl text-center">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        Seu Kit de Revisão completo em poucos minutos
      </div>
      <h1 id="revision-ai-title" className="font-display text-3xl font-bold md:text-5xl">
        {firstName ? `Qual o assunto da sua próxima prova, ${firstName}?` : "Qual o assunto da sua próxima prova?"}
      </h1>

      <form
        className="mx-auto mt-10 max-w-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div
          className={`rounded-2xl border border-border bg-white p-3 text-left text-foreground shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background md:p-4 ${loading ? "opacity-90" : ""}`}
        >
          <Textarea
            value={assunto}
            onChange={(event) => setAssunto(event.target.value)}
            placeholder="Digite o assunto, a disciplina ou os tópicos da sua prova..."
            maxLength={500}
            rows={3}
            readOnly={loading}
            aria-readonly={loading}
            className={`ai-prompt-field min-h-[112px] resize-none border-0 px-2 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${loading ? "cursor-not-allowed text-muted-foreground" : ""}`}
            aria-label="Assunto da próxima prova"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!loading) void handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" disabled={loading} aria-label="Adicionar detalhes" title="Adicionar detalhes" onClick={() => setShowExtras((v) => !v)}>
                <Plus className="h-5 w-5" />
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setShowExtras((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" />
                Personalizar
              </Button>
            </div>
            <Button type="submit" size="icon" className="rounded-full" disabled={loading || assunto.trim().length < 3} aria-label="Gerar Kit de Revisão" title="Gerar Kit de Revisão">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {showExtras && (
            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <Input placeholder="Disciplina" value={disciplina} disabled={loading} onChange={(e) => setDisciplina(e.target.value)} />
              <Select value={curso} disabled={loading} onValueChange={setCurso}>
                <SelectTrigger>
                  <SelectValue placeholder="Curso" />
                </SelectTrigger>
                <SelectContent>
                  {CURSO_OPCOES.map((op) => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Série (número)"
                value={serie}
                disabled={loading}
                onChange={(e) => setSerie(e.target.value.replace(/\D/g, ""))}
              />
              <Input placeholder="Instituição" value={instituicao} disabled={loading} onChange={(e) => setInstituicao(e.target.value)} />
              <Input type="date" value={examDate} disabled={loading} onChange={(e) => setExamDate(e.target.value)} />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" size="sm" disabled={loading} variant={nivel === "rapido" ? "default" : "outline"} onClick={() => setNivel("rapido")}>
                  Revisão rápida
                </Button>
                <Button type="button" size="sm" disabled={loading} variant={nivel === "aprofundado" ? "default" : "outline"} onClick={() => setNivel("aprofundado")}>
                  Revisão aprofundada
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>

      {loading && (
        <div className="mx-auto mt-6 max-w-3xl space-y-4 text-left">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>{steps[step]?.label ?? "Pesquisando"}</span>
                  <Dots />
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
                  {remainingMs > 0 ? `Conclusão em ${formatCountdown(remainingMs)}` : "Finalizando a sua revisão…"}
                </div>
              </div>
              <ol className="space-y-2" aria-live="polite">
                {steps
                  .map((s, i) => ({ ...s, i }))
                  .filter((s) => s.phase === (steps[step]?.phase ?? 0) && s.i <= step)
                  .map((s) => (
                    <li key={s.task} className="flex items-start gap-2 text-sm">
                      {s.i < step ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                      )}
                      <span className={s.i < step ? "text-muted-foreground" : "text-foreground"}>{s.task}</span>
                    </li>
                  ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                Você pode acompanhar aqui mesmo — assim que terminar, a revisão abre automaticamente.
              </p>

            </CardContent>
          </Card>
        </div>
      )}

      {(loading || messages.length > 0) && (
        <div className="mx-auto mt-4 max-w-3xl space-y-3 text-left">
          {messages.length > 0 && (
            <ul className="space-y-2">
              {messages.map((m, i) => (
                <li key={`${m}-${i}`} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">
                  {m}
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-2xl border border-border bg-white p-3 text-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <input
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                placeholder="Mensagem para Revisão Fácil"
                aria-label="Mensagem para Revisão Fácil"
                className="w-full border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              {loading && (
                <Button type="button" size="sm" variant="outline" onClick={handleStop} title="Parar o processamento">
                  <Square className="h-4 w-4" />
                  Parar
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                className="rounded-full"
                disabled={!chatMsg.trim()}
                aria-label="Enviar mensagem"
                onClick={handleSendMessage}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 px-1 text-xs text-muted-foreground">
              Peça ajustes no que você pediu ou use “Parar” para interromper a geração.
            </p>
          </div>

          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        </div>
      )}

      {errorMsg && <p className="mt-4 text-sm text-destructive">{errorMsg}</p>}

      <div className={`mt-6 flex flex-wrap justify-center gap-2 ${loading ? "pointer-events-none opacity-50" : ""}`}>
        {CHIPS.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            className="rounded-full bg-background"
            onClick={() => setAssunto((v) => (v.trim() ? v : `${label} sobre `))}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        Conteúdo produzido com apoio de IA: são tópicos prioritários e questões para praticar,
        não uma previsão da prova.
      </p>
    </div>
  );
};

export default HomeKitGenerator;
