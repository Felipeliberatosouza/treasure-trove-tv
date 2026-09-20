import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle, XCircle, HelpCircle, Clock, Eye, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DoubtThreadDialog from "@/components/doubts/DoubtThreadDialog";
import AdminBlockedDoubtMessages from "@/components/admin/AdminBlockedDoubtMessages";

interface Doubt {
  id: string;
  student_id: string;
  teacher_id: string | null;
  content_id: string;
  content_type: string;
  question: string;
  status: string;
  answer: string | null;
  created_at: string;
  approved_at: string | null;
  answered_at: string | null;
  student_name?: string;
  teacher_name?: string;
  content_title?: string;
}

const AdminDoubtsTab = () => {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending_approval");
  const { toast } = useToast();
  const { data: deadlineData, update: updateDeadline } = usePlatformSettings("doubt_response_deadline_days");
  const [deadlineDays, setDeadlineDays] = useState("3");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [viewAnswer, setViewAnswer] = useState<Doubt | null>(null);
  const [threadDoubt, setThreadDoubt] = useState<Doubt | null>(null);
  const [pendingMsgsByDoubt, setPendingMsgsByDoubt] = useState<Record<string, number>>({});

  useEffect(() => {
    if (deadlineData !== undefined && deadlineData !== null) {
      setDeadlineDays(String(deadlineData));
    }
  }, [deadlineData]);

  const fetchDoubts = async () => {
    setLoading(true);
    const { data: doubtsData } = await supabase
      .from("student_doubts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!doubtsData) { setLoading(false); return; }

    const userIds = [...new Set([...doubtsData.map(d => d.student_id), ...doubtsData.map(d => d.teacher_id)])].filter(Boolean) as string[];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));

    const lessonIds = doubtsData.filter(d => d.content_type === "lesson").map(d => d.content_id);
    const examIds = doubtsData.filter(d => d.content_type === "exam_solution").map(d => d.content_id);
    const aiIds = doubtsData.filter(d => d.content_type === "ai_content" && d.content_id).map(d => d.content_id);

    const [lessonsRes, examsRes, aiRes] = await Promise.all([
      lessonIds.length ? supabase.from("lessons").select("id, title").in("id", lessonIds) : { data: [] },
      examIds.length ? supabase.from("exam_solutions").select("id, title").in("id", examIds) : { data: [] },
      aiIds.length
        ? supabase.from("ai_canonical_contents").select("id, assunto").in("id", aiIds as string[])
        : { data: [] },
    ]);
    const titleMap = new Map([
      ...(lessonsRes.data || []).map(l => [l.id, l.title] as [string, string]),
      ...(examsRes.data || []).map(e => [e.id, e.title] as [string, string]),
      ...((aiRes.data as any[]) || []).map(a => [a.id, a.assunto] as [string, string]),
    ]);

    setDoubts(doubtsData.map(d => ({
      ...d,
      student_name: profileMap.get(d.student_id) || "Aluno",
      teacher_name: d.teacher_id
        ? profileMap.get(d.teacher_id) || "Professor"
        : "Professor Virtual (equipe Revisão Fácil)",
      content_title: titleMap.get(d.content_id) || "Conteúdo",
    })));

    // Fetch pending thread messages count per doubt
    if (doubtsData.length) {
      const { data: msgs } = await supabase
        .from("doubt_messages")
        .select("doubt_id, status")
        .in("doubt_id", doubtsData.map(d => d.id))
        .eq("status", "pending_approval");
      const map: Record<string, number> = {};
      (msgs || []).forEach((m: any) => {
        map[m.doubt_id] = (map[m.doubt_id] || 0) + 1;
      });
      setPendingMsgsByDoubt(map);
    } else {
      setPendingMsgsByDoubt({});
    }

    setLoading(false);
  };

  useEffect(() => { fetchDoubts(); }, []);

  // 1. Approve student's question → send to teacher
  const handleApproveQuestion = async (doubt: Doubt) => {
    const { error } = await supabase
      .from("student_doubts")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", doubt.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao aprovar dúvida.", variant: "destructive" });
      return;
    }

    // Email to teacher (dúvidas de conteúdo de IA não têm professor: ficam com a equipe)
    const { data: teacherProfile } = doubt.teacher_id
      ? await supabase
          .from("profiles")
          .select("email, name")
          .eq("user_id", doubt.teacher_id)
          .single()
      : { data: null };

    if (teacherProfile?.email) {
      await supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "doubt-approved",
          recipientEmail: teacherProfile.email,
          idempotencyKey: `doubt-approved-${doubt.id}`,
          templateData: {
            teacherName: teacherProfile.name || "Professor",
            question: doubt.question,
            deadlineDays: parseInt(deadlineDays) || 3,
            studentName: doubt.student_name || "Aluno",
          },
        },
      });
    }

    // Email to student (question approved)
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("user_id", doubt.student_id)
      .single();

    if (studentProfile?.email) {
      await supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "doubt-question-approved",
          recipientEmail: studentProfile.email,
          idempotencyKey: `doubt-question-approved-${doubt.id}`,
          templateData: {
            studentName: studentProfile.name || "Aluno",
            question: doubt.question,
            student_name: studentProfile.name || "Aluno",
          },
        },
      });
    }

    toast({ title: "Aprovada", description: "Dúvida aprovada. Professor e aluno foram notificados por e-mail." });
    fetchDoubts();
  };

  // 2. Approve teacher's answer → send to student
  const handleApproveAnswer = async (doubt: Doubt) => {
    const { error } = await supabase
      .from("student_doubts")
      .update({ status: "answered" })
      .eq("id", doubt.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao aprovar resposta.", variant: "destructive" });
      return;
    }

    // Email to student with the answer
    const { data: studentProfile } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("user_id", doubt.student_id)
      .single();

    const { data: teacherProfile } = doubt.teacher_id
      ? await supabase
          .from("profiles")
          .select("name")
          .eq("user_id", doubt.teacher_id)
          .single()
      : { data: null };

    if (studentProfile?.email) {
      await supabase.functions.invoke("send-app-email", {
        body: {
          templateName: "doubt-answered",
          recipientEmail: studentProfile.email,
          idempotencyKey: `doubt-answered-${doubt.id}`,
          templateData: {
            studentName: studentProfile.name || "Aluno",
            question: doubt.question,
            answer: doubt.answer || "",
            teacherName: teacherProfile?.name || "Professor",
          },
        },
      });
    }

    toast({ title: "Resposta aprovada", description: "Resposta aprovada e enviada ao aluno por e-mail." });
    fetchDoubts();
  };

  const handleReject = async (doubt: Doubt) => {
    const { error } = await supabase
      .from("student_doubts")
      .update({ status: "rejected" })
      .eq("id", doubt.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao rejeitar.", variant: "destructive" });
    } else {
      toast({ title: "Rejeitada", description: "Dúvida/resposta rejeitada." });
      fetchDoubts();
    }
  };

  const handleRejectAnswer = async (doubt: Doubt) => {
    // Send answer back to teacher for revision
    const { error } = await supabase
      .from("student_doubts")
      .update({ status: "approved", answer: null, answered_at: null })
      .eq("id", doubt.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao devolver para o professor.", variant: "destructive" });
    } else {
      toast({ title: "Devolvida", description: "Resposta devolvida ao professor para revisão." });
      fetchDoubts();
    }
  };

  const handleSaveDeadline = async () => {
    setSavingDeadline(true);
    const days = parseInt(deadlineDays) || 3;
    await updateDeadline(days);
    toast({ title: "Salvo", description: `Prazo de resposta: ${days} dias.` });
    setSavingDeadline(false);
  };

  const statusLabel: Record<string, string> = {
    pending_approval: "Dúvida Pendente",
    approved: "Aguardando Resposta",
    pending_answer_approval: "Resposta Pendente",
    answered: "Concluída",
    rejected: "Rejeitada",
  };

  const statusColor: Record<string, string> = {
    pending_approval: "border-accent/30 text-accent",
    approved: "border-blue-500/30 text-blue-500",
    pending_answer_approval: "border-orange-500/30 text-orange-500",
    answered: "border-green-500/30 text-green-500",
    rejected: "border-destructive/30 text-destructive",
  };

  const filtered = doubts.filter(d => {
    const matchSearch = d.question.toLowerCase().includes(search.toLowerCase()) ||
      (d.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.teacher_name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingQuestions = doubts.filter(d => d.status === "pending_approval").length;
  const pendingAnswers = doubts.filter(d => d.status === "pending_answer_approval").length;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" /> Aprovação de Dúvidas
      </h2>
      <div className="flex flex-wrap gap-3 mb-4">
        {pendingQuestions > 0 && (
          <p className="text-sm text-accent font-medium">{pendingQuestions} dúvida(s) de alunos aguardando aprovação</p>
        )}
        {pendingAnswers > 0 && (
          <p className="text-sm text-orange-500 font-medium">{pendingAnswers} resposta(s) de professores aguardando aprovação</p>
        )}
      </div>

      {/* Deadline config */}
      <div className="flex items-end gap-3 mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
        <div className="space-y-1">
          <Label className="text-xs">Prazo de resposta do professor (dias)</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(e.target.value)}
            className="w-20 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleSaveDeadline} disabled={savingDeadline}>
          {savingDeadline ? "Salvando..." : "Salvar Prazo"}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por dúvida, aluno ou professor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending_approval">Dúvidas Pendentes</SelectItem>
            <SelectItem value="approved">Aguardando Resposta</SelectItem>
            <SelectItem value="pending_answer_approval">Respostas Pendentes</SelectItem>
            <SelectItem value="answered">Concluídas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
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
                <TableHead>Professor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doubt) => (
                <TableRow key={doubt.id}>
                  <TableCell className="text-sm font-medium">{doubt.student_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{doubt.content_title}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{doubt.question}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{doubt.teacher_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[doubt.status] || ""}>
                      {statusLabel[doubt.status] || doubt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {/* Step 1: Approve student question */}
                      {doubt.status === "pending_approval" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-green-500 hover:text-green-400" onClick={() => handleApproveQuestion(doubt)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => handleReject(doubt)}>
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
                      {/* Step 2: Approve teacher answer */}
                      {doubt.status === "pending_answer_approval" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-blue-500" onClick={() => setViewAnswer(doubt)}>
                            <Eye className="h-4 w-4 mr-1" /> Ver Resposta
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-green-500 hover:text-green-400" onClick={() => handleApproveAnswer(doubt)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => handleRejectAnswer(doubt)}>
                            <XCircle className="h-4 w-4 mr-1" /> Devolver
                          </Button>
                        </>
                      )}
                      {doubt.status === "answered" && doubt.answer && (
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setViewAnswer(doubt)}>
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 relative"
                        onClick={() => setThreadDoubt(doubt)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" /> Conversa
                        {pendingMsgsByDoubt[doubt.id] > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] h-4 min-w-4 px-1">
                            {pendingMsgsByDoubt[doubt.id]}
                          </span>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma dúvida encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Answer Modal */}
      <Dialog open={!!viewAnswer} onOpenChange={(o) => !o && setViewAnswer(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dúvida e Resposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Dúvida do aluno ({viewAnswer?.student_name}):</p>
              <p className="text-sm bg-secondary/30 rounded-lg p-3 border border-border">{viewAnswer?.question}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Resposta do professor ({viewAnswer?.teacher_name}):</p>
              <p className="text-sm bg-primary/5 rounded-lg p-3 border border-primary/20 whitespace-pre-wrap">{viewAnswer?.answer || "Sem resposta ainda."}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DoubtThreadDialog
        role="admin"
        open={!!threadDoubt}
        doubt={threadDoubt}
        onClose={() => setThreadDoubt(null)}
        onChanged={fetchDoubts}
      />
      <AdminBlockedDoubtMessages />
    </div>
  );
};

export default AdminDoubtsTab;
