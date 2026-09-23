import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const fmtDateTime = (d: string | null) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  sms: "SMS",
  link: "Link",
};

interface Row {
  id: string;
  referrerName: string;
  contact: string;
  channel: string;
  sentAt: string | null;
  visitedAt: string | null;
  creditsAt: string | null;
  purchaseAt: string | null;
  purchaseAmount: number | null;
  cashbackAmount: number | null;
}

/** Visão completa das indicações de todos os usuários (convite + cashback). */
const AdminReferralsTab = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: invites }, { data: referrals }, { data: profiles }] = await Promise.all([
      supabase
        .from("referral_invites")
        .select("id, referrer_user_id, channel, contact_email, contact_phone, sent_at, visited_at, rewarded_at, visitor_user_id")
        .order("sent_at", { ascending: false })
        .limit(1000),
      supabase
        .from("cashback_referrals")
        .select("id, referrer_user_id, referred_user_id, reward_amount, first_purchase_amount, first_purchase_at, created_at")
        .limit(1000),
      supabase.from("profiles").select("user_id, name, email").limit(2000),
    ]);

    const nameOf = new Map<string, string>();
    for (const p of profiles ?? []) {
      nameOf.set(p.user_id as string, (p.name as string) || (p.email as string) || "Usuário");
    }

    const refByUser = new Map<string, (typeof referrals)[number]>();
    for (const r of referrals ?? []) refByUser.set(r.referred_user_id as string, r);

    const out: Row[] = (invites ?? []).map((i) => {
      const ref = i.visitor_user_id ? refByUser.get(i.visitor_user_id as string) : undefined;
      if (ref) refByUser.delete(ref.referred_user_id as string);
      return {
        id: i.id as string,
        referrerName: nameOf.get(i.referrer_user_id as string) ?? "Usuário",
        contact: (i.contact_email as string) || (i.contact_phone as string) || "Link compartilhado",
        channel: CHANNEL_LABEL[i.channel as string] ?? (i.channel as string),
        sentAt: i.sent_at as string,
        visitedAt: i.visited_at as string | null,
        creditsAt: i.rewarded_at as string | null,
        purchaseAt: (ref?.first_purchase_at as string | null) ?? null,
        purchaseAmount: (ref?.first_purchase_amount as number | null) ?? null,
        cashbackAmount: (ref?.reward_amount as number | null) ?? null,
      };
    });

    for (const r of refByUser.values()) {
      out.push({
        id: r.id as string,
        referrerName: nameOf.get(r.referrer_user_id as string) ?? "Usuário",
        contact: nameOf.get(r.referred_user_id as string) ?? "Amigo indicado",
        channel: "Link",
        sentAt: null,
        visitedAt: r.created_at as string,
        creditsAt: null,
        purchaseAt: r.first_purchase_at as string | null,
        purchaseAmount: r.first_purchase_amount as number | null,
        cashbackAmount: r.reward_amount as number | null,
      });
    }

    setRows(out);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.referrerName.toLowerCase().includes(q) || r.contact.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(
    () => ({
      sent: filtered.length,
      visited: filtered.filter((r) => r.visitedAt).length,
      purchased: filtered.filter((r) => r.purchaseAt).length,
      cashback: filtered.reduce((s, r) => s + (r.purchaseAt ? (r.cashbackAmount ?? 0) : 0), 0),
    }),
    [filtered],
  );

  const exportCsv = () => {
    const head = [
      "Quem indicou",
      "Contato indicado",
      "Canal",
      "Convite enviado",
      "Abriu o link",
      "Creditos de IA liberados",
      "Fez compra",
      "Valor da compra",
      "Cashback",
    ];
    const lines = filtered.map((r) =>
      [
        r.referrerName,
        r.contact,
        r.channel,
        fmtDateTime(r.sentAt),
        fmtDateTime(r.visitedAt),
        fmtDateTime(r.creditsAt),
        fmtDateTime(r.purchaseAt),
        r.purchaseAmount != null ? fmtMoney(r.purchaseAmount) : "",
        r.cashbackAmount != null && r.purchaseAt ? fmtMoney(r.cashbackAmount) : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "indicacoes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold">Indicações de Amigos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Programa único: o indicador ganha Créditos de IA quando o amigo abre o link e cashback
          quando o amigo faz a primeira compra.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Convites enviados" value={String(totals.sent)} />
        <Stat label="Abriram o link" value={String(totals.visited)} />
        <Stat label="Fizeram compra" value={String(totals.purchased)} />
        <Stat label="Cashback gerado" value={fmtMoney(totals.cashback)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por quem indicou ou pelo contato indicado"
          className="max-w-sm"
        />
        <Button variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="overflow-x-auto p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando indicações…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma indicação encontrada.</p>
        ) : (
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Quem indicou</th>
                <th className="py-2 pr-3">Contato indicado</th>
                <th className="py-2 pr-3">Canal</th>
                <th className="py-2 pr-3">Convite enviado</th>
                <th className="py-2 pr-3">Abriu o link</th>
                <th className="py-2 pr-3">Fez compra</th>
                <th className="py-2">Cashback</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{r.referrerName}</td>
                  <td className="py-2 pr-3">{r.contact}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.channel}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmtDateTime(r.sentAt)}</td>
                  <td className="py-2 pr-3">
                    {r.visitedAt ? (
                      <>
                        {fmtDateTime(r.visitedAt)}
                        {r.creditsAt && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Créditos de IA liberados
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Ainda não abriu</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {r.purchaseAt ? (
                      <>
                        {fmtDateTime(r.purchaseAt)}
                        {r.purchaseAmount != null && (
                          <span className="block text-[11px] text-muted-foreground">
                            compra de {fmtMoney(r.purchaseAmount)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Aguardando</span>
                    )}
                  </td>
                  <td className="py-2">
                    {r.purchaseAt && r.cashbackAmount != null
                      ? `+${fmtMoney(r.cashbackAmount)}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border bg-card/50 px-3 py-2">
    <p className="text-lg font-semibold">{value}</p>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

export default AdminReferralsTab;
