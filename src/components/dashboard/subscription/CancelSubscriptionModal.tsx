import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, Gift, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RetentionCouponSettings } from "@/hooks/usePlatformSettings";

export const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Muito caro" },
  { value: "not_using", label: "Não estou usando" },
  { value: "missing_features", label: "Falta funcionalidades / conteúdo" },
  { value: "found_alternative", label: "Encontrei outra plataforma" },
  { value: "technical_issues", label: "Problemas técnicos" },
  { value: "temporary_pause", label: "Pausa temporária" },
  { value: "other", label: "Outro motivo" },
] as const;

export interface CancellationPreview {
  planName: string;
  allowFreeCancel: boolean;
  minCommitmentDays: number;
  minUsageChargePct: number;
  currency: string;
  currentAmount: number;
  cycleDays: number;
  daysUsed: number;
  totalSubscriptionDays: number;
  dailyRate: number;
  usedAmount: number;
  minCharge: number;
  proRataAmount: number;
  isInCommitment: boolean;
  commitmentDaysRemaining: number;
  commitmentPenalty: number;
  chargeAmount: number;
}

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  /** Called with the Stripe-sourced preview so the parent can reuse the same
   *  numbers on the email and the PDF. */
  onConfirm: (preview: CancellationPreview, reason: { code: string; details: string }) => Promise<void>;
}

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export default function CancelSubscriptionModal({
  open, onOpenChange, planName, onConfirm,
}: CancelSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonDetails, setReasonDetails] = useState<string>("");

  // Retention offer state
  const [retention, setRetention] = useState<RetentionCouponSettings | null>(null);
  const [showRetention, setShowRetention] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [retentionDeclined, setRetentionDeclined] = useState(false);
  // True when this student has already accepted a retention coupon in the past.
  // The offer is one-shot per student, so we hide it from then on.
  const [retentionAlreadyUsed, setRetentionAlreadyUsed] = useState(false);

  // Fetch the Stripe-sourced cancellation breakdown whenever the modal opens.
  // This is the SOURCE OF TRUTH — same numbers will be used on the email/PDF.
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      setReasonCode("");
      setReasonDetails("");
      setShowRetention(false);
      setRetentionDeclined(false);
      setRetentionAlreadyUsed(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      setError(null);
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes?.user?.id;
        const [{ data, error }, { data: cfgRow }, priorRes] = await Promise.all([
          supabase.functions.invoke("preview-cancellation"),
          supabase.from("platform_settings").select("value").eq("key", "retention_coupon").maybeSingle(),
          uid
            ? supabase
                .from("audit_logs")
                .select("id")
                .eq("user_id", uid)
                .eq("action", "retention_coupon_applied")
                .limit(1)
            : Promise.resolve({ data: [] as { id: string }[] }),
        ]);
        if (error) throw error;
        if (cancelled) return;
        if (!data?.ok) {
          setError(data?.error || "Não foi possível calcular o valor de cancelamento.");
        } else {
          setPreview(data as CancellationPreview);
        }
        if (cfgRow?.value) setRetention(cfgRow.value as unknown as RetentionCouponSettings);
        const priorRows = (priorRes as { data?: { id: string }[] | null })?.data || [];
        if (priorRows.length > 0) setRetentionAlreadyUsed(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao calcular o cancelamento.");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Decide whether the offer applies for the currently selected reason.
  // The retention coupon is one-shot per student: if they accepted it before,
  // we never offer it again (verified against audit_logs.retention_coupon_applied).
  const offerEligible =
    !!retention?.enabled &&
    !!retention?.coupon_id &&
    !retentionDeclined &&
    !retentionAlreadyUsed &&
    (!reasonCode ||
      !retention.eligible_reasons?.length ||
      retention.eligible_reasons.includes(reasonCode));

  const handleConfirm = async () => {
    if (!preview) return;
    // If an eligible retention offer exists, show it BEFORE cancelling.
    if (offerEligible && reasonCode && !showRetention) {
      setShowRetention(true);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(preview, { code: reasonCode, details: reasonDetails.trim() });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCoupon = async () => {
    setApplyingCoupon(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-retention-coupon", {
        body: { reasonCode },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Não foi possível aplicar o desconto.");
      toast.success("Desconto aplicado! Sua assinatura continua ativa.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aplicar o desconto.");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleDeclineCoupon = () => {
    setRetentionDeclined(true);
    setShowRetention(false);
  };

  const renderBody = () => {
    if (previewLoading) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando valores do cancelamento...
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </div>
      );
    }
    if (!preview) return null;

    const {
      daysUsed, cycleDays, dailyRate, usedAmount, minUsageChargePct, minCharge,
      proRataAmount, isInCommitment, commitmentDaysRemaining, commitmentPenalty,
      chargeAmount, allowFreeCancel, minCommitmentDays,
    } = preview;
    const usagePct = cycleDays > 0 ? (daysUsed / cycleDays) * 100 : 0;

    let explanation = "";
    if (allowFreeCancel) {
      if (minUsageChargePct > 0 && usedAmount < minCharge) {
        explanation = `Você usou ${daysUsed} de ${cycleDays} dias do ciclo (${usagePct.toFixed(0)}%). O uso proporcional seria ${fmtBRL(usedAmount)}, porém o plano ${planName} possui cobrança mínima de ${minUsageChargePct}% (${fmtBRL(minCharge)}). Será cobrado ${fmtBRL(chargeAmount)}.`;
      } else {
        explanation = `Você usou ${daysUsed} de ${cycleDays} dias do ciclo (${usagePct.toFixed(0)}%). Será cobrado proporcionalmente ${fmtBRL(chargeAmount)} pelos dias utilizados.`;
      }
    } else if (isInCommitment) {
      explanation = `O plano ${planName} possui permanência mínima de ${minCommitmentDays} dias. Além do valor proporcional pelos ${daysUsed} dias usados neste ciclo (${fmtBRL(proRataAmount)}), será cobrada uma multa de permanência referente aos ${commitmentDaysRemaining} dias restantes de compromisso (${fmtBRL(commitmentPenalty)}). Total: ${fmtBRL(chargeAmount)}.`;
    } else {
      explanation = `Você já cumpriu o período mínimo de ${minCommitmentDays} dias. Será cobrado ${fmtBRL(chargeAmount)} proporcionalmente pelos ${daysUsed} dias usados neste ciclo.`;
    }

    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted p-3 space-y-2 text-sm">
          <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
            <span>Dias usados no ciclo</span>
            <span className="text-right">{daysUsed} de {cycleDays}</span>
            <span>Valor diário do plano</span>
            <span className="text-right">{fmtBRL(dailyRate)}</span>
            <span>Uso proporcional</span>
            <span className="text-right">{fmtBRL(usedAmount)}</span>
            {minUsageChargePct > 0 && (
              <>
                <span>Cobrança mínima do ciclo ({minUsageChargePct}%)</span>
                <span className="text-right">{fmtBRL(minCharge)}</span>
              </>
            )}
            <span className="font-medium text-foreground">Subtotal proporcional</span>
            <span className="text-right font-medium text-foreground">{fmtBRL(proRataAmount)}</span>
            {isInCommitment && (
              <>
                <span className="text-destructive">Multa de permanência ({commitmentDaysRemaining} dias restantes)</span>
                <span className="text-right text-destructive">{fmtBRL(commitmentPenalty)}</span>
              </>
            )}
          </div>
          <div className="flex justify-between pt-1 border-t border-border/50 font-medium text-sm">
            <span>Valor final de cancelamento</span>
            <span>{fmtBRL(chargeAmount)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground/70 pt-1">
            Valores calculados com base no seu ciclo de assinatura atual.
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
      </div>
    );
  };

  // Retention offer view — shown instead of cancellation summary
  if (showRetention && retention) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              {retention.headline}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-foreground">{retention.message}</p>
                <div className="rounded-lg bg-primary/10 border border-primary/30 p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{retention.discount_label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{retention.duration_label}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao aceitar, sua assinatura continuará ativa e o desconto será aplicado automaticamente na próxima fatura.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="ghost"
              onClick={handleDeclineCoupon}
              disabled={applyingCoupon}
              className="text-muted-foreground hover:text-foreground"
            >
              Não, quero cancelar mesmo assim
            </Button>
            <Button
              onClick={handleAcceptCoupon}
              disabled={applyingCoupon}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {applyingCoupon ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
              Aceitar oferta e continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar Assinatura — {planName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {renderBody()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Cancellation reason — optional, helps the platform improve */}
        {preview && !error && (
          <div className="space-y-3 pt-2 border-t border-border/40">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-xs font-medium">
                Motivo do cancelamento <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger id="cancel-reason" className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um motivo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {CANCELLATION_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-details" className="text-xs font-medium">
                Comentário <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="cancel-details"
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value.slice(0, 500))}
                placeholder="Conte o que poderíamos melhorar..."
                rows={2}
                className="text-sm resize-none"
              />
              <p className="text-[10px] text-muted-foreground/70 text-right">{reasonDetails.length}/500</p>
            </div>
            {offerEligible && reasonCode && (
              <div className="rounded-md bg-primary/10 border border-primary/30 p-2 flex items-center gap-2 text-xs text-foreground">
                <Gift className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Temos uma oferta especial para você. Continue para vê-la antes de confirmar.</span>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || previewLoading || !preview}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {offerEligible && reasonCode ? "Continuar" : "Confirmar Cancelamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
