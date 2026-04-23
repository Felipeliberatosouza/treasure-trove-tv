import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Copy, TrendingUp, Wallet, Users, Clock, ArrowUpRight, ArrowDownRight, Crown, Mail, Loader2 } from "lucide-react";
import {
  useCashbackAccount,
  useCashbackTransactions,
  useCashbackConfig,
} from "@/hooks/useCashback";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReferralStatusPanel from "./ReferralStatusPanel";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const kindLabel = (k: string) => ({
  earn_purchase: "Compra",
  earn_referral: "Indicação",
  spend: "Uso em compra",
  expire: "Expirado",
  adjust: "Ajuste",
  reverse: "Estorno",
}[k] ?? k);

const statusLabel = (s: string) => ({
  pending: "Pendente",
  available: "Disponível",
  used: "Usado",
  expired: "Expirado",
  reversed: "Estornado",
}[s] ?? s);

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "available") return "default";
  if (s === "pending") return "secondary";
  if (s === "used") return "outline";
  return "destructive";
};

const StudentCashbackTab = () => {
  const { user, profile } = useAuth();
  const { account, loading: loadingAcc } = useCashbackAccount();
  const { transactions, loading: loadingTx } = useCashbackTransactions();
  const { config, loading: loadingCfg } = useCashbackConfig();
  const [sendingEmail, setSendingEmail] = useState(false);

  const currentTier = useMemo(() => {
    if (!account) return null;
    return config.tiers.find((t) => t.id === account.current_tier) ?? config.tiers[0];
  }, [account, config.tiers]);

  const nextTier = useMemo(() => {
    if (!account || !currentTier) return null;
    const idx = config.tiers.findIndex((t) => t.id === currentTier.id);
    return config.tiers[idx + 1] ?? null;
  }, [account, currentTier, config.tiers]);

  const referralLink = useMemo(() => {
    if (!account?.referral_code) return "";
    return `${window.location.origin}/signup-aluno?ref=${account.referral_code}`;
  }, [account?.referral_code]);

  const copyCode = () => {
    if (!account?.referral_code) return;
    navigator.clipboard.writeText(account.referral_code);
    toast.success("Código copiado!");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success("Link copiado!");
  };

  const shareText = useMemo(() => {
    if (!referralLink) return "";
    return `Estou estudando na Revisão Fácil e curtindo demais! Use meu link e ganhe acesso aos conteúdos: ${referralLink}`;
  }, [referralLink]);

  const sendByEmail = async () => {
    if (!user?.email || !account?.referral_code) {
      toast.error("Não foi possível identificar seu e-mail.");
      return;
    }
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "cashback-referral-share",
          recipientEmail: user.email,
          idempotencyKey: `cashback-referral-share-${user.id}-${Date.now()}`,
          templateData: {
            name: (profile as { name?: string } | null)?.name ?? "",
            referralCode: account.referral_code,
            referralLink,
            shareText,
            referralPercent: config.referral_percent,
          },
        },
      });
      if (error) throw error;
      toast.success("Enviamos o link de indicação para o seu e-mail!");
    } catch (e) {
      console.error("send referral email failed", e);
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loadingAcc || loadingCfg) {
    return <p className="text-sm text-muted-foreground">Carregando programa de cashback…</p>;
  }

  if (!config.enabled) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">O programa de cashback está temporariamente desativado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Cashback
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ganhe dinheiro de volta em todas as suas compras e use como desconto.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Wallet className="h-3.5 w-3.5" /> Disponível para usar
          </div>
          <p className="text-2xl font-bold text-primary">{fmt(account?.balance_available ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Use até {config.max_checkout_pct}% do valor em qualquer compra.
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" /> Pendente
          </div>
          <p className="text-2xl font-bold">{fmt(account?.balance_pending ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Liberado em {config.grace_period_days} dias após a compra.
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" /> Total ganho
          </div>
          <p className="text-2xl font-bold">{fmt(account?.total_earned ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {fmt(account?.total_spent ?? 0)} já usado
          </p>
        </Card>
      </div>

      <Card className="p-5 bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="h-5 w-5 text-primary" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Seu nível</span>
            </div>
            <p className="text-2xl font-display font-bold">{currentTier?.name ?? "Bronze"}</p>
            <p className="text-sm text-muted-foreground">
              {currentTier?.percent}% de cashback em cada compra
            </p>
          </div>
          {nextTier && (
            <div className="text-right text-sm">
              <p className="text-muted-foreground">Próximo nível: <strong className="text-foreground">{nextTier.name}</strong></p>
              <p className="text-xs text-muted-foreground">
                Gaste {fmt(nextTier.min_spent_12m)} em 12 meses para chegar lá ({nextTier.percent}% cashback)
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Indique e ganhe</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Compartilhe seu código e ganhe <strong>{config.referral_percent}%</strong> de cashback sobre a primeira compra de quem você indicar.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Seu código</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 rounded-md bg-secondary font-mono text-lg tracking-wider text-center">
                {account?.referral_code ?? "—"}
              </code>
              <Button variant="outline" size="icon" onClick={copyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Link de indicação</label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={referralLink}
                className="flex-1 px-3 py-2 rounded-md bg-secondary text-xs truncate" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={sendByEmail}
            disabled={sendingEmail || !account?.referral_code}
            className="w-full md:w-auto"
          >
            {sendingEmail ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Receber por e-mail
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Enviamos seu código, link e um texto pronto para compartilhar com amigos.
          </p>
        </div>

      </Card>

      <ReferralStatusPanel />

      <Card className="p-5">
        <h3 className="font-display font-semibold mb-3">Extrato</h3>
        {loadingTx ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((t) => {
              const isIn = t.kind === "earn_purchase" || t.kind === "earn_referral" || (t.kind === "adjust" && t.amount > 0);
              return (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isIn ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                      {isIn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{kindLabel(t.kind)}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(t.created_at)}
                        {t.status === "pending" && t.available_at && ` • libera em ${fmtDate(t.available_at)}`}
                        {t.status === "available" && t.expires_at && ` • expira em ${fmtDate(t.expires_at)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isIn ? "text-emerald-500" : "text-foreground"}`}>
                      {isIn ? "+" : "-"}{fmt(t.amount)}
                    </p>
                    <Badge variant={statusVariant(t.status)} className="text-[10px] mt-0.5">
                      {statusLabel(t.status)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default StudentCashbackTab;