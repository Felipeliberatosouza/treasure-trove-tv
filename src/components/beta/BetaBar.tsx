import { useEffect, useState } from "react";
import { Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBetaMode } from "@/hooks/useBetaMode";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const browserInfo = () => ({
  userAgent: navigator.userAgent,
  language: navigator.language,
  platform: (navigator as any).userAgentData?.platform ?? navigator.platform,
  screen: `${window.screen.width}x${window.screen.height}`,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  online: navigator.onLine,
  referrer: document.referrer || null,
  time: new Date().toISOString(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

const schema = z.object({
  description: z.string().trim().min(5, "Conte em poucas palavras o que aconteceu.").max(4000),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
});

/* ---------- Captura automática de erros ---------- */
const sent = new Set<string>();
let sentCount = 0;
let lastUserId: string | null = null;

async function reportAuto(kind: string, message: string, stack?: string) {
  if (!message || sentCount >= 20) return;
  // Ignora ruído conhecido de extensões / navegador
  if (/ResizeObserver loop|chrome-extension:|moz-extension:|Script error\.?$/i.test(message + (stack ?? ""))) return;
  const fingerprint = `${kind}|${message.slice(0, 200)}|${location.pathname}`;
  if (sent.has(fingerprint)) return;
  sent.add(fingerprint);
  sentCount++;
  await supabase.from("beta_bug_reports").insert({
    origin: "automatico",
    user_id: lastUserId,
    error_kind: kind,
    error_message: message.slice(0, 2000),
    stack_trace: (stack ?? "").slice(0, 12000),
    page_url: location.href.slice(0, 1000),
    fingerprint,
    browser_info: browserInfo(),
  });
}

export function reportBetaError(kind: string, err: unknown) {
  const e = err as any;
  void reportAuto(kind, String(e?.message ?? e), e?.stack);
}

function useAutoCapture(active: boolean, userId: string | null) {
  lastUserId = userId;
  useEffect(() => {
    if (!active) return;
    const onError = (ev: ErrorEvent) =>
      void reportAuto("erro_javascript", ev.message, ev.error?.stack ?? `${ev.filename}:${ev.lineno}:${ev.colno}`);
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason as any;
      void reportAuto("promessa_rejeitada", String(r?.message ?? r), r?.stack);
    };
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError(...args);
      try {
        const first = args[0] as any;
        const msg = args.map((a: any) => (a instanceof Error ? a.message : typeof a === "string" ? a : "")).join(" ").trim();
        if (msg && !/Warning:/.test(msg)) void reportAuto("console_error", msg, first instanceof Error ? first.stack : undefined);
      } catch { /* ignore */ }
    };
    const origFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await origFetch(...args);
      try {
        const url = String(args[0] instanceof Request ? args[0].url : args[0]);
        if (res.status >= 500 && !url.includes("beta_bug_reports")) {
          void reportAuto("falha_servidor", `HTTP ${res.status} em ${url.split("?")[0]}`, undefined);
        }
      } catch { /* ignore */ }
      return res;
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      console.error = origError;
      window.fetch = origFetch;
    };
  }, [active]);
}

/* ---------- Barra fixa + formulário ---------- */
export default function BetaBar() {
  const { beta, settings } = useBetaMode();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useAutoCapture(beta, user?.id ?? null);

  useEffect(() => {
    document.body.classList.toggle("beta-active", beta);
    return () => document.body.classList.remove("beta-active");
  }, [beta]);

  if (!beta) return null;

  const submit = async () => {
    const parsed = schema.safeParse({ description, email: user ? "" : email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSending(true);
    const { error } = await supabase.from("beta_bug_reports").insert({
      origin: "usuario",
      user_id: user?.id ?? null,
      reporter_name: (profile as any)?.name ?? null,
      reporter_email: user?.email ?? (email.trim() || null),
      description: parsed.data.description,
      page_url: location.href.slice(0, 1000),
      browser_info: browserInfo(),
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar agora. Tente novamente.");
      return;
    }
    toast.success("Obrigado! Seu reporte foi enviado para a equipe.");
    setDescription("");
    setOpen(false);
  };

  return (
    <>
      <div
        role="region"
        aria-label="Aviso de versão beta"
        className="fixed bottom-0 inset-x-0 z-[60] border-t border-primary/40 bg-primary text-primary-foreground shadow-lg"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2 text-center text-xs sm:text-sm">
          <span>
            Versão beta de validação da Revisão Fácil. Todos os conteúdos disponibilizados podem ser acessados gratuitamente.
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-primary-foreground px-3 py-1 font-semibold text-primary hover:opacity-90"
          >
            <Bug className="h-3.5 w-3.5" /> Reportar ERROS
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar um erro</DialogTitle>
            <DialogDescription>
              Conte rapidinho o que deu errado. A página e o seu aparelho são enviados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="beta-desc">O que aconteceu?</Label>
              <Textarea
                id="beta-desc"
                rows={4}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: cliquei em Criar Revisão e a tela ficou carregando."
              />
            </div>
            {!user && (
              <div>
                <Label htmlFor="beta-email">Seu e-mail (opcional)</Label>
                <Input id="beta-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            )}
            <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground">
              {user
                ? `Reportes válidos poderão gerar Créditos de IA (até ${settings.reward_credits} por reporte) para usar quando a Revisão Fácil estiver em funcionamento. Acompanhe em Créditos.`
                : "Entre na sua conta para que seus reportes válidos gerem Créditos de IA."}
            </p>
            <Button className="w-full" onClick={submit} disabled={sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Enviar reporte
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
