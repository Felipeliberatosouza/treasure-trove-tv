import { useEffect, useState, useRef } from "react";
import { usePlatformSettings, BrandingSettings } from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Upload, X, Image } from "lucide-react";

const SettingsBranding = () => {
  const { data, loading, update } = usePlatformSettings("branding");
  const { upload, uploading } = useStorageUpload("platform-assets");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BrandingSettings>({
    platform_name: "", slogan: "", logo_url: "",
    primary_color: "#6366f1", secondary_color: "#8b5cf6", accent_color: "#f59e0b",
    background_color: "#09090f", slogan_color: "#6b7280",
    button_text_color: "#ffffff",
    use_text_logo: false,
    primary_button_bg: "#6366f1",
    primary_button_text: "#ffffff",
    secondary_button_bg: "#1f2937",
    secondary_button_text: "#ffffff",
  });
  const [saving, setSaving] = useState(false);
  const [applyToEmails, setApplyToEmails] = useState(false);

  useEffect(() => {
    if (!data) return;
    // Backfill legacy installs that don't yet have the 4 explicit button colors.
    setForm({
      ...data,
      primary_button_bg: data.primary_button_bg || data.primary_color || "#6366f1",
      primary_button_text: data.primary_button_text || data.button_text_color || "#ffffff",
      secondary_button_bg: data.secondary_button_bg || data.secondary_color || "#1f2937",
      secondary_button_text: data.secondary_button_text || data.button_text_color || "#ffffff",
    });
  }, [data]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `logo/logo-${Date.now()}.${ext}`;
    const url = await upload(file, path);
    if (url) setForm((prev) => ({ ...prev, logo_url: url }));
  };

  const handleSave = async () => {
    setSaving(true);
    await update(form);
    if (applyToEmails) {
      const emailStyle = {
        logo_url: form.logo_url || null,
        use_uploaded_logo: !!form.logo_url,
        heading_color: form.secondary_color,
        button_color: form.primary_button_bg || form.primary_color,
        button_text_color: form.primary_button_text || form.button_text_color || "#ffffff",
        link_color: form.primary_color,
        text_color: form.background_color,
        slogan_color: form.slogan_color,
      };
      const { error } = await supabase
        .from("email_templates")
        .update(emailStyle as any)
        .not("id", "is", null);
      if (error) {
        toast.error("Identidade salva, mas falha ao aplicar aos e-mails.");
      } else {
        toast.success("Identidade visual aplicada a todos os e-mails!");
      }
    }
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label>Nome da Plataforma</Label>
        <Input value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })} />
      </div>
      <div>
        <Label>Slogan</Label>
        <Input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} />
      </div>
      <div>
        <Label>Cor do Slogan</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.slogan_color || "#6b7280"}
            onChange={(e) => setForm({ ...form, slogan_color: e.target.value })}
            className="w-10 h-10 rounded cursor-pointer border-0"
          />
          <Input
            value={form.slogan_color || "#6b7280"}
            onChange={(e) => setForm({ ...form, slogan_color: e.target.value })}
            className="flex-1"
            maxLength={7}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Aplicada ao slogan exibido no cabeçalho dos e-mails (logo abaixo da logomarca).
        </p>
      </div>

      {/* Logo upload */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Label>Logotipo</Label>
            <p className="text-xs text-muted-foreground">
              Quando "Usar título em texto" está ativo, o nome da plataforma aparece em vez da imagem.
              Sem upload, o nome em texto é exibido automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              id="use-text-logo"
              checked={!!form.use_text_logo}
              onCheckedChange={(v) => setForm({ ...form, use_text_logo: v })}
            />
            <Label htmlFor="use-text-logo" className="cursor-pointer text-xs">
              Usar título em texto
            </Label>
          </div>
        </div>
        {form.logo_url && (
          <div className="relative inline-block rounded-lg border border-border p-2">
            <img src={form.logo_url} alt="Logo" className="h-20 max-w-[260px] object-contain" />
            <button
              onClick={() => setForm({ ...form, logo_url: "" })}
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
            value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            placeholder="ou cole uma URL..."
            className="flex-1 text-xs"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoUpload}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cor Primária</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0" />
            <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="flex-1" />
          </div>
        </div>
        <div>
          <Label>Cor Secundária</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0" />
            <Input value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="flex-1" />
          </div>
        </div>
        <div>
          <Label>Cor de Destaque</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0" />
            <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="flex-1" />
          </div>
        </div>
        <div>
          <Label>Plano de Fundo</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.background_color} onChange={(e) => setForm({ ...form, background_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0" />
            <Input value={form.background_color} onChange={(e) => setForm({ ...form, background_color: e.target.value })} className="flex-1" />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Botões</h3>
          <p className="text-xs text-muted-foreground">
            Em telas com dois botões (ex.: "Confirmar" + "Cancelar"), o principal usa a cor primária e o secundário usa a alternativa, garantindo contraste visual.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Botão principal</p>
            <div>
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_button_bg || "#6366f1"}
                  onChange={(e) => setForm({ ...form, primary_button_bg: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.primary_button_bg || "#6366f1"}
                  onChange={(e) => setForm({ ...form, primary_button_bg: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_button_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, primary_button_text: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.primary_button_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, primary_button_text: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Secondary */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Botão secundário</p>
            <div>
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondary_button_bg || "#1f2937"}
                  onChange={(e) => setForm({ ...form, secondary_button_bg: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.secondary_button_bg || "#1f2937"}
                  onChange={(e) => setForm({ ...form, secondary_button_bg: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor do texto</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondary_button_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, secondary_button_text: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.secondary_button_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, secondary_button_text: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
          <div className="flex flex-wrap gap-2 rounded-md bg-muted/30 p-3">
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-semibold shadow-sm"
              style={{ background: form.primary_button_bg || "#6366f1", color: form.primary_button_text || "#ffffff" }}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-semibold shadow-sm"
              style={{ background: form.secondary_button_bg || "#1f2937", color: form.secondary_button_text || "#ffffff" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <Switch
          id="apply-to-emails"
          checked={applyToEmails}
          onCheckedChange={setApplyToEmails}
        />
        <div className="flex-1">
          <Label htmlFor="apply-to-emails" className="cursor-pointer text-sm font-medium">
            Usar esta identidade visual em todos os e-mails
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Ao salvar, a logomarca e as cores (primária, secundária, plano de fundo) serão aplicadas a <strong>todos</strong> os templates de e-mail, sobrescrevendo configurações individuais de cor e logo.
          </p>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsBranding;
