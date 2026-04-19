import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HelpCircle, Send, Clock, AlertTriangle, CheckCircle, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";

type DoubtFilter = "all" | "pending" | "awaiting_approval" | "answered";

interface Doubt {
  id: string;
  student_id: string;
  content_id: string;
  content_type: string;
  question: string;
  status: string;
  answer: string | null;
  created_at: string;
  approved_at: string | null;
  answered_at: string | null;
  student_name?: string;
  content_title?: string;
}

const TeacherDoubtsTab = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = (searchParams.get("filter") as DoubtFilter) || "all";
  const [filter, setFilter] = useState<DoubtFilter>(
    ["all", "pending", "awaiting_approval", "answered"].includes(urlFilter) ? urlFilter : "all"
  );
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerModal, setAnswerModal] = useState<Doubt | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: deadlineData } = usePlatformSettings("doubt_response_deadline_days");
  const deadlineDays = typeof deadlineData === "number" ? deadlineData : 3;

  useEffect(() => {
    const f = (searchParams.get("filter") as DoubtFilter) || "all";
    if (["all", "pending", "awaiting_approval", "answered"].includes(f)) setFilter(f);
  }, [searchParams]);

  const handleFilterChange = (f: DoubtFilter) => {
    setFilter(f);
    const next = new URLSearchParams(searchParams);
    if (f === "all") next.delete("filter");
    else next.set("filter", f);
    setSearchParams(next, { replace: true });
  };

  const fetchDoubts = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("student_doubts")
      .select("*")
      .eq("teacher_id", user.id)
      .in("status", ["approved", "pending_answer_approval", "answered"])
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    const studentIds = [...new Set(data.map(d => d.student_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", studentIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));

    const lessonIds = data.filter(d => d.content_type === "lesson").map(d => d.content_id);
    const examIds = data.filter(d => d.content_type === "exam_solution").map(d => d.content_id);
    const [lessonsRes, examsRes] = await Promise.all([
      lessonIds.length ? supabase.from("lessons").select("id, title").in("id", lessonIds) : { data: [] },
      examIds.length ? supabase.from("exam_solutions").select("id, title").in("id", examIds) : { data: [] },
    ]);
    const titleMap = new Map([
      ...(lessonsRes.data || []).map(l => [l.id, l.title] as [string, string]),
      ...(examsRes.data || []).map(e => [e.id, e.title] as [string, string]),
    ]);

    setDoubts(data.map(d => ({
      ...d,
      student_name: profileMap.get(d.student_id) || "Aluno",
      content_title: titleMap.get(d.content_id) || "Conteúdo",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchDoubts(); }, [user]);

  const getDaysElapsed = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const handleAnswer = async () => {
    if (!answerModal || !answerText.trim()) return;
    setSubmitting(true);

    // Teacher submits answer → goes to pending_answer_approval (admin must approve)
    const { error } = await supabase
      .from("student_doubts")
      .update({
        answer: answerText.trim(),
        status: "pending_answer_approval",
        answered_at: new Date().toISOString(),
      })
      .eq("id", answerModal.id);

    if (error) {
      toast.error("Erro ao enviar resposta.");
    } else {
      toast.success("Resposta enviada! Aguarde a aprovação do administrador antes de ser entregue ao aluno.");
      setAnswerModal(null);
      setAnswerText("");
      fetchDoubts();
    }
    setSubmitting(false);
  };

  const pendingCount = doubts.filter(d => d.status === "approved").length;
  const pendingApprovalCount = doubts.filter(d => d.status === "pending_answer_approval").length;

  const statusConfig: Record<string, { label: string; color: string }> = {
    approved: { label: "Pendente", color: "border-blue-500/30 text-blue-500" },
    pending_answer_approval: { label: "Aguardando Aprovação", color: "border-orange-500/30 text-orange-500" },
    answered: { label: "Respondida", color: "border-green-500/30 text-green-500" },
  };

  const filteredDoubts = useMemo(() => {
    if (filter === "pending") return doubts.filter(d => d.status === "approved");
    if (filter === "awaiting_approval") return doubts.filter(d => d.status === "pending_answer_approval");
    if (filter === "answered") return doubts.filter(d => d.status === "answered");
    return doubts;
  }, [doubts, filter]);

  const filterOptions: { id: DoubtFilter; label: string; count: number }[] = [
    { id: "all", label: "Todas", count: doubts.length },
    { id: "pending", label: "Pendentes", count: pendingCount },
    { id: "awaiting_approval", label: "Aguardando Aprovação", count: pendingApprovalCount },
    { id: "answered", label: "Respondidas", count: doubts.filter(d => d.status === "answered").length },
  ];

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" /> Dúvidas de Alunos
      </h2>
      <div className="text-sm text-muted-foreground mb-4 space-y-1">
        {pendingCount > 0 && (
          <p>{pendingCount} dúvida(s) aguardando resposta. Prazo: {deadlineDays} dias.</p>
        )}
        {pendingApprovalCount > 0 && (
          <p className="text-orange-500">{pendingApprovalCount} resposta(s) aguardando aprovação do administrador.</p>
        )}
        {pendingCount === 0 && pendingApprovalCount === 0 && (
          <p>Todas as dúvidas foram respondidas.</p>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleFilterChange(opt.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors ${
              filter === opt.id
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === opt.id ? "bg-primary-foreground/20" : "bg-background"}`}>
              {opt.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Dúvida</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDoubts.map((doubt) => {
                const days = getDaysElapsed(doubt.approved_at || doubt.created_at);
                const overdue = doubt.status === "approved" && days > deadlineDays;
                const cfg = statusConfig[doubt.status] || statusConfig.approved;
                return (
                  <TableRow key={doubt.id}>
                    <TableCell className="text-sm font-medium">{doubt.student_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{doubt.content_title}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{doubt.question}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 text-sm ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {doubt.status === "answered" || doubt.status === "pending_answer_approval" ? (
                          <span>{getDaysElapsed(doubt.approved_at || doubt.created_at)} dia(s)</span>
                        ) : (
                          <span>{days}/{deadlineDays}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.color}>
                        {doubt.status === "pending_answer_approval" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {doubt.status === "answered" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {doubt.status === "approved" ? (
                        <Button size="sm" onClick={() => { setAnswerModal(doubt); setAnswerText(""); }}>
                          <Send className="h-4 w-4 mr-1" /> Responder
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => { setAnswerModal(doubt); setAnswerText(doubt.answer || ""); }}>
                          Ver Resposta
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDoubts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {filter === "all"
                      ? "Nenhuma dúvida de alunos no momento."
                      : "Nenhuma dúvida nesta categoria."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Answer Modal */}
      <Dialog open={!!answerModal} onOpenChange={(o) => !o && setAnswerModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {answerModal?.status === "answered" || answerModal?.status === "pending_answer_approval"
                ? "Resposta Enviada"
                : "Responder Dúvida"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Dúvida do aluno:</p>
              <p className="text-sm bg-secondary/30 rounded-lg p-3 border border-border">{answerModal?.question}</p>
            </div>
            {answerModal?.status === "answered" || answerModal?.status === "pending_answer_approval" ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Sua resposta:</p>
                <p className="text-sm bg-primary/5 rounded-lg p-3 border border-primary/20 whitespace-pre-wrap">{answerModal?.answer}</p>
                {answerModal?.status === "pending_answer_approval" && (
                  <p className="text-xs text-orange-500 mt-2 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Aguardando aprovação do administrador
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Sua resposta:</p>
                <Textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={5}
                  placeholder="Digite sua resposta..."
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Sua resposta será enviada para aprovação do administrador antes de ser entregue ao aluno.
                </p>
              </div>
            )}
          </div>
          {answerModal?.status === "approved" && (
            <DialogFooter>
              <Button onClick={handleAnswer} disabled={submitting || answerText.trim().length < 5}>
                <Send className="h-4 w-4 mr-1" /> {submitting ? "Enviando..." : "Enviar Resposta"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherDoubtsTab;
