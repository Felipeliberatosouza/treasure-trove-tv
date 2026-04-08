import { useEffect, useState } from "react";
import { usePlatformSettings, HeroBannerSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

const SettingsHeroBanner = () => {
  const { data, loading, update } = usePlatformSettings("hero_banner");
  const [form, setForm] = useState<HeroBannerSettings>({
    title: "", subtitle: "", cta_text: "", cta_link: "",
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
        <Label>Título Principal</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <Label>Subtítulo</Label>
        <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
      </div>
      <div>
        <Label>Texto do Botão (CTA)</Label>
        <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
      </div>
      <div>
        <Label>Link do Botão (CTA)</Label>
        <Input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="/cadastro/aluno" />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsHeroBanner;
