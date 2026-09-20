import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ReceiptText } from "lucide-react";

const RESOURCE_LABELS: Record<string, string> = {
  revisao: "Revisões",
  resumo: "Resumos",
  simulado: "Simulados",
  top_questoes: "Top Questões",
  colinha: "Colinhas",
  duvida: "Dúvidas",
  aula_particular: "Aula particular",
};

const INVITE_STATUS: Record<string, string> = {
  sent: "Enviado",
  visited: "Acessou",
  rewarded: "Premiado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

interface CreditRow { resource_type: string; granted: number; used: number }
interface UsageRow { id: string; resource_type: string; accessed_at: string; content_type: string | null }
interface LedgerRow { id: string; delta: number; reason: string | null; created_at: string; balance_after: number | null }
interface InviteRow {
  id: string;
  channel: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  sent_at: string | null;
  visited_at: string | null;
  rewarded_at: string | null;
}

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** Traduz o motivo técnico da movimentação para uma explicação simples. */
const describeReason = (reason: string | null, delta: number) => {
  const r = (reason || "").toLowerCase();
  if (r.startsWith("referral")) return "Crédito de IA Ganho por Indicação de amigo";
  if (r.startsWith("purchase")) return "Crédito de IA Comprado pelo aluno";
  if (r.includes("signup")) return "Crédito de IA de boas-vindas ao criar a conta";
  if (r.includes("plan")) return "Crédito de IA incluído no plano assinado";
  if (r.includes("admin")) return "Crédito de IA concedido pela equipe";
  if (r.includes("refund") || r.includes("estorno")) return "Devolução de Crédito de IA por material não entregue";
  if (r.includes("expire")) return "Crédito de IA vencido";
  if (delta < 0) return "Crédito de IA usado para criar material de estudo";
  return "Crédito de IA adicionado à conta";
};

/** Extrato completo dos créditos gratuitos de um usuário. */
const CreditStatementDialog = ({
  user,
  onClose,
}: {
  user: { user_id: string; name: string } | null;
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [aiBalance, setAiBalance] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [creditsRes, aiRes, ledgerRes, usageRes, invitesRes] = await Promise.all([
        supabase.from("referral_content_credits").select("resource_type, granted, used").eq("user_id", user.user_id),
        supabase.from("ai_revision_credits").select("balance").eq("user_id", user.user_id).maybeSingle(),
        supabase
          .from("ai_revision_credit_ledger")
          .select("id, delta, reason, created_at, balance_after")
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("resource_usage")
          .select("id, resource_type, accessed_at, content_type")
          .eq("user_id", user.user_id)
          .order("accessed_at", { ascending: false })
          .limit(50),
        supabase
          .from("referral_invites")
          .select("id, channel, contact_email, contact_phone, status, sent_at, visited_at, rewarded_at")
          .eq("referrer_user_id", user.user_id)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setCredits((creditsRes.data as CreditRow[]) || []);
      setAiBalance((aiRes.data as { balance: number } | null)?.balance ?? 0);
      setLedger((ledgerRes.data as LedgerRow[]) || []);
      setUsage((usageRes.data as UsageRow[]) || []);
      setInvites((invitesRes.data as InviteRow[]) || []);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Separa os Créditos de IA recebidos por origem (indicação, compra, bônus) e os usados.
  const aiOrigin = ledger.reduce(
    (acc, l) => {
      const delta = Number(l.delta ?? 0);
      const reason = (l.reason || "").toLowerCase();
      if (delta < 0) acc.used += -delta;
      else if (reason.startsWith("referral")) acc.referral += delta;
      else if (reason.startsWith("purchase")) acc.purchased += delta;
      else acc.bonus += delta;
      return acc;
    },
    { referral: 0, purchased: 0, bonus: 0, used: 0 }
  );

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ReceiptText className="h-5 w-5" /> Extrato de Créditos de IA — {user?.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        ) : (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold">
                Créditos de IA Ganhos por Indicação (por recurso)
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recurso</TableHead>
                      <TableHead className="text-right">Ganhos</TableHead>
                      <TableHead className="text-right">Usados</TableHead>
                      <TableHead className="text-right">Restantes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credits.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Nenhum Crédito de IA concedido.</TableCell></TableRow>
                    )}
                    {credits.map((c) => (
                      <TableRow key={c.resource_type}>
                        <TableCell>{RESOURCE_LABELS[c.resource_type] || c.resource_type}</TableCell>
                        <TableCell className="text-right">{c.granted}</TableCell>
                        <TableCell className="text-right">{c.used}</TableCell>
                        <TableCell className="text-right font-medium">{Math.max(0, c.granted - c.used)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Créditos de IA por origem</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Recebidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Créditos de IA Ganhos por Indicação</TableCell>
                      <TableCell className="text-right">{aiOrigin.referral}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Créditos de IA Comprados</TableCell>
                      <TableCell className="text-right">{aiOrigin.purchased}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Créditos de IA de bônus, plano ou equipe</TableCell>
                      <TableCell className="text-right">{aiOrigin.bonus}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Créditos de IA usados</TableCell>
                      <TableCell className="text-right text-destructive">{aiOrigin.used}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Saldo atual de Créditos de IA</TableCell>
                      <TableCell className="text-right font-medium">{aiBalance}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </section>


            <section>
              <h3 className="mb-2 text-sm font-semibold">Movimentação dos Créditos de IA</h3>
              {ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem movimentações.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>O que aconteceu</TableHead>
                        <TableHead className="text-right">Créditos de IA</TableHead>
                        <TableHead className="text-right">Saldo depois</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="whitespace-nowrap text-xs">{fmt(l.created_at)}</TableCell>
                          <TableCell className="text-xs">{describeReason(l.reason, l.delta)}</TableCell>
                          <TableCell className={`text-right text-xs ${l.delta < 0 ? "text-destructive" : "text-green-500"}`}>
                            {l.delta > 0 ? `+${l.delta} recebidos` : `${Math.abs(l.delta)} usados`}
                          </TableCell>
                          <TableCell className="text-right text-xs">{l.balance_after ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Como usou os Créditos de IA (últimos acessos)</h3>
              {usage.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum acesso registrado.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Recurso</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="whitespace-nowrap text-xs">{fmt(u.accessed_at)}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary">{RESOURCE_LABELS[u.resource_type] || u.resource_type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.content_type === "ai" ? "Professor virtual (IA)" : u.content_type ? "Professor" : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Amigos indicados</h3>
              {invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma indicação enviada.</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contato</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Enviado</TableHead>
                        <TableHead>Acessou</TableHead>
                        <TableHead>Premiado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="text-xs break-all">{i.contact_email || i.contact_phone || "—"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline">{INVITE_STATUS[i.status] || i.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{fmt(i.sent_at)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{fmt(i.visited_at)}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{fmt(i.rewarded_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreditStatementDialog;
