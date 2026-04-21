import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LifeBuoy, Plus, Send, Clock, CheckCircle2, AlertCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  TicketAttachmentUploader,
  TicketAttachmentsList,
} from "@/components/dashboard/TicketAttachments";

interface Ticket {
  id: string;
  ticket_number: number;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  response_due_at: string;
  first_responded_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
}

interface Message {
  id: string;
  author_type: "user" | "admin";
  message: string;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  reclamacao: "Reclamação",
  sugestao: "Sugestão",
  duvida: "Dúvida",
  problema: "Problema",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em atendimento",
  awaiting_user: "Aguardando você",
  resolved: "Resolvido",
  closed: "Encerrado",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  awaiting_user: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  closed: "bg-muted text-muted-foreground",
};

interface SupportTicketsTabProps {
  userRole: "student" | "teacher";
}

const SupportTicketsTab = ({ userRole }: SupportTicketsTabProps) => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentsKey, setAttachmentsKey] = useState(0);

  // Create form
  const [category, setCategory] = useState<string>("duvida");
  const [priority, setPriority] = useState<string>("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar seus chamados");
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadMessages = async (ticketId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar mensagens");
    } else {
      setMessages((data || []) as Message[]);
    }
    setLoadingMessages(false);
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await loadMessages(ticket.id);
    setAttachmentsKey((k) => k + 1);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!subject.trim() || !description.trim()) {
      toast.error("Preencha o assunto e a descrição");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      user_role: userRole,
      category,
      priority,
      subject: subject.trim().slice(0, 255),
      description: description.trim().slice(0, 5000),
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao abrir chamado: " + error.message);
      return;
    }
    toast.success(
      "Chamado aberto! Nosso prazo para a primeira resposta é de até 3 dias úteis."
    );
    setCreateOpen(false);
    setSubject("");
    setDescription("");
    setCategory("duvida");
    setPriority("normal");
    loadTickets();
  };

  const handleReply = async () => {
    if (!selectedTicket || !user || !reply.trim()) return;
    setSending(true);
    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: selectedTicket.id,
      author_id: user.id,
      author_type: "user",
      message: reply.trim().slice(0, 5000),
    } as any);
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar mensagem");
      return;
    }
    setReply("");
    await loadMessages(selectedTicket.id);
    loadTickets();
  };

  const dueDateInfo = (ticket: Ticket) => {
    if (ticket.first_responded_at) {
      return {
        label: `Respondido em ${format(new Date(ticket.first_responded_at), "dd/MM/yyyy", { locale: ptBR })}`,
        icon: CheckCircle2,
        cls: "text-green-600 dark:text-green-400",
      };
    }
    const due = new Date(ticket.response_due_at);
    const now = new Date();
    if (due < now) {
      return {
        label: `Prazo vencido em ${format(due, "dd/MM/yyyy", { locale: ptBR })}`,
        icon: AlertCircle,
        cls: "text-destructive",
      };
    }
    return {
      label: `Resposta até ${format(due, "dd/MM/yyyy", { locale: ptBR })}`,
      icon: Clock,
      cls: "text-amber-600 dark:text-amber-400",
    };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <LifeBuoy className="h-5 w-5 text-primary" /> Atendimento
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Registre reclamações, sugestões, dúvidas ou problemas. Respondemos em até <strong>3 dias úteis</strong>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo chamado
        </Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <LifeBuoy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Você ainda não abriu nenhum chamado. Clique em "Novo chamado" para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const due = dueDateInfo(t);
            const Icon = due.icon;
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => openTicket(t)}
                className="w-full text-left rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{t.ticket_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[t.category] || t.category}
                      </Badge>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABELS[t.status] || t.status}
                      </span>
                    </div>
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aberto em {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${due.cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {due.label}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Abrir novo chamado</DialogTitle>
            <DialogDescription>
              Sua solicitação será respondida em até 3 dias úteis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="category">Tipo</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="duvida">Dúvida</SelectItem>
                    <SelectItem value="problema">Problema</SelectItem>
                    <SelectItem value="reclamacao">Reclamação</SelectItem>
                    <SelectItem value="sugestao">Sugestão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={255}
                placeholder="Resumo do seu chamado"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                rows={6}
                placeholder="Descreva com detalhes a sua reclamação, sugestão, dúvida ou problema"
              />
              <p className="text-xs text-muted-foreground mt-1">{description.length}/5000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? "Enviando..." : "Abrir chamado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground">#{selectedTicket.ticket_number}</span>
                  {selectedTicket.subject}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[selectedTicket.category]}</Badge>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[selectedTicket.status]}`}>
                    {STATUS_LABELS[selectedTicket.status]}
                  </span>
                  <span className="text-xs">
                    {(() => {
                      const d = dueDateInfo(selectedTicket);
                      return <span className={d.cls}>{d.label}</span>;
                    })()}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-3 -mx-6 px-6 py-2">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Você · {format(new Date(selectedTicket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                {loadingMessages ? (
                  <p className="text-xs text-muted-foreground text-center">Carregando mensagens...</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg p-3 ${
                        m.author_type === "admin"
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-secondary/50"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground mb-1">
                        {m.author_type === "admin" ? "Equipe de Suporte" : "Você"} ·{" "}
                        {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                    </div>
                  ))
                )}
              </div>

              {selectedTicket.status !== "closed" && selectedTicket.status !== "resolved" && (
                <div className="border-t pt-3 space-y-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Escreva uma resposta..."
                    rows={3}
                    maxLength={5000}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleReply} disabled={sending || !reply.trim()} className="gap-2">
                      <Send className="h-4 w-4" />
                      {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportTicketsTab;