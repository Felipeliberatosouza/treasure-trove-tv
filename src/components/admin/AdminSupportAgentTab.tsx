import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Headset, Plus, Trash2, Check } from "lucide-react";

interface AgentConfig {
  enabled: boolean;
  agent_name: string;
  greeting: string;
  handoff_customer_message: string;
  handoff_whatsapp: string;
  style_notes: string;
}
interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  status: string;
  source: string;
  usage_count: number;
}
interface Conv {
  id: string;
  visitor_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  handoff_reason: string | null;
  updated_at: string;
}
interface Msg {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const EMPTY: AgentConfig = {
  enabled: true,
  agent_name: "Clara",
  greeting: "",
  handoff_customer_message: "",
  handoff_whatsapp: "",
  style_notes: "",
};

const STATUS_LABEL: Record<string, string> = {
  bot: "Com a atendente",
  waiting_human: "Aguardando equipe",
  human: "Com a equipe",
  closed: "Encerrado",
};

const AdminSupportAgentTab = () => {
  const [cfg, setCfg] = useState<AgentConfig>(EMPTY);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  const loadAll = useCallback(async () => {
    const [c, f, v] = await Promise.all([
      supabase.from("platform_settings").select("value").eq("key", "support_agent").maybeSingle(),
      supabase.from("support_faqs").select("*").order("status").order("category").order("created_at"),
      supabase.from("support_conversations").select("id, visitor_name, email, phone, status, handoff_reason, updated_at").order("updated_at", { ascending: false }).limit(200),
    ]);
    if (c.data?.value) setCfg({ ...EMPTY, ...(c.data.value as Partial<AgentConfig>) });
    setFaqs((f.data as Faq[]) || []);
    setConvs((v.data as Conv[]) || []);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveCfg = async () => {
    const { error } = await supabase.from("platform_settings").upsert({ key: "support_agent", value: cfg as never }, { onConflict: "key" });
    if (error) toast.error("Não foi possível salvar.");
    else toast.success("Configurações salvas.");
  };

  const saveFaq = async (f: Faq, status?: string) => {
    if (!f.question.trim()) return toast.error("Preencha a pergunta.");
    const next = status ?? f.status;
    if (next === "active" && !f.answer.trim()) return toast.error("Escreva a resposta antes de ativar.");
    const { error } = await supabase
      .from("support_faqs")
      .update({ category: f.category, question: f.question, answer: f.answer, status: next, updated_at: new Date().toISOString() })
      .eq("id", f.id);
    if (error) return toast.error("Não foi possível salvar.");
    toast.success(next === "active" ? "Resposta publicada." : "Salvo.");
    void loadAll();
  };

  const addFaq = async () => {
    const { error } = await supabase.from("support_faqs").insert({ question: "Nova pergunta", answer: "", status: "pending", source: "admin", category: "Geral" });
    if (error) toast.error("Não foi possível criar.");
    void loadAll();
  };

  const removeFaq = async (id: string) => {
    if (!confirm("Excluir esta pergunta?")) return;
    await supabase.from("support_faqs").delete().eq("id", id);
    void loadAll();
  };

  const openConv = async (c: Conv) => {
    setSelected(c);
    const { data } = await supabase.from("support_messages").select("id, role, content, created_at").eq("conversation_id", c.id).order("created_at");
    setMsgs((data as Msg[]) || []);
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    const { data, error } = await supabase.functions.invoke("support-agent", { body: { action: "admin_reply", id: selected.id, text: reply } });
    if (error || data?.error) return toast.error(data?.error || "Não foi possível enviar.");
    setReply("");
    void openConv({ ...selected, status: "human" });
    void loadAll();
  };

  const closeConv = async () => {
    if (!selected) return;
    await supabase.from("support_conversations").update({ status: "closed" }).eq("id", selected.id);
    setSelected(null);
    void loadAll();
  };

  const upd = (id: string, patch: Partial<Faq>) => setFaqs((all) => all.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const pending = faqs.filter((f) => f.status === "pending");
  const q = search.trim().toLowerCase();
  const visible = faqs.filter((f) => f.status !== "pending" && (!q || `${f.question} ${f.answer} ${f.category}`.toLowerCase().includes(q)));
  const waiting = convs.filter((c) => c.status === "waiting_human").length;

  const FaqCard = ({ f }: { f: Faq }) => (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={f.category} onChange={(e) => upd(f.id, { category: e.target.value })} className="h-8 w-44 bg-secondary" />
        <Badge variant={f.status === "active" ? "default" : f.status === "pending" ? "destructive" : "secondary"}>
          {f.status === "active" ? "Ativa" : f.status === "pending" ? "Revisar" : "Arquivada"}
        </Badge>
        {f.source === "learned" && <Badge variant="outline">Veio de atendimento real</Badge>}
        <span className="text-xs text-muted-foreground ml-auto">Usada {f.usage_count}x</span>
      </div>
      <Input value={f.question} onChange={(e) => upd(f.id, { question: e.target.value })} className="bg-secondary" placeholder="Pergunta" />
      <Textarea value={f.answer} onChange={(e) => upd(f.id, { answer: e.target.value })} rows={3} className="bg-secondary" placeholder="Resposta" />
      <div className="flex flex-wrap gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => removeFaq(f.id)}><Trash2 className="h-4 w-4 mr-1" />Excluir</Button>
        {f.status === "active" && <Button size="sm" variant="outline" onClick={() => saveFaq(f, "archived")}>Arquivar</Button>}
        {f.status !== "active" && <Button size="sm" variant="outline" onClick={() => saveFaq(f)}>Salvar rascunho</Button>}
        <Button size="sm" onClick={() => saveFaq(f, "active")}><Check className="h-4 w-4 mr-1" />{f.status === "active" ? "Salvar" : "Publicar resposta"}</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Headset className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Atendimento Virtual</h2>
      </div>
      <Tabs defaultValue={pending.length ? "pending" : "config"}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="config">Configurações</TabsTrigger>
          <TabsTrigger value="faqs">Perguntas e Respostas ({visible.length})</TabsTrigger>
          <TabsTrigger value="pending">Novas perguntas {pending.length > 0 && <Badge variant="destructive" className="ml-1">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="convs">Conversas {waiting > 0 && <Badge variant="destructive" className="ml-1">{waiting}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            <Label>Atendimento ativo ao clicar no WhatsApp do site</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Nome da atendente</Label>
              <Input value={cfg.agent_name} onChange={(e) => setCfg({ ...cfg, agent_name: e.target.value })} className="bg-secondary" />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp da equipe (recebe as transferências)</Label>
              <Input value={cfg.handoff_whatsapp} onChange={(e) => setCfg({ ...cfg, handoff_whatsapp: e.target.value })} placeholder="Vazio = WhatsApp de Dados e Contatos" className="bg-secondary" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Mensagem de apresentação</Label>
            <Textarea value={cfg.greeting} onChange={(e) => setCfg({ ...cfg, greeting: e.target.value })} rows={2} className="bg-secondary" />
          </div>
          <div className="space-y-1">
            <Label>Mensagem ao cliente quando a equipe assume</Label>
            <Textarea value={cfg.handoff_customer_message} onChange={(e) => setCfg({ ...cfg, handoff_customer_message: e.target.value })} rows={2} className="bg-secondary" />
          </div>
          <div className="space-y-1">
            <Label>Jeito de falar (orientações de estilo)</Label>
            <Textarea value={cfg.style_notes} onChange={(e) => setCfg({ ...cfg, style_notes: e.target.value })} rows={2} className="bg-secondary" />
          </div>
          <p className="text-xs text-muted-foreground">
            A atendente responde só com base nas perguntas e respostas ativas. Quando não souber, quando o cliente pedir uma pessoa ou demonstrar insatisfação, a conversa passa para a equipe e o WhatsApp acima recebe um aviso.
          </p>
          <Button onClick={saveCfg}>Salvar configurações</Button>
        </TabsContent>

        <TabsContent value="faqs" className="space-y-3 pt-4">
          <div className="flex gap-2">
            <Input placeholder="Buscar pergunta ou resposta..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-secondary" />
            <Button onClick={addFaq}><Plus className="h-4 w-4 mr-1" />Nova</Button>
          </div>
          {visible.map((f) => <FaqCard key={f.id} f={f} />)}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">Perguntas de clientes que a atendente ainda não sabia responder. Escreva a resposta e publique para ela passar a usar.</p>
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta nova.</p>}
          {pending.map((f) => <FaqCard key={f.id} f={f} />)}
        </TabsContent>

        <TabsContent value="convs" className="pt-4">
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <div className="space-y-1 max-h-[520px] overflow-y-auto">
              {convs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>}
              {convs.map((c) => (
                <button key={c.id} onClick={() => openConv(c)} className={`w-full text-left rounded-lg border p-2 text-sm ${selected?.id === c.id ? "border-primary bg-secondary" : "border-border hover:bg-secondary"}`}>
                  <div className="font-medium truncate">{c.visitor_name || "Visitante"}</div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(c.updated_at).toLocaleString("pt-BR")}</span>
                    <Badge variant={c.status === "waiting_human" ? "destructive" : "secondary"} className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-border p-3 flex flex-col min-h-[360px]">
              {!selected ? (
                <p className="text-sm text-muted-foreground m-auto">Escolha uma conversa.</p>
              ) : (
                <>
                  <div className="text-sm mb-2">
                    <strong>{selected.visitor_name || "Visitante"}</strong> · {selected.email || "-"} · {selected.phone || "-"}
                    {selected.handoff_reason && <div className="text-xs text-muted-foreground">Motivo da transferência: {selected.handoff_reason}</div>}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[380px]">
                    {msgs.map((m) => (
                      <div key={m.id} className={`text-sm rounded-lg px-3 py-2 max-w-[85%] ${m.role === "customer" ? "bg-secondary" : m.role === "system" ? "mx-auto text-xs text-muted-foreground" : "ml-auto bg-primary text-primary-foreground"}`}>
                        {m.role === "agent" && <div className="text-[10px] opacity-70">{cfg.agent_name}</div>}
                        {m.role === "human" && <div className="text-[10px] opacity-70">Equipe</div>}
                        {m.content}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Responder como equipe (a atendente para de responder nesta conversa)" className="bg-secondary" />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" onClick={sendReply}>Enviar</Button>
                      <Button size="sm" variant="outline" onClick={closeConv}>Encerrar</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSupportAgentTab;
