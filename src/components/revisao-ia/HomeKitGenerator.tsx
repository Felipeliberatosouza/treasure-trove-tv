import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles, Send, Loader2, CheckCircle2, Lock, Plus, SlidersHorizontal,
  BookOpen, FileQuestion, ListChecks, StickyNote,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { requestKit } from "@/lib/revisionKit";

const buildSteps = (assunto: string, disciplina: string, nivel: string) => [
  `Lendo o seu pedido: "${assunto}"`,
  disciplina
    ? `Confirmando a disciplina informada: ${disciplina}`
    : "Identificando a disciplina e a área do conhecimento do assunto",
  `Definindo a profundidade do material (${nivel === "aprofundado" ? "revisão aprofundada" : "revisão rápida"})`,
  "Consultando o acervo da Revisão Fácil para reaproveitar material equivalente",
  "Separando os tópicos que mais aparecem em provas sobre esse assunto",
  "Escrevendo o resumo estruturado em seções",
  "Elaborando as questões do simulado com gabarito comentado",
  "Selecionando as Top Questões e escrevendo os comentários",
  "Condensando a colinha em tópicos de última hora",
  "Roteirizando os slides e a narração da professora virtual",
  "Preparando o PDF para download",
  "Conferindo a consistência de todo o Kit de Revisão",
  "Abrindo sua revisão",
];

const CHIPS = [
  { label: "Criar resumo", icon: BookOpen },
  { label: "Criar simulado", icon: FileQuestion },
  { label: "Top Questões", icon: ListChecks },
  { label: "Criar colinha", icon: StickyNote },
];

const HomeKitGenerator = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [assunto, setAssunto] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [curso, setCurso] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [examDate, setExamDate] = useState("");
  const [nivel, setNivel] = useState<"rapido" | "aprofundado">("rapido");
  const [showExtras, setShowExtras] = useState(false);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<"signup_required" | "paywall" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const firstName = useMemo(() => (profile?.name || "").trim().split(" ")[0] || "", [profile?.name]);

  useEffect(() => {
    if (!loading || steps.length === 0) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1600);
    return () => clearInterval(t);
  }, [loading, steps.length]);

  const handleSubmit = async () => {
    if (submittingRef.current || assunto.trim().length < 3) return;
    submittingRef.current = true;
    setSteps(buildSteps(assunto.trim(), disciplina.trim(), nivel));
    setStep(0);
    setLoading(true);
    setErrorMsg(null);
    setBlocked(null);
    const { data, error } = await requestKit({
      assunto: assunto.trim(),
      disciplina: disciplina.trim() || undefined,
      curso: curso.trim() || undefined,
      instituicao: instituicao.trim() || undefined,
      exam_date: examDate || undefined,
      nivel,
      idempotency_key: crypto.randomUUID(),
    });
    setLoading(false);
    submittingRef.current = false;
    if (error) {
      if (error.kind === "error") setErrorMsg(error.message);
      else setBlocked(error.kind);
      return;
    }
    if (data?.canonical_id) navigate(`/conteudo-ia/${data.canonical_id}`);
  };

  if (blocked) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardContent className="space-y-4 p-8">
          <Lock className="mx-auto h-8 w-8 text-primary" />
          {blocked === "signup_required" ? (
            <>
              <h2 className="text-xl font-bold">Crie sua conta para continuar</h2>
              <p className="text-sm text-muted-foreground">
                Você já usou sua revisão gratuita. Ao criar a conta você ganha 2 créditos de IA,
                sem cartão e sem assinatura.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate("/signup/student")}>Criar conta grátis</Button>
                <Button variant="outline" onClick={() => navigate("/login")}>Já tenho conta</Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Seus créditos gratuitos acabaram</h2>
              <p className="text-sm text-muted-foreground">
                Assine a Revisão Fácil para continuar gerando kits, ou escolha uma aula com professor
                e conteúdos avulsos do catálogo.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link to="/#pricing">Ver planos</Link></Button>
                <Button asChild variant="outline"><Link to="/minhas-aulas-agendadas">Aula com professor</Link></Button>
                <Button asChild variant="ghost"><Link to="/revisoes">Conteúdos avulsos</Link></Button>
              </div>
            </>
          )}
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
        <div className="rounded-2xl border border-border bg-white p-3 text-left text-foreground shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background md:p-4">
          <Textarea
            value={assunto}
            onChange={(event) => setAssunto(event.target.value)}
            placeholder="Digite o assunto, a disciplina ou os tópicos da sua prova..."
            maxLength={500}
            rows={3}
            className="ai-prompt-field min-h-[112px] resize-none border-0 px-2 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label="Assunto da próxima prova"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-1">
              <Button type="button" size="icon" variant="ghost" aria-label="Adicionar detalhes" title="Adicionar detalhes" onClick={() => setShowExtras((v) => !v)}>
                <Plus className="h-5 w-5" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowExtras((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" />
                Personalizar
              </Button>
            </div>
            <Button type="submit" size="icon" className="rounded-full" disabled={loading || assunto.trim().length < 3} aria-label="Gerar Kit de Revisão" title="Gerar Kit de Revisão">
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {showExtras && (
            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <Input placeholder="Disciplina" value={disciplina} onChange={(e) => setDisciplina(e.target.value)} />
              <Input placeholder="Curso" value={curso} onChange={(e) => setCurso(e.target.value)} />
              <Input placeholder="Instituição" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
              <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" size="sm" variant={nivel === "rapido" ? "default" : "outline"} onClick={() => setNivel("rapido")}>
                  Revisão rápida
                </Button>
                <Button type="button" size="sm" variant={nivel === "aprofundado" ? "default" : "outline"} onClick={() => setNivel("aprofundado")}>
                  Revisão aprofundada
                </Button>
              </div>
            </div>
          )}
        </div>
      </form>

      {loading && (
        <Card className="mx-auto mt-6 max-w-3xl text-left">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-semibold">Agente de IA trabalhando na sua revisão</p>
            </div>
            <ol className="space-y-2" aria-live="polite">
              {steps.slice(0, step + 1).map((s, i) => (
                <li key={s} className="flex items-start gap-2 text-sm">
                  {i < step ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                  <span className={i < step ? "text-muted-foreground" : "text-foreground"}>{s}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Você pode acompanhar aqui mesmo — assim que terminar, a revisão abre automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {errorMsg && <p className="mt-4 text-sm text-destructive">{errorMsg}</p>}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
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
