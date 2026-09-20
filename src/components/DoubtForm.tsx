import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Send, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useDoubtLimits } from "@/hooks/useDoubtLimits";
import { useDoubtChatConfig } from "@/hooks/useDoubtChatConfig";

interface DoubtFormProps {
  contentId?: string;
  contentType?: "lesson" | "exam_solution" | "teacher_profile" | "ai_content";
  /** Ausente nos conteúdos de IA: a dúvida é aberta para os professores da área. */
  teacherId?: string | null;
  /** Áreas de curso (nomes) do conteúdo de IA, usadas para convocar professores. */
  areaNames?: string[];
  /** Assunto do material, exibido aos professores convocados. */
  subject?: string;
  title?: string;
  placeholder?: string;
}

const DoubtForm = ({
  contentId,
  contentType,
  teacherId,
  areaNames,
  subject,
  title,
  placeholder,
}: DoubtFormProps) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const { limits } = useDoubtLimits();
  const { config } = useDoubtChatConfig();
  const isAiContent = contentType === "ai_content";
  const individualLimit = isAiContent ? config.interactions_no_plan : limits.individual_purchase;

  const submitAiDoubt = async () => {
    const { data, error } = await supabase.functions.invoke("doubt-interaction", {
      body: {
        action: "create",
        contentId,
        contentType,
        areaNames: areaNames ?? [],
        subject,
        question: question.trim(),
        origin: window.location.origin,
      },
    });
    if (error) {
      toast.error("Erro ao enviar dúvida. Tente novamente.");
      return false;
    }
    if ((data as any)?.blocked) {
      setBlockedReason((data as any).reason || "Mensagem bloqueada pela moderação.");
      toast.error("Mensagem bloqueada pela moderação.");
      return false;
    }
    if ((data as any)?.error) {
      toast.error((data as any).error);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Faça login para enviar uma dúvida.");
      return;
    }
    if (!question.trim() || question.trim().length < 10) {
      toast.error("Escreva sua dúvida com pelo menos 10 caracteres.");
      return;
    }
    setSubmitting(true);
    setBlockedReason(null);

    if (isAiContent) {
      const ok = await submitAiDoubt();
      if (ok) {
        setSubmitted(true);
        setQuestion("");
      }
      setSubmitting(false);
      return;
    }

    const doubtId = crypto.randomUUID();
    const { error } = await supabase.from("student_doubts").insert({
      id: doubtId,
      student_id: user.id,
      teacher_id: teacherId ?? null,
      content_id: contentId ?? null,
      content_type: contentType ?? "teacher_profile",
      question: question.trim(),
    } as any);

    if (error) {
      toast.error("Erro ao enviar dúvida. Tente novamente.");
    } else {
      setSubmitted(true);
      setQuestion("");

      // Get student profile for email
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("user_id", user.id)
        .single();

      if (studentProfile?.email) {
        await supabase.functions.invoke("send-app-email", {
          body: {
            templateName: "doubt-sent-confirmation",
            recipientEmail: studentProfile.email,
            idempotencyKey: `doubt-sent-${doubtId}`,
            templateData: {
              studentName: studentProfile.name || "Aluno",
              question: question.trim(),
            },
          },
        });
      }
    }
    setSubmitting(false);
  };

  if (!user) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">{title ?? "Enviar Dúvida ao Professor"}</h3>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-card/60 border border-border p-2.5 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
        {isAiContent ? (
          <span>
            Sua dúvida vai para todos os professores da área e as respostas ficam num chat, com
            o histórico completo. Você pode fazer{" "}
            <strong className="text-foreground">
              {individualLimit} pergunta{individualLimit === 1 ? "" : "s"}
            </strong>{" "}
            conforme o seu plano — depois disso, é possível continuar usando Créditos de IA.
          </span>
        ) : (
          <span>
            Você pode enviar até{" "}
            <strong className="text-foreground">
              {individualLimit} pergunta{individualLimit === 1 ? "" : "s"}
            </strong>{" "}
            (a inicial e réplicas sobre a resposta do professor). Assinantes podem ter um limite maior
            conforme o plano contratado.
          </span>
        )}
      </div>

      {blockedReason && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{blockedReason} Reescreva sua mensagem sem esse conteúdo.</span>
        </div>
      )}

      {submitted ? (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center space-y-2">
          <p className="text-sm text-foreground font-medium">✅ Dúvida enviada com sucesso!</p>
          <p className="text-xs text-muted-foreground">
            {isAiContent
              ? "Os professores da área já foram avisados e podem responder no chat da sua dúvida."
              : "Sua dúvida foi recebida e está sendo analisada. Em breve o professor irá responder."}
          </p>
          <div className="flex items-center justify-center gap-1 text-xs text-primary">
            <Mail className="h-3.5 w-3.5" />
            <span>Te avisaremos por e-mail quando houver resposta.</span>
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setSubmitted(false)}>
            Enviar outra dúvida
          </Button>
        </div>
      ) : (
        <>
          <Textarea
            placeholder={placeholder ?? "Descreva sua dúvida sobre este conteúdo..."}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={2000}
            className="text-sm"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{question.length}/2000</span>
            <Button onClick={handleSubmit} disabled={submitting || question.trim().length < 10} size="sm">
              <Send className="h-4 w-4 mr-1" />
              {submitting ? "Enviando..." : "Enviar Dúvida"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Não é permitido trocar telefone, e-mail ou endereços de sites, nem usar linguagem ofensiva.
          </p>
        </>
      )}
    </div>
  );
};

export default DoubtForm;
