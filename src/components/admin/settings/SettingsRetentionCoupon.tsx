import { useEffect, useState } from "react";
import { usePlatformSettings, RetentionCouponSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Gift } from "lucide-react";
import { CANCELLATION_REASONS } from "@/components/dashboard/subscription/CancelSubscriptionModal";

const DEFAULTS: RetentionCouponSettings = {
  enabled: false,
  coupon_id: "",
  discount_label: "20% de desconto",
  duration_label: "nos próximos 3 meses",
  eligible_reasons: ["too_expensive"],
  headline: "Espera! Temos uma oferta para você",
  message: "Sabemos que o preço pesa. Que tal continuar com um desconto especial?",
  cooldown_months: 12,
};

/**
 * Admin section for the retention coupon offered before a student finalizes
 * their cancellation. The admin chooses which Stripe coupon (already created
 * in Stripe) to apply, the user-facing copy, and which cancellation reasons
 * trigger the offer.
 */
export default function SettingsRetentionCoupon() {
  const { data, loading, update } = usePlatformSettings("retention_coupon");
  const [cfg, setCfg] = useState<RetentionCouponSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setCfg({ ...DEFAULTS, ...data });
  }, [data]);

  const toggleReason = (code: string, checked: boolean) => {
    setCfg((c) => ({
      ...c,
      eligible_reasons: checked
        ? Array.from(new Set([...(c.eligible_reasons || []), code]))
        : (c.eligible_reasons || []).filter((r) => r !== code),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await update(cfg);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-semibold">Cupom de Retenção</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Oferta automática exibida ao aluno antes de confirmar o cancelamento.
          Crie o cupom previamente no Stripe e informe o ID aqui.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Switch
          id="retention-enabled"
          checked={cfg.enabled}
          onCheckedChange={(v) => setCfg((c) => ({ ...c, enabled: v }))}
        />
        <Label htmlFor="retention-enabled" className="cursor-pointer">
          Ativar oferta de retenção
        </Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">ID do cupom no Stripe</Label>
          <Input
            value={cfg.coupon_id}
            onChange={(e) => setCfg((c) => ({ ...c, coupon_id: e.target.value.trim() }))}
            placeholder="ex: SAVE20"
          />
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Crie o cupom no painel do Stripe e cole o ID aqui.
          </p>
        </div>
        <div>
          <Label className="text-xs">Texto do desconto (exibido ao aluno)</Label>
          <Input
            value={cfg.discount_label}
            onChange={(e) => setCfg((c) => ({ ...c, discount_label: e.target.value }))}
            placeholder="ex: 20% de desconto"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Duração do desconto (texto livre)</Label>
          <Input
            value={cfg.duration_label}
            onChange={(e) => setCfg((c) => ({ ...c, duration_label: e.target.value }))}
            placeholder="ex: nos próximos 3 meses"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Período de carência após aceitar (meses)</Label>
          <Input
            type="number"
            min={0}
            max={120}
            value={Number.isFinite(cfg.cooldown_months) ? cfg.cooldown_months : 12}
            onChange={(e) => {
              const raw = parseInt(e.target.value, 10);
              const v = Number.isFinite(raw) && raw >= 0 ? raw : 0;
              setCfg((c) => ({ ...c, cooldown_months: v }));
            }}
            placeholder="ex: 12"
            className="max-w-[160px]"
          />
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Após aceitar o cupom, o aluno só voltará a receber a oferta depois deste período.
            Use <strong>0</strong> para bloquear permanentemente (oferta única por aluno).
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Título da oferta</Label>
          <Input
            value={cfg.headline}
            onChange={(e) => setCfg((c) => ({ ...c, headline: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Mensagem da oferta</Label>
          <Textarea
            value={cfg.message}
            onChange={(e) => setCfg((c) => ({ ...c, message: e.target.value }))}
            rows={2}
            className="resize-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Motivos elegíveis para a oferta</Label>
        <p className="text-[11px] text-muted-foreground">
          A oferta só aparece quando o aluno selecionar um destes motivos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3">
          {CANCELLATION_REASONS.map((r) => {
            const checked = (cfg.eligible_reasons || []).includes(r.value);
            return (
              <label
                key={r.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleReason(r.value, v === true)}
                />
                {r.label}
              </label>
            );
          })}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configuração"}
      </Button>
    </div>
  );
}
