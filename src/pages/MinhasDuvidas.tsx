import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  MessageSquare,
  ShieldQuestion,
} from "lucide-react";

interface Doubt {
  id: string;
  content_id: string;
  content_type: string;
  question: string;
  status: string;
  answer: string | null;
  teacher_id: string;
  created_at: string;
  answered_at: string | null;
  messages_limit: number;
  questions_used: number;
  content_title?: string;
  teacher_name?: string;
}

interface DoubtMessage {
  id: string;
  doubt_id: string;
  author_role: "student" | "teacher" | "admin";
  message_kind: "question" | "answer";
  body: string;
  status: string;
  created_at: string;
}

const STATUS: Record<string, { label: string; tone: string; icon: typeof Clock; spin?: boolean }> = {
  pending_approval: { label: "Em análise", tone: "border-accent/30 text-accent", icon: Clock },
  approved: { label: "Aguardando resposta", tone: "border-blue-500/30 text-blue-500", icon: Clock },
  pending_answer_approval: {
    label: "Resposta em revisão",
    tone: "border-orange-500/30 text-orange-500",
    icon: Loader2,
    spin: true,
  },
  answered: { label: "Respondida", tone: "border-green-500/30 text-green-500", icon: CheckCircle },
  rejected: { label: "Rejeitada", tone: "border-destructive/30 text-destructive", icon: XCircle },
};

const MinhasDuvidas = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [messages, setMessages] = useState<Record<string, DoubtMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_doubts")
      .select("*")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false });

    const list = (data ?? []) as any[];
    const teacherIds = [...new Set(list.map((d) => d.teacher_id))];
    const lessonIds = list.filter((d) => d.content_type === "lesson").map((d) => d.content_id);
    const examIds = list.filter((d) => d.content_type === "exam_solution").map((d) => d.content_id);

    const [profilesRes, lessonsRes, examsRes, msgsRes] = await Promise.all([
      teacherIds.length
        ? supabase.from("profiles").select("user_id, name").in("user_id", teacherIds)
        : Promise.resolve({ data: [] as any[] }),
      lessonIds.length
        ? supabase.from("lessons").select("id, title").in("id", lessonIds)
        : Promise.resolve({ data: [] as any[] }),
      examIds.length
        ? supabase.from("exam_solutions").select("id, title").in("id", examIds)
        : Promise.resolve({ data: [] as any[] }),
      list.length
        ? supabase
            .from("doubt_messages")
            .select("*")
            .in(
              "doubt_id",
              list.map((d) => d.id)
            )
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.name]));
    const tMap = new Map([
      ...((lessonsRes.data || []).map((l: any) => [l.id, l.title]) as [string, string][]),
      ...((examsRes.data || []).map((e: any) => [e.id, e.title]) as [string, string][]),
    ]);

    setDoubts(
      list.map((d) => ({
        ...d,
        teacher_name: pMap.get(d.teacher_id) || "Professor",
        content_title: tMap.get(d.content_id) || "Conteúdo",
      }))
    );

    const grouped: Record<string, DoubtMessage[]> = {};
    ((msgsRes.data || []) as DoubtMessage[]).forEach((m) => {
      grouped[m.doubt_id] = grouped[m.doubt_id] || [];
      grouped[m.doubt_id].push(m);
    });
    setMessages(grouped);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Realtime: refresh when admin/teacher update doubts or new messages arrive
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`minhas-duvidas-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_doubts", filter: `student_id=eq.${user.id}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doubt_messages" },
        (payload: any) => {
          const did = (payload.new?.doubt_id || payload.old?.doubt_id) as string | undefined;
          if (did && doubts.some((d) => d.id === did)) fetchAll();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, doubts.map((d) => d.id).join(",")]);

  const handleReply = async (doubt: Doubt) => {
    const text = (reply[doubt.id] || "").trim();
    if (text.length < 10) {
      toast.error("Escreva sua nova pergunta com pelo menos 10 caracteres.");
      return;
    }
    if (doubt.questions_used >= doubt.messages_limit) {
      toast.error("Você atingiu o limite de perguntas desta dúvida.");
      return;
    }
    setSendingId(doubt.id);
    const { error } = await supabase.from("doubt_messages").insert({
      doubt_id: doubt.id,
      author_id: user.id,
      author_role: "student",
      message_kind: "question",
      body: text,
      status: "pending_approval",
    });
    setSendingId(null);
    if (error) {
      toast.error(error.message || "Não foi possível enviar a pergunta.");
      return;
    }
    toast.success("Pergunta enviada! Será analisada pela equipe.");
    setReply((r) => ({ ...r, [doubt.id]: "" }));
    fetchAll();
  };

  const empty = useMemo(() => !loading && doubts.length === 0, [loading, doubts]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12 px-6 md:px-12 lg:px-20">
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="flex items-center gap-3">
            <ShieldQuestion className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold text-gradient">Minhas Dúvidas</h1>
              <p className="text-muted-foreground text-sm md:text-base mt-1">
                Acompanhe o status e a resposta de cada dúvida enviada. Você pode fazer novas perguntas
                dentro da mesma dúvida, respeitando o limite do seu plano ou da compra individual.
              </p>
            </div>
          </header>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : empty ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">Você ainda não enviou nenhuma dúvida.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {doubts.map((d) => {
                const cfg = STATUS[d.status] || STATUS.pending_approval;
                const Icon = cfg.icon;
                const open = openId === d.id;
                const remaining = Math.max(0, d.messages_limit - d.questions_used);
                const canReply = d.status === "answered" && remaining > 0;
                const thread = messages[d.id] || [];
                return (
                  <li
                    key={d.id}
                    className="rounded-xl border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {d.content_title} · {d.teacher_name}
                        </p>
                        <p className="text-sm font-medium mt-1 break-words">{d.question}</p>
                      </div>
                      <Badge variant="outline" className={`shrink-0 ${cfg.tone}`}>
                        <Icon className={`h-3 w-3 mr-1 ${cfg.spin ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary" className="font-mono">
                        Perguntas: {d.questions_used}/{d.messages_limit}
                      </Badge>
                      <span className="text-muted-foreground">
                        Enviada em {new Date(d.created_at).toLocaleDateString("pt-BR")}
                        {d.answered_at &&
                          ` · Respondida em ${new Date(d.answered_at).toLocaleDateString("pt-BR")}`}
                      </span>
                    </div>

                    {/* Initial answer (legacy column on student_doubts) */}
                    {d.status === "answered" && d.answer && (
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                        <p className="text-xs font-semibold text-primary mb-1">
                          Resposta do professor:
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{d.answer}</p>
                      </div>
                    )}

                    {/* Thread */}
                    {(thread.length > 0 || canReply) && (
                      <div className="border-t border-border pt-3 space-y-3">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : d.id)}
                          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {open ? "Ocultar conversa" : `Ver conversa (${thread.length})`}
                        </button>

                        {open && (
                          <div className="space-y-2">
                            {thread.map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-lg p-3 text-sm whitespace-pre-wrap border ${
                                  m.author_role === "student"
                                    ? "bg-secondary/40 border-border ml-0 mr-8"
                                    : "bg-primary/5 border-primary/20 ml-8 mr-0"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    {m.author_role === "student"
                                      ? "Você"
                                      : m.author_role === "teacher"
                                      ? "Professor"
                                      : "Equipe"}{" "}
                                    · {m.message_kind === "question" ? "pergunta" : "resposta"}
                                  </span>
                                  {m.status !== "approved" && m.status !== "answered" && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${STATUS[m.status]?.tone || ""}`}
                                    >
                                      {STATUS[m.status]?.label || m.status}
                                    </Badge>
                                  )}
                                </div>
                                <p>{m.body}</p>
                              </div>
                            ))}

                            {canReply ? (
                              <div className="space-y-2 pt-2">
                                <Textarea
                                  rows={3}
                                  maxLength={2000}
                                  placeholder="Faça uma nova pergunta sobre a resposta do professor..."
                                  value={reply[d.id] || ""}
                                  onChange={(e) =>
                                    setReply((r) => ({ ...r, [d.id]: e.target.value }))
                                  }
                                />
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">
                                    Restam {remaining} pergunta{remaining === 1 ? "" : "s"} nesta
                                    dúvida.
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => handleReply(d)}
                                    disabled={
                                      sendingId === d.id ||
                                      (reply[d.id] || "").trim().length < 10
                                    }
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    {sendingId === d.id ? "Enviando..." : "Nova pergunta"}
                                  </Button>
                                </div>
                              </div>
                            ) : d.status === "answered" && remaining === 0 ? (
                              <p className="text-xs text-muted-foreground italic pt-1">
                                Você utilizou todas as {d.messages_limit} perguntas permitidas
                                desta dúvida.
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default MinhasDuvidas;
