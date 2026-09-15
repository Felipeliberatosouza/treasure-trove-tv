import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, CheckCircle2, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchKitStatus, requestKit, type KitStatus } from "@/lib/revisionKit";

const STEPS = [
  "Entendendo o assunto informado",
  "Procurando conteúdos já existentes",
  "Organizando os tópicos prioritários",
  "Preparando o resumo",
  "Montando o simulado",
  "Criando o material visual",
  "Finalizando o Kit de Revisão",
];

const RevisaoIA = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [assunto, setAssunto] = useState(() => searchParams.get("assunto")?.slice(0, 500) || "");
  const [disciplina, setDisciplina] = useState("");
  const [curso, setCurso] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [examDate, setExamDate] = useState("");
  const [nivel, setNivel] = useState<"rapido" | "aprofundado">("rapido");
  const [showExtras, setShowExtras] = useState(false);

  const [status, setStatus] = useState<KitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [blocked, setBlocked] = useState<"signup_required" | "paywall" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const firstName = useMemo(() => {
    const n = (profile?.name || "").trim().split(" ")[0] || "";
    return n.length > 14 ? `${n.slice(0, 14)}…` : n;
  }, [profile?.name]);

  const refreshStatus = async () => setStatus(await fetchKitStatus());

  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, [loading]);

  const handleSubmit = async () => {
    if (submittingRef.current || assunto.trim().length < 3) return;
    submittingRef.current = true;
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
    if (data?.canonical_id) {
      navigate(`/conteudo-ia/${data.canonical_id}`);
      return;
    }
    refreshStatus();
  };

  const saldoLabel = status?.authenticated
    ? `${status.balance} ${status.balance === 1 ? "crédito de IA" : "créditos de IA"}`
    : status?.anon_free_left
      ? "1ª revisão grátis, sem cadastro"
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 px-4 pt-24 pb-16 md:px-10">
        <div className="mx-auto w-full max-w-3xl">
          {loading ? (
            <Card className="mx-auto max-w-lg">
              <CardContent className="space-y-4 p-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="font-semibold">Montando seu Kit de Revisão…</p>
                </div>
                <ul className="space-y-2">
                  {STEPS.map((s, i) => (
                    <li
                      key={s}
                      className={`flex items-center gap-2 text-sm ${i <= step ? "text-foreground" : "text-muted-foreground/50"}`}
                    >
                      {i < step ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : i === step ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border" />
                      )}
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : blocked ? (
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
          ) : (
            <div className="space-y-6 text-center">
              <Badge variant="secondary" className="mx-auto">
                <Sparkles className="mr-1 h-3 w-3" /> Kit de Revisão com IA
              </Badge>
              <h1 className="font-display text-3xl font-bold md:text-4xl">
                {firstName
                  ? `Qual o assunto da sua próxima prova, ${firstName}?`
                  : "Qual o assunto da sua próxima prova?"}
              </h1>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Em uma única geração você recebe resumo, simulado, Top Questões, colinha, slides narrados
                e um PDF para imprimir.
              </p>

              <div className="mx-auto w-full max-w-2xl space-y-3 text-left">
                <Textarea
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex.: Administração Financeira — análise de investimentos"
                  className="bg-white text-neutral-900 placeholder:text-neutral-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowExtras((v) => !v)}
                  className="text-xs text-muted-foreground underline underline-offset-4"
                >
                  {showExtras ? "Ocultar detalhes" : "Informar disciplina, curso, instituição e data da prova"}
                </button>

                {showExtras && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input placeholder="Disciplina" value={disciplina} onChange={(e) => setDisciplina(e.target.value)} />
                    <Input placeholder="Curso" value={curso} onChange={(e) => setCurso(e.target.value)} />
                    <Input placeholder="Instituição" value={instituicao} onChange={(e) => setInstituicao(e.target.value)} />
                    <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
                    <div className="sm:col-span-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={nivel === "rapido" ? "default" : "outline"}
                        onClick={() => setNivel("rapido")}
                      >
                        Revisão rápida
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={nivel === "aprofundado" ? "default" : "outline"}
                        onClick={() => setNivel("aprofundado")}
                      >
                        Revisão aprofundada
                      </Button>
                    </div>
                  </div>
                )}

                {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {saldoLabel ?? " "}
                  </span>
                  <Button onClick={handleSubmit} disabled={assunto.trim().length < 3}>
                    <Send className="mr-2 h-4 w-4" /> Gerar Kit de Revisão
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Conteúdo produzido com apoio de IA: são tópicos prioritários e questões para praticar,
                  não uma previsão da prova.{" "}
                  <Link to="/revisoes" className="underline underline-offset-4">Voltar ao catálogo</Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default RevisaoIA;
