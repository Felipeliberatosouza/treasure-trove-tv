import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PhoneInput, { isValidBrazilianPhone } from "@/components/PhoneInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useAllPlatformSettings } from "@/hooks/usePlatformSettings";
import SupportChat from "@/components/support/SupportChat";

const LEAD_KEY = "rf_whatsapp_lead";

interface StoredLead {
  name?: string;
  email?: string;
  phone?: string;
}

function readStoredLead(): StoredLead {
  try {
    return JSON.parse(localStorage.getItem(LEAD_KEY) || "{}") as StoredLead;
  } catch {
    return {};
  }
}

interface WhatsAppLeadLinkProps {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
  source?: string;
}

/**
 * Link de WhatsApp que, para visitantes sem login, abre um pop-up
 * pedindo nome, e-mail e celular (gerando um lead) antes de redirecionar.
 */
const WhatsAppLeadLink = ({ href, className, ariaLabel, children, source = "whatsapp" }: WhatsAppLeadLinkProps) => {
  const { user, profile } = useAuth();
  const { settings } = useAllPlatformSettings();
  const agentEnabled = ((settings as Record<string, unknown>).support_agent as { enabled?: boolean } | undefined)?.enabled !== false;
  const [chatOpen, setChatOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const stored = readStoredLead();
    setName((prev) => prev || stored.name || "");
    setEmail((prev) => prev || stored.email || "");
    setPhone((prev) => prev || stored.phone || "");
    // Preenche automaticamente o celular a partir do contato do próprio aparelho,
    // quando o navegador oferece o seletor de contatos (Android/Chrome).
    const nav = navigator as Navigator & {
      contacts?: { select: (props: string[], opts?: { multiple?: boolean }) => Promise<Array<{ tel?: string[] }>> };
    };
    if (!stored.phone && nav.contacts?.select) {
      nav.contacts
        .select(["tel"], { multiple: false })
        .then((contacts) => {
          const tel = contacts?.[0]?.tel?.[0];
          if (tel) setPhone(tel.replace(/\D/g, "").slice(-11));
        })
        .catch(() => undefined);
    }
  }, [open]);

  const openWhatsApp = () => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleClick = (e: React.MouseEvent) => {
    if (user && !agentEnabled) return; // logado sem atendimento: segue o link
    e.preventDefault();
    if (user) {
      setChatOpen(true);
      return;
    }
    const stored = readStoredLead();
    if (agentEnabled && stored.name && stored.email && stored.phone) {
      setChatOpen(true);
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    if (!isValidBrazilianPhone(phone)) {
      toast.error("Informe um celular válido com DDD.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("whatsapp_leads").insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone,
      source,
      page_url: window.location.href,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível registrar seus dados. Tente novamente.");
      return;
    }
    try {
      localStorage.setItem(LEAD_KEY, JSON.stringify({ name: name.trim(), email: email.trim(), phone }));
    } catch {
      /* ignore */
    }
    setOpen(false);
    if (agentEnabled) setChatOpen(true);
    else openWhatsApp();
  };

  return (
    <>
      <a
        href={href}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fale com a gente pelo WhatsApp</DialogTitle>
            <DialogDescription>
              Informe seus dados para iniciarmos o seu atendimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              placeholder="Nome completo *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border"
              required
            />
            <Input
              type="email"
              placeholder="E-mail *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border"
              required
            />
            <PhoneInput ref={phoneRef} value={phone} onChange={setPhone} placeholder="Celular (WhatsApp) *" required />
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Enviando..." : agentEnabled ? "Iniciar atendimento" : "Ir para o WhatsApp"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {chatOpen && (
        <SupportChat
          open={chatOpen}
          onOpenChange={setChatOpen}
          whatsappHref={href}
          lead={
            user
              ? { name: profile?.name ?? "", email: profile?.email ?? user.email ?? "", phone: profile?.phone ?? "" }
              : readStoredLead()
          }
        />
      )}
    </>
  );
};

export default WhatsAppLeadLink;
