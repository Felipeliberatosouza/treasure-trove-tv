import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Save, Plus, Trash2, Sparkles, Users, Clock, Percent, Gift } from "lucide-react";
import { toast } from "sonner";
import {
  CashbackProgramConfig,
  DEFAULT_CASHBACK_CONFIG,
  CashbackTier,
  ReferralAccessGrants,
  REFERRAL_ACCESS_LABELS,
  DEFAULT_REFERRAL_ACCESS_GRANTS,
} from "@/hooks/useCashback";

const SettingsCashback = () => {
  const [cfg, setCfg] = useState<CashbackProgramConfig>(DEFAULT_CASHBACK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "cashback_program")
        .maybeSingle();
      if (data?.value) {
        setCfg({ ...DEFAULT_CASHBACK_CONFIG, ...(data.value as Partial<CashbackProgramConfig>) });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const sorted = [...cfg.tiers].sort((a, b) => a.min_spent_12m - b.min_spent_12m);
    const payload = { ...cfg, tiers: sorted };
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "cashback_program", value: payload as never }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar configurações");
    } else {
      toast.success("Programa de cashback atualizado");
      setCfg(payload);
    }
  };

  const updateTier = (i: number, patch: Partial<CashbackTier>) => {
    const next = [...cfg.tiers];
    next[i] = { ...next[i], ...patch };
    setCfg({ ...cfg, tiers: next });
  };

  const addTier = () => {
    setCfg({
      ...cfg,
      tiers: [...cfg.tiers, { id: `tier_${Date.now()}`, name: "Novo Nível", min_spent_12m: 0, percent: 1 }],
    });
  };

  const removeTier = (i: number) =>
    setCfg({ ...cfg, tiers: cfg.tiers.filter((_, idx) => idx !== i) });

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label className="font-medium">Programa de Cashback ativo</Label>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Quando desativado, novas compras não geram cashback e indicações ficam pausadas. Saldos existentes seguem disponíveis para uso.
        </p>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Carência, validade e regras de uso</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Carência (dias)</Label>
            <Input type="number" min={0} value={cfg.grace_period_days}
              onChange={(e) => setCfg({ ...cfg, grace_period_days: Math.max(0, parseInt(e.target.value) || 0) })} />
            <p className="text-xs text-muted-foreground mt-1">Dias antes do saldo virar disponível.</p>
          </div>
          <div>
            <Label>Validade (dias)</Label>
            <Input type="number" min={0} value={cfg.validity_days}
              onChange={(e) => setCfg({ ...cfg, validity_days: Math.max(0, parseInt(e.target.value) || 0) })} />
            <p className="text-xs text-muted-foreground mt-1">Após a liberação, expira em X dias.</p>
          </div>
          <div>
            <Label>% máximo do checkout</Label>
            <Input type="number" min={0} max={100} value={cfg.max_checkout_pct}
              onChange={(e) => setCfg({ ...cfg, max_checkout_pct: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} />
            <p className="text-xs text-muted-foreground mt-1">Quanto da compra pode ser pago com cashback.</p>
          </div>
          <div>
            <Label>Compra mínima (R$)</Label>
            <CurrencyInput value={cfg.min_purchase_amount}
              onValueChange={(v) => setCfg({ ...cfg, min_purchase_amount: Math.max(0, v) })} />
            <p className="text-xs text-muted-foreground mt-1">Valor mínimo de compra para gerar cashback.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Programa de Indicação</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>% sobre 1ª compra do indicado</Label>
            <Input type="number" min={0} max={100} step="0.5" value={cfg.referral_percent}
              onChange={(e) => setCfg({ ...cfg, referral_percent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} />
          </div>
          <div>
            <Label>Compra mínima do indicado (R$)</Label>
            <CurrencyInput value={cfg.referral_min_purchase}
              onValueChange={(v) => setCfg({ ...cfg, referral_min_purchase: Math.max(0, v) })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada aluno recebe um código pessoal. Quando alguém se cadastra usando esse código e faz a 1ª compra acima do mínimo, o indicador ganha cashback.
        </p>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Indicação para acesso à IA e conteúdos</h3>
          </div>
          <Switch
            checked={cfg.referral_access_enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, referral_access_enabled: v })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          O aluno envia um convite por e-mail, WhatsApp ou SMS. Quando o amigo acessa a plataforma pelo
          link do convite, o indicador ganha os acessos abaixo — um prêmio por convite, independente de compra.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(Object.keys(REFERRAL_ACCESS_LABELS) as (keyof ReferralAccessGrants)[]).map((k) => (
            <div key={k}>
              <Label className="text-xs">{REFERRAL_ACCESS_LABELS[k]}</Label>
              <Input
                type="number"
                min={0}
                value={cfg.referral_access_grants?.[k] ?? 0}
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    referral_access_grants: {
                      ...DEFAULT_REFERRAL_ACCESS_GRANTS,
                      ...cfg.referral_access_grants,
                      [k]: Math.max(0, parseInt(e.target.value) || 0),
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="max-w-xs">
          <Label>Máximo de indicações premiadas por aluno</Label>
          <Input
            type="number"
            min={0}
            value={cfg.referral_access_max_rewards}
            onChange={(e) =>
              setCfg({ ...cfg, referral_access_max_rewards: Math.max(0, parseInt(e.target.value) || 0) })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">0 = sem limite.</p>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Níveis de fidelidade</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          O nível do aluno é calculado pelo total gasto nos últimos 12 meses. Quanto maior o nível, maior o % de cashback recebido em cada compra.
        </p>
        <div className="space-y-2">
          {cfg.tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-secondary/50">
              <div className="col-span-4">
                <Label className="text-xs">Nome</Label>
                <Input value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Gasto mínimo 12m (R$)</Label>
                <CurrencyInput value={t.min_spent_12m}
                  onValueChange={(v) => updateTier(i, { min_spent_12m: Math.max(0, v) })} />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">% cashback</Label>
                <Input type="number" min={0} max={100} step="0.5" value={t.percent}
                  onChange={(e) => updateTier(i, { percent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) })} />
              </div>
              <div className="col-span-2 flex justify-end">
                {cfg.tiers.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeTier(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar nível
          </Button>
        </div>
      </Card>

      <Button onClick={save} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
};

export default SettingsCashback;