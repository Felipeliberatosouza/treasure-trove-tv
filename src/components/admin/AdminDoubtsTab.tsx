import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckCircle, XCircle, HelpCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Label } from "@/components/ui/label";

interface Doubt {
  id: string;
  student_id: string;
  teacher_id: string;
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

    // Get profiles for names
    const userIds = [...new Set([...doubtsData.map(d => d.student_id), ...doubtsData.map(d => d.teacher_id)])];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.name]));

    // Get content titles
    const lessonIds = doubtsData.filter(d => d.content_type === "lesson").map(d => d.content_id);
    const examIds = doubtsData.filter(d => d.content_type === "exam_solution").map(d => d.content_id);

    const [lessonsRes, examsRes] = await Promise.all([
      lessonIds.length ? supabase.from("lessons").select("id, title").in("id", lessonIds) : { data: [] },
      examIds.length ? supabase.from("exam_solutions").select("id, title").in("id", examIds) : { data: [] },
    ]);
    const titleMap = new Map([
      ...(lessonsRes.data || []).map(l => [l.id, l.title] as [string, string]),
      ...(examsRes.data || []).map(e => [e.id, e.title] as [string, string]),
    ]);

    setDoubts(doubtsData.map(d => ({
      ...d,
      student_name: profileMap.get(d.student_id) || "Aluno",
      teacher_name: profileMap.get(d.teacher_id) || "Professor",
      content_title: titleMap.get(d.content_id) || "Conteúdo",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchDoubts(); }, []);

  const handleApprove = async (doubt: Doubt) => {
    const { error } = await supabase
      .from("student_doubts")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", doubt.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao aprovar dúvida.", variant: "destructive" });
    } else {
      // Get teacher email
      const { data: teacherProfile } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("user_id", doubt.teacher_id)
        .single();

      if (teacherProfile?.email) {
        await supabase.functions.invoke("send-transactional-email", {
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

      toast({ title: "Aprovada", description: "Dúvida aprovada e enviada ao professor." });
      fetchDoubts();
    }
  };

  const handleReject = async (doubt: Doubt) => {
    const { error } = await supabase
      .from("student_doubts")
      .update({ status: "rejected" })
      .eq("id", doubt.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao rejeitar dúvida.", variant: "destructive" });
    } else {
      toast({ title: "Rejeitada", description: "Dúvida rejeitada." });
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
    pending_approval: "Pendente",
    approved: "Aguardando Resposta",
    answered: "Respondida",
    rejected: "Rejeitada",
  };

  const statusColor: Record<string, string> = {
    pending_approval: "border-accent/30 text-accent",
    approved: "border-blue-500/30 text-blue-500",
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

  const pendingCount = doubts.filter(d => d.status === "pending_approval").length;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-1 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" /> Aprovação de Dúvidas
      </h2>
      {pendingCount > 0 && (
        <p className="text-sm text-accent font-medium mb-4">{pendingCount} dúvida(s) aguardando aprovação</p>
      )}

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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending_approval">Pendentes</SelectItem>
            <SelectItem value="approved">Aguardando Resposta</SelectItem>
            <SelectItem value="answered">Respondidas</SelectItem>
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
                    <div className="flex items-center justify-end gap-1">
                      {doubt.status === "pending_approval" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 text-green-500 hover:text-green-400" onClick={() => handleApprove(doubt)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => handleReject(doubt)}>
                            <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                          </Button>
                        </>
                      )}
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
    </div>
  );
};

export default AdminDoubtsTab;
