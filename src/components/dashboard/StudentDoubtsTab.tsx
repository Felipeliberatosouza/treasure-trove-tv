import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, CheckCircle, Clock, XCircle } from "lucide-react";

interface Doubt {
  id: string;
  content_id: string;
  content_type: string;
  question: string;
  status: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  content_title?: string;
  teacher_name?: string;
}

const StudentDoubtsTab = () => {
  const { user } = useAuth();
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("student_doubts")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const teacherIds = [...new Set(data.map(d => d.teacher_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name").in("user_id", teacherIds);
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
        teacher_name: profileMap.get(d.teacher_id) || "Professor",
        content_title: titleMap.get(d.content_id) || "Conteúdo",
      })));
      setLoading(false);
    };
    fetch();
  }, [user]);

  const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
    pending_approval: { label: "Em análise", icon: Clock, color: "border-accent/30 text-accent" },
    approved: { label: "Aguardando resposta", icon: Clock, color: "border-blue-500/30 text-blue-500" },
    answered: { label: "Respondida", icon: CheckCircle, color: "border-green-500/30 text-green-500" },
    rejected: { label: "Rejeitada", icon: XCircle, color: "border-destructive/30 text-destructive" },
  };

  return (
    <div>
      <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
        <HelpCircle className="h-5 w-5" /> Minhas Dúvidas
      </h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : doubts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">Você ainda não enviou nenhuma dúvida.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {doubts.map((doubt) => {
            const cfg = statusConfig[doubt.status] || statusConfig.pending_approval;
            const StatusIcon = cfg.icon;
            return (
              <div key={doubt.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{doubt.content_title} · {doubt.teacher_name}</p>
                    <p className="text-sm font-medium mt-1">{doubt.question}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${cfg.color}`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {cfg.label}
                  </Badge>
                </div>
                {doubt.status === "answered" && doubt.answer && (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 mt-2">
                    <p className="text-xs font-semibold text-primary mb-1">Resposta do professor:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{doubt.answer}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Enviada em {new Date(doubt.created_at).toLocaleDateString("pt-BR")}
                  {doubt.answered_at && ` · Respondida em ${new Date(doubt.answered_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentDoubtsTab;
