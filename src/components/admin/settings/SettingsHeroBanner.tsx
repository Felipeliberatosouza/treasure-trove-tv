import { useEffect, useState, useRef } from "react";
import { usePlatformSettings, HeroBannerSettings } from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Upload, X } from "lucide-react";

interface HeroBannerSettingsExtended extends HeroBannerSettings {
  banner_image_url?: string;
}

const SettingsHeroBanner = () => {
  const { data, loading, update } = usePlatformSettings("hero_banner");
  const { upload, uploading } = useStorageUpload("platform-assets");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<HeroBannerSettingsExtended>({
    title: "", subtitle: "", cta_text: "", cta_link: "", banner_image_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ banner_image_url: "", ...data } as HeroBannerSettingsExtended);
  }, [data]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `banner/banner-${Date.now()}.${ext}`;
    const url = await upload(file, path);
    if (url) setForm((prev) => ({ ...prev, banner_image_url: url }));
  };

  const handleSave = async () => {
    setSaving(true);
    await update(form as unknown as HeroBannerSettings);
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

      {/* Banner image upload */}
      <div className="space-y-2">
        <Label>Imagem do Banner</Label>
        {form.banner_image_url && (
          <div className="relative inline-block rounded-lg border border-border bg-muted/30 p-2">
            <img src={form.banner_image_url} alt="Banner" className="h-24 max-w-[300px] object-cover rounded" />
            <button
              onClick={() => setForm({ ...form, banner_image_url: "" })}
              className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:opacity-80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "Enviando..." : "Enviar Imagem"}
          </Button>
          <Input
            value={form.banner_image_url || ""}
            onChange={(e) => setForm({ ...form, banner_image_url: e.target.value })}
            placeholder="ou cole uma URL..."
            className="flex-1 text-xs"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerUpload}
        />
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
