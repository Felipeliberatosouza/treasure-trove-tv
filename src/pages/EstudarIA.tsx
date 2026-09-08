import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Lock, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSubscription } from "@/hooks/useActiveSubscription";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { supabase } from "@/integrations/supabase/client";
import StudySimuladoCard, { type StudyQuestion } from "@/components/study/StudySimuladoCard";
import NarratedSlidesPlayer, { type StudySlide } from "@/components/study/NarratedSlidesPlayer";

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-agent`;

interface ResumoOutput {
  topico: string;
  resumo: string;
  pontos_chave?: string[];
}
interface QuestoesOutput {
  topico: string;
  questoes: StudyQuestion[];
}
interface SlidesOutput {
  topico: string;
  slides: StudySlide[];
}

// Extrai o output de uma parte de ferramenta, tolerando variações de formato.
function extractOutput(part: any): any {
  if (part?.output) return part.output;
  // alguns estados podem trazer o resultado em result/output
  return part?.result ?? null;
}

function MessageContent({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-3">
      {(message.parts ?? []).map((part: any, i: number) => {
        if (part.type === "text" && part.text) {
          return (
            <div key={i} className="prose prose-sm max-w-none prose-headings:my-2 prose-p:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
            </div>
          );
        }
        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          const ready = part.state === "output-available" || part.state === "result";
          const name = part.type.replace("tool-", "");
          const out = ready ? extractOutput(part) : null;
          return (
            <div key={i}>
              {name === "gerar_resumo" && out && <ResumoCard out={out as ResumoOutput} />}
              {name === "gerar_questoes" && out && (
                <StudySimuladoCard topico={(out as QuestoesOutput).topico} questoes={(out as QuestoesOutput).questoes} />
              )}
              {name === "gerar_slides_narrados" && out && (
                <NarratedSlidesPlayer topico={(out as SlidesOutput).topico} slides={(out as SlidesOutput).slides} />
              )}
              {!out && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Gerando {name}...
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ResumoCard({ out }: { out: ResumoOutput }) {
  return (
    <Card className="border-primary/20 bg-card/60 backdrop-blur">
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <BookOpen className="h-5 w-5 text-primary" />
        <CardTitle className="text-base">Resumo: {out.topico}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{out.resumo}</ReactMarkdown>
        </div>
        {out.pontos_chave?.length ? (
          <div>
            <p className="mb-1 text-sm font-semibold">Pontos-chave</p>
            <ul className="space-y-1">
              {out.pontos_chave.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const EstudarIA = () => {
  const { user } = useAuth();
  const { isActive: hasSub, loading: subLoading } = useActiveSubscription();
  const { trialRow } = useFreeTrial();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: AGENT_URL,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? "";
          return { Authorization: `Bearer ${token}` };
        },
      }),
    [],
  );

  const [input, setInput] = useState("");
  const { messages, sendMessage, status, stop } = useChat<UIMessage>({
    transport,
  });

  const allowed = hasSub || !!trialRow;
  const sending = status === "submitted" || status === "streaming";

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
            <p className="mb-4 text-muted-foreground">Faça login para usar o Estudar com IA.</p>
            <Button asChild>
              <a href="/login">Entrar</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!subLoading && !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="mb-2 text-lg font-semibold">Estudar com IA</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              O Estudar com IA está disponível para assinantes e durante o período de teste grátis.
              Assine a Revisão Fácil para gerar resumos, questões e aulas narradas com IA.
            </p>
            <Button asChild>
              <a href="/#pricing">Ver planos</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col px-4 pb-4">
      <header className="py-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" /> Estudar com IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Peça um resumo, questões frequentes de prova ou uma aula narrada sobre o tema que você precisa revisar.
        </p>
      </header>

      <ScrollArea className="flex-1 rounded-lg border bg-background/40 px-4">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
              Comece dizendo, por exemplo:{" "}
              <span className="text-foreground">
                “Vou fazer uma prova sobre Análise SWOT. Gere as perguntas mais frequentes e um vídeo explicativo.”
              </span>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/40 border"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm">{m.parts.map((p: any) => p.text ?? "").join("")}</p>
                ) : (
                  <MessageContent message={m} />
                )}
              </div>
            </div>
          ))}
          {status === "error" && (
            <p className="text-sm text-destructive">
              Ocorreu um erro na resposta. Tente novamente.
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="pt-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Descreva o que você precisa revisar..."
            rows={2}
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !sending) {
                  sendMessage({ text: input });
                  setInput("");
                }
              }
            }}
          />
          {sending ? (
            <Button variant="outline" onClick={stop} size="icon">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button
              size="icon"
              aria-label="Enviar mensagem"
              disabled={!input.trim()}
              onClick={() => {
                sendMessage({ text: input });
                setInput("");
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EstudarIA;
