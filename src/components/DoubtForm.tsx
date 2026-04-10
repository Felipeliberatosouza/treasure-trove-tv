import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { HelpCircle, Send } from "lucide-react";
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
    const { error } = await supabase.from("student_doubts").insert({
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
      toast.success("Dúvida enviada! O professor irá responder o mais rápido possível.");
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
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-center">
          <p className="text-sm text-foreground font-medium">✅ Dúvida enviada com sucesso!</p>
          <p className="text-xs text-muted-foreground mt-1">O professor irá responder o mais rápido possível.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setSubmitted(false)}>
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
