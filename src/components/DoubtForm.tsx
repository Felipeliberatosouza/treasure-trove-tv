import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Send, Mail } from "lucide-react";
import { toast } from "sonner";

interface DoubtFormProps {
  contentId: string;
  contentType: "lesson" | "exam_solution";
  teacherId: string;
}

const DoubtForm = ({ contentId, contentType, teacherId }: DoubtFormProps) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
      content_id: contentId,
      content_type: contentType,
      question: question.trim(),
    });

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
        <h3 className="text-sm font-semibold">Enviar Dúvida ao Professor</h3>
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
            placeholder="Descreva sua dúvida sobre este conteúdo..."
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
