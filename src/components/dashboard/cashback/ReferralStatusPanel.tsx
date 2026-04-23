import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  CalendarDays,
  CalendarX,
  Info,
  Copy,
} from "lucide-react";
import {
  useCashbackReferrals,
  useCashbackTransactions,
  type CashbackReferral,
  type CashbackTransaction,
} from "@/hooks/useCashback";

const fmtMoney = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const daysUntil = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const diffMs = new Date(d).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

type DerivedStatus = "awaiting_purchase" | "grace_period" | "available" | "used" | "expired" | "cancelled";

interface DerivedReferral {
  referral: CashbackReferral;
  transaction: CashbackTransaction | null;
  status: DerivedStatus;
  amount: number;
  rewardedAt: string | null;
  availableAt: string | null;
  expiresAt: string | null;
}

const STATUS_META: Record<
  DerivedStatus,
  {
    label: string;
    description: string;
    icon: typeof Hourglass;
    badgeVariant: "default" | "secondary" | "outline" | "destructive";
    accentClass: string;
  }
> = {
  awaiting_purchase: {
    label: "Aguardando 1ª compra",
    description:
      "Seu indicado se cadastrou. Quando ele fizer a primeira compra, seu cashback começa a contar.",
    icon: Hourglass,
    badgeVariant: "secondary",
    accentClass: "text-muted-foreground",
  },
  grace_period: {
    label: "Em carência (30 dias)",
    description:
      "Compra confirmada! O valor entra na sua carteira como pendente e será liberado após o período de carência.",
    icon: Clock,
    badgeVariant: "secondary",
    accentClass: "text-amber-600 dark:text-amber-500",
  },
  available: {
    label: "Disponível",
    description:
      "Saldo liberado e pronto para usar como desconto em qualquer compra.",
    icon: CheckCircle2,
    badgeVariant: "default",
    accentClass: "text-emerald-600 dark:text-emerald-500",
  },
  used: {
    label: "Usado",
    description: "Você já aplicou este cashback em uma compra anterior.",
    icon: CheckCircle2,
    badgeVariant: "outline",
    accentClass: "text-muted-foreground",
  },
  expired: {
    label: "Expirado",
    description:
      "O prazo de validade encerrou antes do uso e o saldo foi removido.",
    icon: CalendarX,
    badgeVariant: "destructive",
    accentClass: "text-destructive",
  },
  cancelled: {
    label: "Cancelado",
    description:
      "Indicação cancelada (ex.: pagamento estornado durante a carência).",
    icon: XCircle,
    badgeVariant: "destructive",
    accentClass: "text-destructive",
  },
};

const deriveStatus = (
  referral: CashbackReferral,
  tx: CashbackTransaction | null,
): DerivedStatus => {
  if (referral.status === "cancelled") return "cancelled";
  // No transaction yet → indicated user hasn't completed first purchase.
  if (!tx) {
    if (referral.status === "rewarded") return "available"; // edge: rewarded without tx row
    return "awaiting_purchase";
  }
  if (tx.status === "expired") return "expired";
  if (tx.status === "used") return "used";
  if (tx.status === "reversed") return "cancelled";
  if (tx.status === "available") return "available";
  if (tx.status === "pending") return "grace_period";
  return "awaiting_purchase";
};

const ReferralStatusPanel = () => {
  const { referrals, loading: loadingRef } = useCashbackReferrals();
  const { transactions, loading: loadingTx } = useCashbackTransactions();

  const derived: DerivedReferral[] = useMemo(() => {
    // Build a map of referral txs keyed by referred_user_id.
    const byReferredUser = new Map<string, CashbackTransaction>();
    for (const tx of transactions) {
      if (tx.kind !== "earn_referral") continue;
      if (!tx.referred_user_id) continue;
      const existing = byReferredUser.get(tx.referred_user_id);
      // Prefer the most recent tx if duplicates exist.
      if (
        !existing ||
        new Date(tx.created_at).getTime() > new Date(existing.created_at).getTime()
      ) {
        byReferredUser.set(tx.referred_user_id, tx);
      }
    }

    return referrals.map((r) => {
      const tx = byReferredUser.get(r.referred_user_id) ?? null;
      const status = deriveStatus(r, tx);
      return {
        referral: r,
        transaction: tx,
        status,
        amount: tx?.amount ?? r.reward_amount ?? 0,
        rewardedAt: r.rewarded_at ?? tx?.created_at ?? null,
        availableAt: tx?.available_at ?? null,
        expiresAt: tx?.expires_at ?? null,
      };
    });
  }, [referrals, transactions]);

  const counts = useMemo(() => {
    const acc: Record<DerivedStatus, number> = {
      awaiting_purchase: 0,
      grace_period: 0,
      available: 0,
      used: 0,
      expired: 0,
      cancelled: 0,
    };
    for (const d of derived) acc[d.status] += 1;
    return acc;
  }, [derived]);

  const loading = loadingRef || loadingTx;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-display font-semibold">Status das suas indicações</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Acompanhe cada indicação em tempo real: aguardando a primeira compra, em
        carência, disponível para uso ou expirada.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <SummaryPill
          label="Aguardando"
          value={counts.awaiting_purchase}
          icon={Hourglass}
          accent="text-muted-foreground"
        />
        <SummaryPill
          label="Em carência"
          value={counts.grace_period}
          icon={Clock}
          accent="text-amber-600 dark:text-amber-500"
        />
        <SummaryPill
          label="Disponível"
          value={counts.available}
          icon={CheckCircle2}
          accent="text-emerald-600 dark:text-emerald-500"
        />
        <SummaryPill
          label="Expirado"
          value={counts.expired + counts.cancelled}
          icon={CalendarX}
          accent="text-destructive"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando indicações…</p>
      ) : derived.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-md">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhuma indicação ainda. Compartilhe seu código para começar a
            ganhar.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {derived.map((d) => (
            <ReferralRow key={d.referral.id} derived={d} />
          ))}
        </ul>
      )}
    </Card>
  );
};

const SummaryPill = ({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Hourglass;
  accent: string;
}) => (
  <div className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
    <Icon className={`h-4 w-4 ${accent}`} />
    <div className="leading-tight">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </div>
  </div>
);

const ReferralRow = ({ derived }: { derived: DerivedReferral }) => {
  const meta = STATUS_META[derived.status];
  const Icon = meta.icon;
  const releaseInDays =
    derived.status === "grace_period" ? daysUntil(derived.availableAt) : null;
  const expireInDays =
    derived.status === "available" ? daysUntil(derived.expiresAt) : null;

  return (
    <li className="rounded-md border border-border p-3 bg-background/40">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 ${meta.accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={meta.badgeVariant} className="text-[10px]">
                {meta.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Indicado em {fmtDate(derived.referral.created_at)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className={`text-base font-semibold ${meta.accentClass}`}>
            {derived.status === "available" ||
            derived.status === "grace_period" ||
            derived.status === "used"
              ? `+${fmtMoney(derived.amount)}`
              : derived.status === "expired" || derived.status === "cancelled"
                ? fmtMoney(derived.amount)
                : "—"}
          </p>
          {derived.referral.first_purchase_amount != null && (
            <p className="text-[11px] text-muted-foreground">
              sobre {fmtMoney(derived.referral.first_purchase_amount)}
            </p>
          )}
        </div>
      </div>

      {/* Date timeline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/60">
        <DateChip
          icon={CalendarDays}
          label="1ª compra"
          value={fmtDate(derived.referral.first_purchase_at)}
          muted={!derived.referral.first_purchase_at}
        />
        <DateChip
          icon={Clock}
          label="Liberação"
          value={
            derived.availableAt
              ? `${fmtDate(derived.availableAt)}${
                  releaseInDays != null && releaseInDays > 0
                    ? ` (em ${releaseInDays}d)`
                    : ""
                }`
              : "—"
          }
          muted={!derived.availableAt}
          highlight={derived.status === "grace_period"}
        />
        <DateChip
          icon={CalendarX}
          label="Validade"
          value={
            derived.expiresAt
              ? `${fmtDate(derived.expiresAt)}${
                  expireInDays != null && expireInDays > 0
                    ? ` (em ${expireInDays}d)`
                    : ""
                }`
              : "—"
          }
          muted={!derived.expiresAt}
          highlight={derived.status === "available"}
        />
      </div>
    </li>
  );
};

const DateChip = ({
  icon: Icon,
  label,
  value,
  muted,
  highlight,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) => (
  <div
    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
      highlight ? "bg-primary/5 border border-primary/20" : "bg-muted/30"
    }`}
  >
    <Icon
      className={`h-3.5 w-3.5 shrink-0 ${
        muted ? "text-muted-foreground/60" : "text-muted-foreground"
      }`}
    />
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
        {label}
      </p>
      <p
        className={`leading-tight truncate ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  </div>
);

export default ReferralStatusPanel;