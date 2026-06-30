import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Send, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useDoubtLimits } from "@/hooks/useDoubtLimits";

interface DoubtFormProps {
  contentId?: string;
  contentType?: "lesson" | "exam_solution" | "teacher_profile";
  teacherId: string;
  title?: string;
  placeholder?: string;
}

const DoubtForm = ({ contentId, contentType, teacherId, title, placeholder }: DoubtFormProps) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { limits } = useDoubtLimits();
  // For now we only show the individual-purchase limit here. The actual
  // limit applied to a thread is captured at creation time on the server.
  const individualLimit = limits.individual_purchase;

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

    const doubtId = crypto.randomUUID();
    const { error } = await supabase.from("student_doubts").insert({
      id: doubtId,
      student_id: user.id,
      teacher_id: teacherId,
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
        await supabase.functions.invoke("send-transactional-email", {
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
        <span>
          Você pode enviar até{" "}
          <strong className="text-foreground">
            {individualLimit} pergunta{individualLimit === 1 ? "" : "s"}
          </strong>{" "}
          (a inicial e réplicas sobre a resposta do professor). Assinantes podem ter um limite maior
          conforme o plano contratado.
        </span>
      </div>

      {submitted ? (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center space-y-2">
          <p className="text-sm text-foreground font-medium">✅ Dúvida enviada com sucesso!</p>
          <p className="text-xs text-muted-foreground">
            Sua dúvida foi recebida e está sendo analisada. Em breve o professor irá responder.
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
        </>
      )}
    </div>
  );
};

export default DoubtForm;
