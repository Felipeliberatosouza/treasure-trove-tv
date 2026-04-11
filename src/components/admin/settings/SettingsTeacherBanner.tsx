import { useEffect, useState } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useStorageUpload } from "@/hooks/useStorageUpload";

interface TeacherBannerSettings {
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  background_image_url: string;
}

const defaults: TeacherBannerSettings = {
  title: "Você é Professor?",
  subtitle: "Faça parte da Revisão Fácil! Ganhe conosco!",
  cta_text: "Cadastre-se como Professor",
  cta_link: "/cadastro-professor",
  background_image_url: "",
};

const SettingsTeacherBanner = () => {
  const { data, loading, update } = usePlatformSettings("teacher_banner" as any);
  const settings = data as unknown as TeacherBannerSettings | null;
  const [form, setForm] = useState<TeacherBannerSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const { uploading, upload } = useStorageUpload("platform-assets");

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await update(form as any);
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "platform-assets", `teacher-banner/${Date.now()}-${file.name}`);
    if (url) setForm((f) => ({ ...f, background_image_url: url }));
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <Label>Título</Label>
        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </div>
      <div>
        <Label>Subtítulo / Slogan</Label>
        <Input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
      </div>
      <div>
        <Label>Texto do Botão (CTA)</Label>
        <Input value={form.cta_text} onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))} />
      </div>
      <div>
        <Label>Link do Botão</Label>
        <Input value={form.cta_link} onChange={(e) => setForm((f) => ({ ...f, cta_link: e.target.value }))} />
      </div>
      <div>
        <Label>Imagem de Fundo</Label>
        <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
        {form.background_image_url && (
          <img src={form.background_image_url} alt="Preview" className="mt-2 rounded-lg max-h-32 object-cover w-full" />
        )}
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar
      </Button>
    </div>
  );
};

export default SettingsTeacherBanner;
