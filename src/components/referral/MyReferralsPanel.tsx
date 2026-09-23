import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Link2, MousePointerClick, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { REFERRAL_RULES } from "./referralBenefits";

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

interface InviteRow {
  id: string;
  channel: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  sent_at: string;
  visited_at: string | null;
  rewarded_at: string | null;
  visitor_user_id: string | null;
}

interface ReferralRow {
  id: string;
  referred_user_id: string;
  status: string;
  reward_amount: number;
  first_purchase_amount: number | null;
  first_purchase_at: string | null;
  created_at: string;
}

export interface UnifiedReferral {
  id: string;
  contact: string;
  channel: string;
  sentAt: string | null;
  visitedAt: string | null;
  creditsAt: string | null;
  purchaseAt: string | null;
  purchaseAmount: number | null;
  cashbackAmount: number | null;
}

/** Junta os convites enviados com o cashback gerado pela 1ª compra do indicado. */
export function buildUnifiedReferrals(
  invites: InviteRow[],
  referrals: ReferralRow[],
): UnifiedReferral[] {
  const byUser = new Map<string, ReferralRow>();
  for (const r of referrals) byUser.set(r.referred_user_id, r);

  const rows: UnifiedReferral[] = invites.map((i) => {
    const ref = i.visitor_user_id ? byUser.get(i.visitor_user_id) : undefined;
    if (ref) byUser.delete(ref.referred_user_id);
    return {
      id: i.id,
      contact: i.contact_email || i.contact_phone || "Link compartilhado",
      channel: CHANNEL_LABEL[i.channel] ?? i.channel,
      sentAt: i.sent_at,
      visitedAt: i.visited_at,
      creditsAt: i.rewarded_at,
      purchaseAt: ref?.first_purchase_at ?? null,
      purchaseAmount: ref?.first_purchase_amount ?? null,
      cashbackAmount: ref?.reward_amount ?? null,
    };
  });

  // Amigos que entraram pelo código/link compartilhado, sem convite direto.
  for (const r of byUser.values()) {
    rows.push({
      id: r.id,
      contact: "Amigo que usou seu link",
      channel: "Link",
      sentAt: null,
      visitedAt: r.created_at,
      creditsAt: null,
      purchaseAt: r.first_purchase_at,
      purchaseAmount: r.first_purchase_amount,
      cashbackAmount: r.reward_amount,
    });
  }

  return rows.sort(
    (a, b) =>
      new Date(b.sentAt ?? b.visitedAt ?? 0).getTime() -
      new Date(a.sentAt ?? a.visitedAt ?? 0).getTime(),
  );
}

/** Extrato simples das indicações do aluno: envio, acesso e compra. */
const MyReferralsPanel = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<UnifiedReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: invites }, { data: referrals }] = await Promise.all([
      supabase
        .from("referral_invites")
        .select("id, channel, contact_email, contact_phone, status, sent_at, visited_at, rewarded_at, visitor_user_id")
        .eq("referrer_user_id", user.id)
        .order("sent_at", { ascending: false }),
      supabase
        .from("cashback_referrals")
        .select("id, referred_user_id, status, reward_amount, first_purchase_amount, first_purchase_at, created_at")
        .eq("referrer_user_id", user.id),
    ]);
    setRows(buildUnifiedReferrals((invites ?? []) as InviteRow[], (referrals ?? []) as ReferralRow[]));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => ({
      sent: rows.length,
      visited: rows.filter((r) => r.visitedAt).length,
      purchased: rows.filter((r) => r.purchaseAt).length,
      cashback: rows.reduce((s, r) => s + (r.purchaseAt ? (r.cashbackAmount ?? 0) : 0), 0),
    }),
    [rows],
  );

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">Minhas indicações</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {REFERRAL_RULES[0].text} {REFERRAL_RULES[1].text}
      </p>

      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Pill icon={Link2} label="Convites enviados" value={String(totals.sent)} />
        <Pill icon={MousePointerClick} label="Abriram o link" value={String(totals.visited)} />
        <Pill icon={ShoppingBag} label="Fizeram compra" value={String(totals.purchased)} />
        <Pill icon={ShoppingBag} label="Cashback gerado" value={fmtMoney(totals.cashback)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando indicações…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border py-8 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Você ainda não indicou ninguém. Envie o seu convite e comece a ganhar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3">Contato</th>
                <th className="py-2 pr-3">Canal</th>
                <th className="py-2 pr-3">Convite enviado</th>
                <th className="py-2 pr-3">Abriu o link</th>
                <th className="py-2 pr-3">Fez compra</th>
                <th className="py-2">Cashback</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{r.contact}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.channel}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmtDateTime(r.sentAt)}</td>
                  <td className="py-2 pr-3">
                    {r.visitedAt ? (
                      <span className="text-foreground">
                        {fmtDateTime(r.visitedAt)}
                        {r.creditsAt && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            Créditos de IA liberados
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Ainda não abriu</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {r.purchaseAt ? (
                      <span>
                        {fmtDateTime(r.purchaseAt)}
                        {r.purchaseAmount != null && (
                          <span className="block text-[11px] text-muted-foreground">
                            compra de {fmtMoney(r.purchaseAmount)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Aguardando</span>
                    )}
                  </td>
                  <td className="py-2">
                    {r.purchaseAt && r.cashbackAmount != null ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        +{fmtMoney(r.cashbackAmount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const Pill = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
    <Icon className="h-4 w-4 text-primary" />
    <div className="leading-tight">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  </div>
);

export default MyReferralsPanel;
