import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LifeBuoy, Send, Clock, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  user_id: string;
  user_role: string;
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

interface UserMini {
  user_id: string;
  name: string;
  email: string;
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
  awaiting_user: "Aguardando usuário",
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

const PRIORITY_COLORS: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  alta: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  urgente: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const slaInfo = (ticket: Ticket) => {
  const due = new Date(ticket.response_due_at);
  if (ticket.first_responded_at) {
    const responded = new Date(ticket.first_responded_at);
    const onTime = responded <= due;
    return {
      label: onTime
        ? `Respondido no prazo (${format(responded, "dd/MM HH:mm", { locale: ptBR })})`
        : `Respondido fora do prazo (${format(responded, "dd/MM HH:mm", { locale: ptBR })})`,
      icon: onTime ? CheckCircle2 : AlertCircle,
      cls: onTime ? "text-green-600 dark:text-green-400" : "text-destructive",
      onTime,
    };
  }
  const now = new Date();
  if (due < now) {
    return {
      label: `Prazo vencido em ${format(due, "dd/MM/yyyy", { locale: ptBR })}`,
      icon: AlertCircle,
      cls: "text-destructive",
      onTime: false,
    };
  }
  const diffMs = due.getTime() - now.getTime();
  const diffH = Math.round(diffMs / (1000 * 60 * 60));
  return {
    label: diffH < 24 ? `Vence em ${diffH}h` : `Prazo até ${format(due, "dd/MM/yyyy", { locale: ptBR })}`,
    icon: Clock,
    cls: diffH < 24 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
    onTime: true,
  };
};

const AdminSupportTicketsTab = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<Record<string, UserMini>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentsKey, setAttachmentsKey] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar chamados");
      setLoading(false);
      return;
    }
    const list = (data || []) as Ticket[];
    setTickets(list);
    // Load users in batch
    const ids = Array.from(new Set(list.map((t) => t.user_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", ids);
      const map: Record<string, UserMini> = {};
      (profs || []).forEach((p: any) => {
        map[p.user_id] = p;
      });
      setUsers(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const loadMessages = async (ticketId: string) => {
    const { data } = await (supabase as any)
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages((data || []) as Message[]);
  };

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    await loadMessages(t.id);
    setAttachmentsKey((k) => k + 1);
  };

  const handleReply = async () => {
    if (!selected || !user || !reply.trim()) return;
    setSending(true);
    const { error } = await (supabase as any).from("support_ticket_messages").insert({
      ticket_id: selected.id,
      author_id: user.id,
      author_type: "admin",
      message: reply.trim().slice(0, 5000),
    });
    setSending(false);
    if (error) {
      toast.error("Erro ao enviar resposta");
      return;
    }
    setReply("");
    await loadMessages(selected.id);
    await load();
    // refresh selected ticket
    const updated = (await (supabase as any)
      .from("support_tickets")
      .select("*")
      .eq("id", selected.id)
      .single()).data as Ticket | null;
    if (updated) setSelected(updated);
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    const patch: Record<string, any> = { status: newStatus };
    if (newStatus === "resolved") patch.resolved_at = new Date().toISOString();
    if (newStatus === "closed") patch.closed_at = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("support_tickets")
      .update(patch)
      .eq("id", selected.id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado");
    await load();
    const updated = (await (supabase as any)
      .from("support_tickets")
      .select("*")
      .eq("id", selected.id)
      .single()).data as Ticket | null;
    if (updated) setSelected(updated);
  };

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (slaFilter !== "all") {
        const info = slaInfo(t);
        if (slaFilter === "overdue" && info.onTime) return false;
        if (slaFilter === "ontime" && !info.onTime) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, categoryFilter, slaFilter]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length;
    const overdue = tickets.filter((t) => !slaInfo(t).onTime && !t.first_responded_at).length;
    const respondedLate = tickets.filter((t) => t.first_responded_at && !slaInfo(t).onTime).length;
    const onTimeResponses = tickets.filter((t) => t.first_responded_at && slaInfo(t).onTime).length;
    return { open, overdue, respondedLate, onTimeResponses };
  }, [tickets]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <LifeBuoy className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Tickets de Atendimento</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Prazo de resposta: <strong>3 dias úteis</strong> a partir da abertura.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-bold">{stats.open}</p>
        </div>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs text-destructive">Prazo vencido</p>
          <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Respondidos no prazo</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.onTimeResponses}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Respondidos fora do prazo</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.respondedLate}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros:
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Aberto</SelectItem>
            <SelectItem value="in_progress">Em atendimento</SelectItem>
            <SelectItem value="awaiting_user">Aguardando usuário</SelectItem>
            <SelectItem value="resolved">Resolvido</SelectItem>
            <SelectItem value="closed">Encerrado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="reclamacao">Reclamações</SelectItem>
            <SelectItem value="sugestao">Sugestões</SelectItem>
            <SelectItem value="duvida">Dúvidas</SelectItem>
            <SelectItem value="problema">Problemas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={slaFilter} onValueChange={setSlaFilter}>
          <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Prazo: todos</SelectItem>
            <SelectItem value="ontime">No prazo</SelectItem>
            <SelectItem value="overdue">Fora do prazo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum chamado encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const sla = slaInfo(t);
            const Icon = sla.icon;
            const u = users[t.user_id];
            return (
              <button
                key={t.id}
                onClick={() => openTicket(t)}
                className="w-full text-left rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors p-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono text-muted-foreground">#{t.ticket_number}</span>
                      <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[t.category]}</Badge>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                        {STATUS_LABELS[t.status]}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>
                        {t.priority}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {t.user_role === "teacher" ? "Professor" : "Aluno"}
                      </span>
                    </div>
                    <p className="font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {u ? `${u.name} (${u.email})` : "Usuário"} ·{" "}
                      {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs ${sla.cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {sla.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground">#{selected.ticket_number}</span>
                  {selected.subject}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{CATEGORY_LABELS[selected.category]}</Badge>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[selected.priority]}`}>
                    Prioridade: {selected.priority}
                  </span>
                  {(() => {
                    const s = slaInfo(selected);
                    const Icon = s.icon;
                    return (
                      <span className={`flex items-center gap-1 text-xs ${s.cls}`}>
                        <Icon className="h-3.5 w-3.5" /> {s.label}
                      </span>
                    );
                  })()}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2 flex-wrap border-y py-2 -mx-6 px-6">
                <span className="text-xs text-muted-foreground">Alterar status:</span>
                {["open", "in_progress", "awaiting_user", "resolved", "closed"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={selected.status === s ? "default" : "outline"}
                    onClick={() => updateStatus(s)}
                    className="h-7 text-xs"
                  >
                    {STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 -mx-6 px-6 py-3">
                {(() => {
                  const u = users[selected.user_id];
                  return (
                    <div className="text-xs text-muted-foreground border border-dashed border-border rounded p-2">
                      <strong>De:</strong> {u ? `${u.name} (${u.email})` : selected.user_id} · {selected.user_role === "teacher" ? "Professor" : "Aluno"}
                    </div>
                  );
                })()}
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Usuário · {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
                </div>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-3 ${
                      m.author_type === "admin"
                        ? "bg-primary/10 border border-primary/20"
                        : "bg-secondary/50"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {m.author_type === "admin" ? "Administrador" : "Usuário"} ·{" "}
                      {format(new Date(m.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  </div>
                ))}
                <TicketAttachmentsList
                  ticketId={selected.id}
                  refreshKey={attachmentsKey}
                  canDelete={() => true}
                  onChanged={() => setAttachmentsKey((k) => k + 1)}
                />
              </div>

              <div className="border-t pt-3 space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Resposta ao usuário..."
                  rows={3}
                  maxLength={5000}
                />
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <TicketAttachmentUploader
                    ticketId={selected.id}
                    uploaderType="admin"
                    onUploaded={() => setAttachmentsKey((k) => k + 1)}
                  />
                  <Button onClick={handleReply} disabled={sending || !reply.trim()} className="gap-2">
                    <Send className="h-4 w-4" />
                    {sending ? "Enviando..." : "Responder"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportTicketsTab;