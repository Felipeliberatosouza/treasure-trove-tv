import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Mail, Phone, RefreshCw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useReferralCredits, type ReferralInvite } from "@/hooks/useReferralCredits";
import { REFERRAL_SCOPE_LABELS } from "@/hooks/useCashback";

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  sent: { label: "Enviado — ainda não acessou", variant: "outline" },
  visited: { label: "Acessou o link", variant: "secondary" },
  rewarded: { label: "Premiado", variant: "default" },
  expired: { label: "Expirado", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Detalhe dos créditos gratuitos ganhos por indicação e acompanhamento dos convites. */
const FreeCreditsPanel = () => {
  const { rows, aiCredits, invites, loading, reload, totalRemaining } = useReferralCredits();
  const [editing, setEditing] = useState<ReferralInvite | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const openEdit = (inv: ReferralInvite) => {
    setEditing(inv);
    setEmail(inv.contact_email ?? "");
    setPhone(inv.contact_phone ? maskPhone(inv.contact_phone) : "");
  };

  const resend = async (inv: ReferralInvite, channel: "email" | "whatsapp" | "sms") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("referral-invite", {
      body: {
        action: "resend",
        inviteId: inv.id,
        channel,
        email: email || inv.contact_email || "",
        phone: (phone || inv.contact_phone || "").replace(/\D/g, ""),
        origin: window.location.origin,
      },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "Não foi possível reenviar o convite.");
      return;
    }
    toast.success("Convite reenviado!");
    setEditing(null);
    void reload();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Créditos gratuitos por indicação</h3>
          <Badge variant="secondary" className="ml-auto">
            {totalRemaining + aiCredits} disponíveis
          </Badge>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 && aiCredits === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não tem créditos gratuitos. Convide amigos e ganhe acessos.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.resource_type} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Ganhos: {r.granted} • Usados: {r.used} • {REFERRAL_SCOPE_LABELS[r.scope]}
                  </p>
                </div>
                <Badge variant={r.remaining > 0 ? "default" : "outline"}>{r.remaining} restantes</Badge>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Créditos de IA</p>
              </div>
              <Badge variant={aiCredits > 0 ? "default" : "outline"}>{aiCredits} restantes</Badge>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Send className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Amigos convidados</h3>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void reload()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => {
              const st = STATUS[inv.status] ?? STATUS.sent;
              const isEditing = editing?.id === inv.id;
              return (
                <div key={inv.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {inv.contact_email || (inv.contact_phone ? maskPhone(inv.contact_phone) : "Link compartilhado")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Enviado em {fmtDate(inv.created_at)}
                        {inv.visited_at && ` • acessou em ${fmtDate(inv.visited_at)}`}
                      </p>
                    </div>
                    <Badge variant={st.variant} className="text-[10px] shrink-0">
                      {st.label}
                    </Badge>
                  </div>

                  {inv.status !== "rewarded" && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => (isEditing ? setEditing(null) : openEdit(inv))}>
                        {isEditing ? "Cancelar" : "Editar contato e reenviar"}
                      </Button>
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-2 pt-1">
                      <div>
                        <Label className="text-xs">E-mail do amigo</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="amigo@email.com"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Celular do amigo</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(maskPhone(e.target.value))}
                          placeholder="(11) 91234-5678"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" disabled={busy || !email} onClick={() => void resend(inv, "email")}>
                          <Mail className="h-4 w-4 mr-1" /> Reenviar por e-mail
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || phone.replace(/\D/g, "").length !== 11}
                          onClick={() => void resend(inv, "whatsapp")}
                        >
                          <Phone className="h-4 w-4 mr-1" /> WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || phone.replace(/\D/g, "").length !== 11}
                          onClick={() => void resend(inv, "sms")}
                        >
                          SMS
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default FreeCreditsPanel;
