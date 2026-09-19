import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Gift, Send, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCashbackAccount, useCashbackConfig, getReferralDiscount } from "@/hooks/useCashback";
import {
  useAllPlatformSettings,
  type BrandingSettings,
  type ContactSettings,
} from "@/hooks/usePlatformSettings";

type Variant = "hero" | "compact";

interface Props {
  /** "hero" para destaque na página inicial, "compact" para modais e checkout. */
  variant?: Variant;
  className?: string;
  /** Texto opcional acima do título (ex.: contexto de crédito esgotado). */
  eyebrow?: string;
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type InviteChannel = "email" | "whatsapp" | "sms";

interface InviteRow {
  id: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
}

/** Máscara (XX) XXXXX-XXXX para o celular do amigo. */
const maskPhone = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const InviteFriendsPanel = ({ variant = "hero", className, eyebrow }: Props) => {
  const { user, profile } = useAuth();
  const { account } = useCashbackAccount();
  const { config } = useCashbackConfig();
  const [rewardedCount, setRewardedCount] = useState(0);
  const { settings } = useAllPlatformSettings();
  const branding = settings.branding as BrandingSettings | undefined;
  const contact = settings.contact as ContactSettings | undefined;

  const [friendEmail, setFriendEmail] = useState("");
  const [friendPhone, setFriendPhone] = useState("");
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [sending, setSending] = useState<InviteChannel | null>(null);

  const platformName = branding?.platform_name || "Revisão Fácil";
  const logoSrc =
    branding?.logo_url_light_bg || branding?.logo_url || branding?.logo_url_dark_bg || "";

  const origin = typeof window !== "undefined" ? window.location.origin : "https://revisaofacil.com.br";

  const referralLink = useMemo(() => {
    if (account?.referral_code) return `${origin}/signup/student?ref=${account.referral_code}`;
    return `${origin}/signup/student`;
  }, [account?.referral_code, origin]);

  const shareText = useMemo(
    () =>
      `Estou estudando na ${platformName} — revisões, resumos, simulados e aulas com professores. ` +
      `Use meu convite e comece agora: ${referralLink}`,
    [platformName, referralLink],
  );

  const percent = config.referral_percent ?? 10;

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  const socialLinks = useMemo(() => {
    const encoded = encodeURIComponent(shareText);
    const url = encodeURIComponent(referralLink);
    return [
      {
        key: "whatsapp",
        label: "WhatsApp",
        href: `https://wa.me/?text=${encoded}`,
        className: "text-[#25D366]",
        path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
      },
      {
        key: "x",
        label: "X",
        href: `https://twitter.com/intent/tweet?text=${encoded}`,
        className: "text-foreground",
        path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
        className: "text-[#0A66C2]",
        path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
      },
      {
        key: "telegram",
        label: "Telegram",
        href: `https://t.me/share/url?url=${url}&text=${encoded}`,
        className: "text-[#229ED9]",
        path: "M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
      },
    ];
  }, [referralLink, shareText]);

  const loadInvites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("referral_invites")
      .select("id, contact_email, contact_phone, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    setInvites((data ?? []) as InviteRow[]);

    const { count } = await supabase
      .from("referral_invites")
      .select("id", { count: "exact", head: true })
      .eq("status", "rewarded");
    setRewardedCount(count ?? 0);
  }, [user]);

  /** Faixa de desconto na renovação conforme as indicações já premiadas. */
  const discountInfo = useMemo(
    () => getReferralDiscount(config.referral_discount_tiers, rewardedCount),
    [config.referral_discount_tiers, rewardedCount]
  );

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const sendInvite = async (channel: InviteChannel) => {
    if (!user) {
      toast.error("Entre na sua conta para enviar convites.");
      return;
    }
    if (channel === "email" && !isValidEmail(friendEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (channel !== "email" && friendPhone.replace(/\D/g, "").length !== 11) {
      toast.error("Informe um celular válido com DDD.");
      return;
    }
    setSending(channel);
    try {
      const { data, error } = await supabase.functions.invoke("referral-invite", {
        body: {
          action: "send",
          channel,
          email: friendEmail.trim(),
          phone: friendPhone.replace(/\D/g, ""),
          origin,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        toast.error(result?.error || "Não foi possível enviar agora.");
        return;
      }
      if (channel === "email") setFriendEmail("");
      else setFriendPhone("");
      toast.success("Convite enviado!");
      void loadInvites();
    } catch (e) {
      console.error("referral invite failed", e);
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSending(null);
    }
  };

  const body = (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        {logoSrc ? (
          <img src={logoSrc} alt={platformName} className="mx-auto h-10 object-contain" />
        ) : (
          <span className="font-display text-lg font-bold text-gradient">{platformName}</span>
        )}
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wide text-primary">{eyebrow}</p>
        )}
        <h2
          className={
            variant === "hero"
              ? "font-display text-2xl font-bold md:text-3xl"
              : "font-display text-lg font-bold"
          }
        >
          Convide amigos e ganhe cashback
        </h2>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          Compartilhe seu convite da {platformName}. Quando seu amigo fizer a primeira compra, você
          ganha <strong>{percent}% de cashback</strong> para usar como desconto — e ele começa a
          estudar com revisões, resumos, simulados e aulas com professores.
        </p>
      </div>

      <Button className="w-full gap-2" onClick={() => copy(referralLink, "Link de convite")}>
        <Copy className="h-4 w-4" />
        Copiar link de convite
      </Button>

      {account?.referral_code && (
        <button
          type="button"
          onClick={() => copy(account.referral_code, "Código")}
          className="mx-auto flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Seu código: <strong className="text-foreground">{account.referral_code}</strong>
          <Copy className="h-3 w-3" />
        </button>
      )}

      <div className="grid grid-cols-4 gap-2">
        {socialLinks.map((s) => (
          <a
            key={s.key}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Compartilhar no ${s.label}`}
            className="flex h-11 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
          >
            <svg className={`h-5 w-5 ${s.className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d={s.path} />
            </svg>
          </a>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Enviar convite direto para o seu amigo</p>
        <div className="flex gap-2">
          <Input
            type="email"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
            placeholder="E-mail do seu amigo"
            aria-label="E-mail do amigo"
          />
          <Button
            variant="secondary"
            className="gap-2 shrink-0"
            onClick={() => sendInvite("email")}
            disabled={sending !== null}
          >
            {sending === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            E-mail
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="tel"
            inputMode="numeric"
            value={friendPhone}
            onChange={(e) => setFriendPhone(maskPhone(e.target.value))}
            placeholder="(11) 91234-5678"
            aria-label="Celular do amigo"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="gap-2 flex-1 sm:flex-none"
              onClick={() => sendInvite("whatsapp")}
              disabled={sending !== null}
            >
              {sending === "whatsapp" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              WhatsApp
            </Button>
            <Button
              variant="secondary"
              className="gap-2 flex-1 sm:flex-none"
              onClick={() => sendInvite("sms")}
              disabled={sending !== null}
            >
              {sending === "sms" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              SMS
            </Button>
          </div>
        </div>
        {user && discountInfo.next && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
            <p className="font-medium text-primary">Desconto na renovação da sua assinatura</p>
            <p className="text-muted-foreground">
              Você já tem <strong>{rewardedCount}</strong> indicaç{rewardedCount === 1 ? "ão" : "ões"} premiada
              {rewardedCount === 1 ? "" : "s"}. Com <strong>{discountInfo.next.invites}</strong> indicações você
              ganha <strong>{discountInfo.next.percent}% de desconto</strong> na renovação.
              {discountInfo.current &&
                ` Desconto já garantido: ${discountInfo.current.percent}%.`}
            </p>
          </div>
        )}
        {user && !discountInfo.next && discountInfo.current && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <p className="font-medium text-primary">
              Você já garantiu {discountInfo.current.percent}% de desconto na renovação da assinatura.
            </p>
          </div>
        )}
        {user && invites.length > 0 && (
          <div className="space-y-1 rounded-lg border border-border/60 p-2">
            <p className="text-xs font-medium text-muted-foreground">Convites enviados</p>
            {invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{i.contact_email || i.contact_phone || "Link"}</span>
                <span
                  className={
                    i.status === "rewarded"
                      ? "text-primary font-medium"
                      : i.status === "visited"
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }
                >
                  {i.status === "rewarded"
                    ? "Premiado"
                    : i.status === "visited"
                      ? "Acessado"
                      : i.status === "expired"
                        ? "Expirado"
                        : "Enviado"}
                </span>
              </div>
            ))}
          </div>
        )}
        {!user && (
          <p className="text-xs text-muted-foreground">
            <Link to="/login" className="text-primary underline">
              Entre na sua conta
            </Link>{" "}
            para gerar o seu código e acompanhar o cashback das indicações.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {user && (
          <Link to="/dashboard/student?tab=cashback" className="hover:text-foreground">
            <Users className="mr-1 inline h-3 w-3" />
            Minhas indicações
          </Link>
        )}
        {contact?.whatsapp && (
          <a
            href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            WhatsApp {contact.whatsapp}
          </a>
        )}
        {contact?.email && (
          <a href={`mailto:${contact.email}`} className="hover:text-foreground">
            {contact.email}
          </a>
        )}
        {contact?.instagram && (
          <a
            href={`https://instagram.com/${contact.instagram.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            {contact.instagram}
          </a>
        )}
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <div className={`rounded-xl border border-primary/20 bg-primary/5 p-4 ${className ?? ""}`}>
        {body}
      </div>
    );
  }

  return (
    <section className={`px-4 py-10 md:px-10 ${className ?? ""}`} aria-labelledby="convite-amigos">
      <Card className="relative mx-auto max-w-2xl overflow-hidden border-primary/25 p-6 md:p-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 to-transparent"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Gift className="h-3.5 w-3.5" />
              Programa de indicação
            </span>
          </div>
          <div id="convite-amigos">{body}</div>
        </div>
      </Card>
    </section>
  );
};

export default InviteFriendsPanel;
