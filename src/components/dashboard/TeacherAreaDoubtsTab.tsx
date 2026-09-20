import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MessageSquare, Loader2, Send, ShieldAlert, Sparkles, Coins } from "lucide-react";
import { toast } from "sonner";
import { useDoubtChatConfig } from "@/hooks/useDoubtChatConfig";

interface AreaDoubt {
  id: string;
  question: string;
  subject: string | null;
  status: string;
  created_at: string;
  interactions_used: number | null;
}

interface ChatMessage {
  id: string;
  author_id: string | null;
  author_role: string;
  message_kind: string;
  body: string;
  created_at: string;
}

/**
 * Dúvidas das aulas com professor virtual (IA): abertas a todos os professores
 * da área. Vários professores respondem no mesmo histórico.
 */
const TeacherAreaDoubtsTab = () => {
  const { user } = useAuth();
  const { config } = useDoubtChatConfig();
  const [doubts, setDoubts] = useState<AreaDoubt[]>([]);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [openDoubt, setOpenDoubt] = useState<AreaDoubt | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const fetchDoubts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("student_doubts")
      .select("id, question, subject, status, created_at, interactions_used")
      .eq("audience", "area")
      .order("created_at", { ascending: false })
      .limit(100);
    setDoubts((data || []) as AreaDoubt[]);

    const { data: mine } = await supabase
      .from("doubt_messages")
      .select("doubt_id")
      .eq("author_id", user.id)
      .eq("author_role", "teacher");
    setAnsweredIds(new Set((mine || []).map((m: any) => m.doubt_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDoubts();
  }, [fetchDoubts]);

  const openChat = async (d: AreaDoubt) => {
    setOpenDoubt(d);
    setReply("");
    setLoadingChat(true);
    const { data } = await supabase
      .from("doubt_messages")
      .select("id, author_id, author_role, message_kind, body, created_at")
      .eq("doubt_id", d.id)
      .order("created_at", { ascending: true });
    const list = (data || []) as ChatMessage[];
    setMessages(list);
    const ids = [...new Set(list.filter((m) => m.author_role === "teacher" && m.author_id).map((m) => m.author_id as string))];
    if (ids.length) {
      const { data: profs } = await supabase.from("teacher_profiles_public").select("user_id, name").in("user_id", ids);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { map[p.user_id] = p.name; });
      setNames(map);
    }
    setLoadingChat(false);
  };

  const sendAnswer = async () => {
    if (!openDoubt || reply.trim().length < 5) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("doubt-interaction", {
      body: {
        action: "answer",
        doubtId: openDoubt.id,
        body: reply.trim(),
        origin: window.location.origin,
      },
    });
    setSending(false);
    if (error) return toast.error("Não foi possível enviar a resposta.");
    if ((data as any)?.blocked) {
      return toast.error(
        (data as any).reason ||
          "Mensagem bloqueada pela moderação. Não é permitido enviar contatos nem linguagem ofensiva."
      );
    }
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Resposta enviada ao aluno.");
    setReply("");
    openChat(openDoubt);
    fetchDoubts();
  };

  const pending = doubts.filter((d) => !answeredIds.has(d.id));
  const answered = doubts.filter((d) => answeredIds.has(d.id));

  const renderList = (list: AreaDoubt[], emptyText: string) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground">{emptyText}</p>
    ) : (
      <ul className="space-y-2">
        {list.map((d) => (
          <li key={d.id} className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {d.subject || "Aula com professor virtual"} ·{" "}
                {new Date(d.created_at).toLocaleDateString("pt-BR")}
              </p>
              <p className="text-sm mt-1 break-words">{d.question}</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openChat(d)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Abrir chat
            </Button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Dúvidas das aulas com professor virtual
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Dúvidas abertas aos professores da sua área. Responder soma pontos no seu RF Score
          {config.teacher_bonus_brl > 0 && (
            <>
              {" "}
              e rende bônus de R$ {config.teacher_bonus_brl.toFixed(2).replace(".", ",")} por resposta
            </>
          )}
          .
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Não envie telefone, e-mail, sites ou perfis de redes sociais, nem linguagem ofensiva.
          Mensagens assim são bloqueadas e sinalizadas à administração.
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Dúvidas abertas da minha área{" "}
              <Badge variant="secondary" className="ml-1">{pending.length}</Badge>
            </p>
            {renderList(pending, "Nenhuma dúvida aberta na sua área no momento.")}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Dúvidas que respondi <Badge variant="secondary" className="ml-1">{answered.length}</Badge>
            </p>
            {renderList(answered, "Você ainda não respondeu dúvidas desta área.")}
          </div>
        </div>
      )}

      <Dialog open={!!openDoubt} onOpenChange={(o) => !o && setOpenDoubt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Chat da dúvida
            </DialogTitle>
          </DialogHeader>

          {openDoubt && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">
                  {openDoubt.subject || "Aula com professor virtual"}
                </p>
                <p className="text-sm font-medium mt-1">{openDoubt.question}</p>
              </div>

              <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                {loadingChat ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
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
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        {m.author_role === "student"
                          ? "Aluno"
                          : `Prof. ${(m.author_id && names[m.author_id]) || ""}`.trim()}
                        <span className="font-normal ml-2">
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </span>
                      </p>
                      <p>{m.body}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Textarea
                  rows={4}
                  maxLength={5000}
                  placeholder="Escreva sua resposta ao aluno..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                {config.teacher_bonus_brl > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Coins className="h-3 w-3" /> Bônus de R${" "}
                    {config.teacher_bonus_brl.toFixed(2).replace(".", ",")} por resposta aprovada.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDoubt(null)}>Fechar</Button>
            <Button onClick={sendAnswer} disabled={sending || reply.trim().length < 5}>
              <Send className="h-4 w-4 mr-1" /> {sending ? "Enviando..." : "Enviar resposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherAreaDoubtsTab;
