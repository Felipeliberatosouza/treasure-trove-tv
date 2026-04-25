import { useEffect, useState } from "react";
import { usePlatformSettings, VideoPricingSettings } from "@/hooks/usePlatformSettings";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";

const SettingsVideoPricing = () => {
  const { data, loading, update } = usePlatformSettings("video_pricing");
  const [form, setForm] = useState<VideoPricingSettings>({
    default_lesson_price: 9.90, default_exam_solution_price: 14.90, allow_free_content: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Preço Padrão de Aulas (R$)</Label>
        <CurrencyInput
          value={form.default_lesson_price}
          onValueChange={(v) => setForm({ ...form, default_lesson_price: v })}
        />
      </div>
      <div>
        <Label>Preço Padrão de Resoluções de Provas (R$)</Label>
        <CurrencyInput
          value={form.default_exam_solution_price}
          onValueChange={(v) => setForm({ ...form, default_exam_solution_price: v })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.allow_free_content} onCheckedChange={(v) => setForm({ ...form, allow_free_content: v })} />
        <Label className="cursor-pointer">Permitir conteúdos gratuitos</Label>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsVideoPricing;
