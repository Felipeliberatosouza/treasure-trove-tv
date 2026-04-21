import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  AulaParticularConfigSettings,
  DEFAULT_AULA_PARTICULAR_CONFIG,
  LateCancelFeeType,
} from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Clock, Percent, Users, GraduationCap, BellRing, X } from "lucide-react";
import { toast } from "sonner";

const SettingsAulaParticular = () => {
  const { data, loading, update } = usePlatformSettings("aula_particular_config");
  const [form, setForm] = useState<AulaParticularConfigSettings>(
    DEFAULT_AULA_PARTICULAR_CONFIG
  );
  const [saving, setSaving] = useState(false);
  const [newReminder, setNewReminder] = useState<string>("");

  useEffect(() => {
    if (data) {
      setForm({ ...DEFAULT_AULA_PARTICULAR_CONFIG, ...(data as AulaParticularConfigSettings) });
    }
  }, [data]);

  const splitTotal = (form.fee_split_platform_pct ?? 0) + (form.fee_split_teacher_pct ?? 0);
  const splitInvalid = splitTotal !== 100;

  const handleSave = async () => {
    if (form.free_cancel_window_hours < 0) {
      toast.error("A janela de cancelamento não pode ser negativa.");
      return;
    }
    if (form.late_cancel_fee_value < 0) {
      toast.error("O valor da taxa não pode ser negativo.");
      return;
    }
    if (form.late_cancel_fee_type === "percentage" && form.late_cancel_fee_value > 100) {
      toast.error("A taxa percentual não pode ser maior que 100%.");
      return;
    }
    if (splitInvalid) {
      toast.error(`A soma da divisão deve ser 100% (atual: ${splitTotal}%).`);
      return;
    }
    if (form.reminder_windows_hours.some((h) => h <= 0 || h > 168)) {
      toast.error("As janelas de lembrete devem estar entre 1h e 168h (7 dias).");
      return;
    }
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  const addReminder = () => {
    const n = parseInt(newReminder, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 168) {
      toast.error("Informe um valor entre 1 e 168 horas.");
      return;
    }
    if (form.reminder_windows_hours.includes(n)) {
      toast.error("Essa janela já foi adicionada.");
      return;
    }
    setForm({
      ...form,
      reminder_windows_hours: [...form.reminder_windows_hours, n].sort((a, b) => b - a),
    });
    setNewReminder("");
  };

  const removeReminder = (h: number) => {
    setForm({
      ...form,
      reminder_windows_hours: form.reminder_windows_hours.filter((x) => x !== h),
    });
  };

  const upd = <K extends keyof AulaParticularConfigSettings>(
    key: K,
    value: AulaParticularConfigSettings[K]
  ) => setForm({ ...form, [key]: value });

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display text-base font-semibold flex items-center gap-2 mb-1">
          <GraduationCap className="h-4 w-4 text-primary" /> Aula Particular
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure as regras gerais para o produto <strong>Aula Particular</strong>: janela de
          cancelamento sem custo, taxa de cancelamento tardio e como ela é dividida entre
          plataforma e professor.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h4 className="font-display text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Janela de cancelamento sem custo
        </h4>
        <div>
          <Label>Horas de antecedência mínima</Label>
          <Input
            type="number"
            min={0}
            max={168}
            value={form.free_cancel_window_hours}
            onChange={(e) =>
              upd("free_cancel_window_hours", parseInt(e.target.value) || 0)
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Cancelamentos feitos com pelo menos <strong>{form.free_cancel_window_hours}h</strong>{" "}
            de antecedência são gratuitos. Abaixo disso, a taxa abaixo é cobrada.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h4 className="font-display text-sm font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" /> Taxa de cancelamento tardio
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo de taxa</Label>
            <Select
              value={form.late_cancel_fee_type}
              onValueChange={(v) => upd("late_cancel_fee_type", v as LateCancelFeeType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentual do valor da aula</SelectItem>
                <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>
              {form.late_cancel_fee_type === "percentage"
                ? "Percentual (%)"
                : "Valor em R$"}
            </Label>
            <Input
              type="number"
              min={0}
              max={form.late_cancel_fee_type === "percentage" ? 100 : undefined}
              step={form.late_cancel_fee_type === "percentage" ? 1 : 0.01}
              value={form.late_cancel_fee_value}
              onChange={(e) =>
                upd("late_cancel_fee_value", parseFloat(e.target.value) || 0)
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {form.late_cancel_fee_type === "percentage"
            ? `Será cobrado ${form.late_cancel_fee_value}% do valor da aula como taxa.`
            : `Será cobrado um valor fixo de R$ ${form.late_cancel_fee_value.toFixed(2)} como taxa.`}
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h4 className="font-display text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Divisão da taxa
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Plataforma (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.fee_split_platform_pct}
              onChange={(e) =>
                upd("fee_split_platform_pct", parseInt(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <Label>Professor (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.fee_split_teacher_pct}
              onChange={(e) =>
                upd("fee_split_teacher_pct", parseInt(e.target.value) || 0)
              }
            />
          </div>
        </div>
        <p
          className={`text-xs ${
            splitInvalid ? "text-destructive font-medium" : "text-muted-foreground"
          }`}
        >
          Soma atual: <strong>{splitTotal}%</strong>{" "}
          {splitInvalid && "— a soma deve ser exatamente 100%."}
        </p>
      </div>

      <Button onClick={handleSave} disabled={saving || splitInvalid}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar configurações"}
      </Button>
    </div>
  );
};

export default SettingsAulaParticular;
