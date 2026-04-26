import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  FooterSettings,
  DEFAULT_FOOTER_SETTINGS,
} from "@/hooks/usePlatformSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

const SettingsFooter = () => {
  const { data, loading, update } = usePlatformSettings("footer");
  const [form, setForm] = useState<FooterSettings>(DEFAULT_FOOTER_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_FOOTER_SETTINGS, ...data });
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const linkRow = (
    labelKey: keyof FooterSettings,
    urlKey: keyof FooterSettings,
    title: string,
  ) => (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>{title} — Texto</Label>
        <Input
          value={form[labelKey] as string}
          onChange={(e) => setForm({ ...form, [labelKey]: e.target.value })}
        />
      </div>
      <div>
        <Label>{title} — Link</Label>
        <Input
          value={form[urlKey] as string}
          onChange={(e) => setForm({ ...form, [urlKey]: e.target.value })}
          placeholder="/sobre"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Edite os textos e links exibidos no rodapé da plataforma. Use{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{platform_name}"}</code>{" "}
        no copyright para inserir o nome da plataforma automaticamente.
      </p>

      <div>
        <Label>Texto de Copyright</Label>
        <Input
          value={form.copyright}
          onChange={(e) => setForm({ ...form, copyright: e.target.value })}
          placeholder="© 2026 {platform_name}. Todos os direitos reservados."
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Links do rodapé</h3>
        {linkRow("about_label", "about_url", "Sobre")}
        {linkRow("terms_label", "terms_url", "Termos")}
        {linkRow("privacy_label", "privacy_url", "Privacidade")}
        {linkRow("contact_label", "contact_url", "Contato")}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};

export default SettingsFooter;