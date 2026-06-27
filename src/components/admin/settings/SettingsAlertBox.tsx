import { useEffect, useState } from "react";
import { usePlatformSettings, AlertBoxSettings, DEFAULT_ALERT_BOX_SETTINGS } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, AlertTriangle } from "lucide-react";

const ColorField = ({ label, value, onChange, help }: { label: string; value: string; onChange: (v: string) => void; help?: string }) => (
  <div>
    <Label className="text-sm">{label}</Label>
    <div className="flex items-center gap-2 mt-1">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent"
      />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[140px]" />
    </div>
    {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
  </div>
);

const SettingsAlertBox = () => {
  const { data, loading, update } = usePlatformSettings("alert_box");
  const [form, setForm] = useState<AlertBoxSettings>(DEFAULT_ALERT_BOX_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_ALERT_BOX_SETTINGS, ...data });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold">Caixa de Alerta de Pendências</h3>
            <p className="text-xs text-muted-foreground">
              Define as cores da caixa que lista itens pendentes nos formulários (ex.: cadastro de alunos).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorField label="Cor de fundo" value={form.bg_color} onChange={(v) => setForm({ ...form, bg_color: v })} />
          <ColorField label="Cor da borda" value={form.border_color} onChange={(v) => setForm({ ...form, border_color: v })} />
          <ColorField label="Cor do título" value={form.title_color} onChange={(v) => setForm({ ...form, title_color: v })} />
          <ColorField label="Cor dos itens" value={form.item_color} onChange={(v) => setForm({ ...form, item_color: v })} />
        </div>

        <div>
          <Label className="text-sm">Pré-visualização</Label>
          <div
            className="mt-2 rounded-md border px-3 py-3 text-xs"
            style={{
              backgroundColor: form.bg_color,
              borderColor: form.border_color,
            }}
          >
            <p className="font-medium mb-2 text-center" style={{ color: form.title_color }}>
              Para liberar a verificação do celular, ajuste os itens abaixo:
            </p>
            <ul className="list-disc list-inside space-y-1" style={{ color: form.item_color }}>
              <li>CPF já cadastrado na plataforma</li>
              <li>E-mail já cadastrado na plataforma</li>
            </ul>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};

export default SettingsAlertBox;