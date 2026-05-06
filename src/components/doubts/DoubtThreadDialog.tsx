import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, CheckCircle, XCircle, MessageSquare, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export type ThreadRole = "admin" | "teacher";

interface DoubtSummary {
  id: string;
  student_id: string;
  teacher_id: string;
  question: string;
  answer: string | null;
  status: string;
  student_name?: string;
  teacher_name?: string;
  content_title?: string;
  messages_limit?: number;
  questions_used?: number;
}

interface DoubtMessage {
  id: string;
  doubt_id: string;
  author_id: string;
  author_role: "student" | "teacher" | "admin";
  message_kind: "question" | "answer";
  body: string;
  status: "pending_approval" | "approved" | "rejected" | "answered";
  rejection_reason: string | null;
  created_at: string;
}

interface Props {
  doubt: DoubtSummary | null;
  role: ThreadRole;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const roleLabel: Record<DoubtMessage["author_role"], string> = {
  student: "Aluno",
  teacher: "Professor",
  admin: "Equipe",
};

const statusLabel: Record<DoubtMessage["status"], string> = {
  pending_approval: "Em análise",
  approved: "Aprovada",
  rejected: "Rejeitada",
  answered: "Respondida",
};

const statusTone: Record<DoubtMessage["status"], string> = {
  pending_approval: "border-orange-500/30 text-orange-500",
  approved: "border-blue-500/30 text-blue-500",
  rejected: "border-destructive/30 text-destructive",
  answered: "border-green-500/30 text-green-500",
};

const DoubtThreadDialog = ({ doubt, role, open, onClose, onChanged }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DoubtMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    if (!doubt) return;
    setLoading(true);
    const { data } = await supabase
      .from("doubt_messages")
      .select("*")
      .eq("doubt_id", doubt.id)
      .order("created_at", { ascending: true });
    setMessages((data || []) as DoubtMessage[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open && doubt) {
      setReply("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doubt?.id]);

  const lastApprovedQuestion = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((m) => m.message_kind === "question" && m.status === "approved"),
    [messages]
  );

  const teacherCanAnswer =
    role === "teacher" && !!lastApprovedQuestion &&
    !messages.some(
      (m) =>
        m.message_kind === "answer" &&
        new Date(m.created_at) > new Date(lastApprovedQuestion!.created_at)
    );

  const adminApprove = async (m: DoubtMessage) => {
    setActingId(m.id);
    const { error } = await supabase
      .from("doubt_messages")
      .update({ status: "approved" })
      .eq("id", m.id);
    setActingId(null);
    if (error) return toast.error("Erro ao aprovar mensagem.");

    // If approving an answer, mark the parent doubt as answered
    if (m.message_kind === "answer" && doubt) {
      await supabase
        .from("student_doubts")
        .update({ status: "answered", answer: m.body, answered_at: new Date().toISOString() })
        .eq("id", doubt.id);
    }
    toast.success("Mensagem aprovada.");
    load();
    onChanged?.();
  };

  const adminReject = async (m: DoubtMessage) => {
    const reason = window.prompt("Motivo da rejeição (opcional):") || null;
    setActingId(m.id);
    const { error } = await supabase
      .from("doubt_messages")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", m.id);
    setActingId(null);
    if (error) return toast.error("Erro ao rejeitar mensagem.");
    toast.success("Mensagem rejeitada.");
    load();
    onChanged?.();
  };

  const teacherAnswer = async () => {
    if (!doubt || !user) return;
    if (reply.trim().length < 5) {
      toast.error("Escreva uma resposta com pelo menos 5 caracteres.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("doubt_messages").insert({
      doubt_id: doubt.id,
      author_id: user.id,
      author_role: "teacher",
      message_kind: "answer",
      body: reply.trim(),
      status: "pending_approval",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message || "Erro ao enviar resposta.");
    toast.success("Resposta enviada para aprovação do administrador.");
    setReply("");
    load();
    onChanged?.();
  };

  if (!doubt) return null;
  const remaining =
    typeof doubt.messages_limit === "number" && typeof doubt.questions_used === "number"
      ? Math.max(0, doubt.messages_limit - doubt.questions_used)
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Conversa da dúvida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {doubt.content_title || "Conteúdo"} · {doubt.student_name || "Aluno"}
              {doubt.teacher_name ? ` ↔ ${doubt.teacher_name}` : ""}
            </p>
            <p className="mt-1 font-medium">{doubt.question}</p>
            {remaining !== null && (
              <Badge variant="secondary" className="mt-2 font-mono text-[10px]">
                Perguntas: {doubt.questions_used}/{doubt.messages_limit}
              </Badge>
            )}
          </div>

          <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma mensagem adicional ainda.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 text-sm whitespace-pre-wrap ${
                    m.author_role === "student"
                      ? "bg-secondary/40 border-border mr-8"
                      : "bg-primary/5 border-primary/20 ml-8"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {roleLabel[m.author_role]} · {m.message_kind === "question" ? "pergunta" : "resposta"}
                      <span className="text-muted-foreground/70 font-normal ml-2">
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </span>
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${statusTone[m.status]}`}>
                      {statusLabel[m.status]}
                    </Badge>
                  </div>
                  <p>{m.body}</p>
                  {m.rejection_reason && (
                    <p className="text-xs text-destructive mt-2">Motivo: {m.rejection_reason}</p>
                  )}

                  {role === "admin" && m.status === "pending_approval" && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-green-500"
                        disabled={actingId === m.id}
                        onClick={() => adminApprove(m)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive"
                        disabled={actingId === m.id}
                        onClick={() => adminReject(m)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {teacherCanAnswer && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                Responder a última pergunta aprovada:
              </p>
              <Textarea
                rows={4}
                maxLength={5000}
                placeholder="Digite sua resposta..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Sua resposta passará pela aprovação do administrador antes de ir ao aluno.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {teacherCanAnswer && (
            <Button onClick={teacherAnswer} disabled={submitting || reply.trim().length < 5}>
              <Send className="h-4 w-4 mr-1" />
              {submitting ? "Enviando..." : "Enviar resposta"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DoubtThreadDialog;