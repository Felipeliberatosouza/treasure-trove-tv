import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Msg {
  id: string;
  role: "customer" | "agent" | "human";
  content: string;
  created_at: string;
}

const STORE_KEY = "rf_support_conv";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: { name?: string; email?: string; phone?: string };
  whatsappHref: string;
}

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("support-agent", { body });
  if (error) throw error;
  return data as { id?: string; token?: string; status: string; agentName: string; messages: Msg[]; error?: string };
};

/** Janela de atendimento no estilo WhatsApp. */
const SupportChat = ({ open, onOpenChange, lead, whatsappHref }: Props) => {
  const [conv, setConv] = useState<{ id: string; token: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [status, setStatus] = useState("bot");
  const [agentName, setAgentName] = useState("Clara");
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inicia ou retoma a conversa
  useEffect(() => {
    if (!open || conv) return;
    (async () => {
      setError(null);
      try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
        if (saved?.id && saved?.token) {
          const d = await invoke({ action: "poll", ...saved });
          if (d.messages && d.status !== "closed") {
            setConv(saved);
            setMessages(d.messages);
            setStatus(d.status);
            setAgentName(d.agentName);
            return;
          }
        }
        setTyping(true);
        const d = await invoke({ action: "start", ...lead });
        await new Promise((r) => setTimeout(r, 1200));
        const c = { id: d.id!, token: d.token! };
        localStorage.setItem(STORE_KEY, JSON.stringify(c));
        setConv(c);
        setMessages(d.messages);
        setStatus(d.status);
        setAgentName(d.agentName);
      } catch {
        setError("Não conseguimos abrir o atendimento agora.");
      } finally {
        setTyping(false);
      }
    })();
  }, [open, conv, lead]);

  // Enquanto aguarda/atende humano, busca novas mensagens
  useEffect(() => {
    if (!open || !conv || status === "bot") return;
    const t = setInterval(async () => {
      try {
        const d = await invoke({ action: "poll", ...conv });
        setMessages(d.messages);
        setStatus(d.status);
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [open, conv, status]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (open && !typing) inputRef.current?.focus();
  }, [open, typing]);

  const send = async () => {
    const value = text.trim();
    if (!value || !conv || typing) return;
    setText("");
    setError(null);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "customer", content: value, created_at: new Date().toISOString() }]);
    const started = Date.now();
    if (status === "bot") setTyping(true);
    try {
      const d = await invoke({ action: "send", ...conv, text: value });
      // tempo de digitação natural, proporcional ao tamanho da resposta
      const last = d.messages[d.messages.length - 1];
      const wait = status === "bot" && last?.role !== "customer" ? Math.min(6000, 900 + last.content.length * 28) : 0;
      const remaining = wait - (Date.now() - started);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setMessages(d.messages);
      setStatus(d.status);
    } catch {
      setError("Sua mensagem não foi enviada. Tente novamente.");
    } finally {
      setTyping(false);
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden flex flex-col h-[80vh] max-h-[640px]">
        <div className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center font-semibold">
            {agentName.charAt(0)}
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base leading-tight">{agentName} · Revisão Fácil</DialogTitle>
            <DialogDescription className="text-xs text-primary-foreground/80">
              {typing ? "digitando..." : "online"}
            </DialogDescription>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/40 px-3 py-4 space-y-2">
          {messages.map((m) => {
            const mine = m.role === "customer";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm whitespace-pre-wrap ${
                    mine ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground"
                  }`}
                >
                  {m.content}
                  <div className={`mt-1 text-[10px] text-right ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {fmt(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-card px-3 py-2 shadow-sm flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-center text-xs text-destructive">{error}</p>}
          <div ref={endRef} />
        </div>

        {status === "waiting_human" && (
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>Prefere seguir pelo WhatsApp?</span>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
              Abrir WhatsApp
            </a>
          </div>
        )}

        <form
          className="flex items-end gap-2 border-t border-border bg-card p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Digite uma mensagem"
            rows={1}
            className="min-h-[40px] max-h-28 resize-none bg-secondary border-border"
            disabled={!conv}
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-full" disabled={!text.trim() || !conv} aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SupportChat;
