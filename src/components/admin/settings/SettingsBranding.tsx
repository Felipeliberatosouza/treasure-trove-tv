import { useEffect, useState, useRef } from "react";
import {
  usePlatformSettings,
  BrandingSettings,
  type HomeHeadlineAudience,
  type HomeHeadlines,
} from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Upload, X, Image, Download } from "lucide-react";


/** Frases padrão da página inicial (usadas quando nada foi cadastrado). */
const FRASES_PADRAO = [
  "Qual o assunto da sua próxima prova?",
  "Quer gerar documento Word e slides para um trabalho?",
  "",
];

const PUBLICOS: { key: HomeHeadlineAudience; label: string; hint: string }[] = [
  { key: "visitor", label: "Visitante (sem login)", hint: "Quem ainda não entrou na conta." },
  { key: "student", label: "Aluno", hint: "Quem está logado como aluno." },
  { key: "teacher", label: "Professor", hint: "Quem está logado como professor." },
];

const normalizeHeadlines = (value?: HomeHeadlines): HomeHeadlines => ({
  visitor: [0, 1, 2].map((i) => value?.visitor?.[i] ?? FRASES_PADRAO[i] ?? ""),
  student: [0, 1, 2].map((i) => value?.student?.[i] ?? FRASES_PADRAO[i] ?? ""),
  teacher: [0, 1, 2].map((i) => value?.teacher?.[i] ?? FRASES_PADRAO[i] ?? ""),
});

const SettingsBranding = () => {
  const { data, loading, update } = usePlatformSettings("branding");
  const { upload, uploading } = useStorageUpload("platform-assets");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputDarkBgRef = useRef<HTMLInputElement>(null);
  const fileInputLightBgRef = useRef<HTMLInputElement>(null);
  const fileInputFaviconRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BrandingSettings>({
    platform_name: "", slogan: "", logo_url: "",
    home_headlines: normalizeHeadlines(),
    logo_url_dark_bg: "", logo_url_light_bg: "",
    favicon_url: "",
    default_logo_variant: "dark_bg",
    primary_color: "#6366f1", secondary_color: "#8b5cf6", accent_color: "#f59e0b",
    background_color: "#09090f", slogan_color: "#6b7280",
    button_text_color: "#ffffff",
    use_text_logo: false,
    primary_button_bg: "#6366f1",
    primary_button_text: "#ffffff",
    primary_button_hover_bg: "#4f46e5",
    primary_button_hover_text: "#ffffff",
    secondary_button_bg: "#1f2937",
    secondary_button_text: "#ffffff",
    secondary_button_hover_bg: "#111827",
    secondary_button_hover_text: "#ffffff",
    selection_button_bg: "#000000",
    selection_button_text: "#ffffff",
    selection_button_selected_bg: "#3b82f6",
    selection_button_selected_text: "#ffffff",
    input_bg: "#0f172a",
    input_text: "#ffffff",
    input_border: "#334155",
    textarea_bg: "#0f172a",
    textarea_text: "#ffffff",
    textarea_border: "#334155",
    banner_nav_bg: "rgba(0,0,0,0.4)",
    banner_nav_icon: "#ffffff",
    banner_nav_dot_active: "#6366f1",
    banner_nav_dot_idle: "rgba(255,255,255,0.4)",
  });
  const [saving, setSaving] = useState(false);
  const [applyToEmails, setApplyToEmails] = useState(false);

  useEffect(() => {
    if (!data) return;
    // Backfill legacy installs that don't yet have the 4 explicit button colors.
    setForm({
      ...data,
      home_headlines: normalizeHeadlines(data.home_headlines),
      logo_url_dark_bg: data.logo_url_dark_bg || "",
      logo_url_light_bg: data.logo_url_light_bg || "",
      favicon_url: data.favicon_url || "",
      default_logo_variant: data.default_logo_variant === "light_bg" ? "light_bg" : "dark_bg",
      primary_button_bg: data.primary_button_bg || data.primary_color || "#6366f1",
      primary_button_text: data.primary_button_text || data.button_text_color || "#ffffff",
      primary_button_hover_bg: data.primary_button_hover_bg || data.primary_button_bg || data.primary_color || "#4f46e5",
      primary_button_hover_text: data.primary_button_hover_text || data.primary_button_text || data.button_text_color || "#ffffff",
      secondary_button_bg: data.secondary_button_bg || data.secondary_color || "#1f2937",
      secondary_button_text: data.secondary_button_text || data.button_text_color || "#ffffff",
      secondary_button_hover_bg: data.secondary_button_hover_bg || data.secondary_button_bg || data.secondary_color || "#111827",
      secondary_button_hover_text: data.secondary_button_hover_text || data.secondary_button_text || data.button_text_color || "#ffffff",
      selection_button_bg: data.selection_button_bg || "#000000",
      selection_button_text: data.selection_button_text || "#ffffff",
      selection_button_selected_bg: data.selection_button_selected_bg || data.primary_button_bg || data.primary_color || "#3b82f6",
      selection_button_selected_text: data.selection_button_selected_text || data.primary_button_text || "#ffffff",
      input_bg: data.input_bg || "#0f172a",
      input_text: data.input_text || "#ffffff",
      input_border: data.input_border || "#334155",
      textarea_bg: data.textarea_bg || data.input_bg || "#0f172a",
      textarea_text: data.textarea_text || data.input_text || "#ffffff",
      textarea_border: data.textarea_border || data.input_border || "#334155",
      banner_nav_bg: data.banner_nav_bg || "rgba(0,0,0,0.4)",
      banner_nav_icon: data.banner_nav_icon || "#ffffff",
      banner_nav_dot_active: data.banner_nav_dot_active || data.primary_color || "#6366f1",
      banner_nav_dot_idle: data.banner_nav_dot_idle || "rgba(255,255,255,0.4)",
    });
  }, [data]);

  const handleLogoUploadFor = (
    field: "logo_url" | "logo_url_dark_bg" | "logo_url_light_bg",
  ) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `logo/${field}-${Date.now()}.${ext}`;
    const url = await upload(file, path);
    if (url) setForm((prev) => ({ ...prev, [field]: url }));
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

  const handleDownloadFavicon = async () => {
    const url = form.favicon_url;
    if (!url) {
      toast.error("Nenhum favicon configurado para download.");
      return;
    }
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error("Falha ao baixar favicon.");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "favicon.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Download do favicon iniciado!");
    } catch (err) {
      console.error("Favicon download error:", err);
      toast.error("Não foi possível baixar o favicon. Tente abrir a URL manualmente.");
    }
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
        <Label>Domínio Comercial</Label>
        <Input
          value={form.commercial_domain ?? ""}
          onChange={(e) => setForm({ ...form, commercial_domain: e.target.value })}
          placeholder="revisaofacil.com"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Endereço divulgado nos vídeos, nos slides e nos demais conteúdos gerados (professores e IA).
        </p>
      </div>

      {/* ============= Frases da Página Inicial ============= */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Frases da Página Inicial</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Até 3 frases por público, exibidas em rodízio acima da caixa de digitação (troca a cada 5
            segundos). Deixe em branco para não usar a frase. Se todas ficarem em branco, as frases
            padrão são exibidas.
          </p>
        </div>
        {PUBLICOS.map((publico) => (
          <div key={publico.key} className="space-y-2">
            <div>
              <Label>{publico.label}</Label>
              <p className="text-xs text-muted-foreground">{publico.hint}</p>
            </div>
            {[0, 1, 2].map((i) => (
              <Input
                key={i}
                value={form.home_headlines?.[publico.key]?.[i] ?? ""}
                placeholder={`Frase ${i + 1}`}
                onChange={(e) => {
                  const atual = normalizeHeadlines(form.home_headlines);
                  const lista = [...atual[publico.key]];
                  lista[i] = e.target.value;
                  setForm({ ...form, home_headlines: { ...atual, [publico.key]: lista } });
                }}
              />
            ))}
          </div>
        ))}
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

      {/* ============= Gestão de Logomarca ============= */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Image className="h-4 w-4" /> Gestão de Logomarca
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Envie variações da logomarca para serem usadas conforme a cor de fundo da tela.
              A logo padrão é usada quando não há variação específica.
              Quando "Usar título em texto" está ativo, o nome da plataforma aparece em vez da imagem.
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

        {([
          {
            field: "logo_url" as const,
            title: "Logo padrão",
            description:
              "Usada como fallback em toda a plataforma quando não há variação específica para o fundo.",
            previewBg: "bg-muted",
            inputRef: fileInputRef,
          },
          {
            field: "logo_url_dark_bg" as const,
            title: "Logo para fundo escuro",
            description:
              "Use uma versão clara/branca da logomarca. Aplicada automaticamente sobre fundos escuros (cabeçalho, rodapé).",
            previewBg: "bg-slate-900",
            inputRef: fileInputDarkBgRef,
          },
          {
            field: "logo_url_light_bg" as const,
            title: "Logo para fundo claro",
            description:
              "Use uma versão escura/colorida da logomarca. Aplicada automaticamente sobre fundos claros (e-mails, recibos em PDF).",
            previewBg: "bg-white",
            inputRef: fileInputLightBgRef,
          },
        ]).map(({ field, title, description, previewBg, inputRef }) => {
          const url = (form[field] as string) || "";
          return (
            <div key={field} className="space-y-2 rounded-md border border-border p-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
              {url && (
                <div className={`relative inline-block rounded-lg border border-border p-2 ${previewBg}`}>
                  <img src={url} alt={title} className="h-20 max-w-[260px] object-contain" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, [field]: "" })}
                    className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:opacity-80"
                    aria-label={`Remover ${title}`}
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
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? "Enviando..." : "Enviar Imagem"}
                </Button>
                <Input
                  value={url}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  placeholder="ou cole uma URL..."
                  className="flex-1 text-xs"
                />
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUploadFor(field)}
              />
            </div>
          );
        })}

        {/* Selector: qual variação é a padrão do site */}
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Logomarca padrão do site
          </p>
          <p className="text-xs text-muted-foreground">
            Escolha qual das duas variações abaixo será usada como logomarca padrão na barra de navegação, rodapé e demais áreas do site.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {([
              {
                value: "dark_bg" as const,
                label: "Logo para fundo escuro",
                url: form.logo_url_dark_bg,
                previewBg: "bg-slate-900",
              },
              {
                value: "light_bg" as const,
                label: "Logo para fundo claro",
                url: form.logo_url_light_bg,
                previewBg: "bg-white",
              },
            ]).map((opt) => {
              const selected = (form.default_logo_variant || "dark_bg") === opt.value;
              const disabled = !opt.url;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setForm({ ...form, default_logo_variant: opt.value })}
                  className={`flex flex-col items-stretch gap-2 rounded-md border p-2 text-left transition ${
                    selected
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/40"
                  } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className={`flex h-16 items-center justify-center rounded ${opt.previewBg}`}>
                    {opt.url ? (
                      <img src={opt.url} alt={opt.label} className="h-12 max-w-[200px] object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Envie a imagem acima</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{opt.label}</span>
                    {selected && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Padrão
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============= Gestão de Favicon ============= */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Image className="h-4 w-4" /> Gestão de Favicon
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            O <strong>favicon</strong> é o pequeno ícone que aparece na aba do navegador,
            nos favoritos, no histórico e ao adicionar o site à tela inicial do celular.
            Ele funciona como uma abreviação visual da logomarca e ajuda o usuário a
            identificar rapidamente o site entre várias abas abertas.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Envie um arquivo <strong>PNG quadrado</strong> (recomendado 512×512 px) com fundo
            transparente ou sólido. Você pode substituí-lo a qualquer momento — a alteração
            é aplicada automaticamente em toda a plataforma após salvar.
          </p>
        </div>
        {form.favicon_url && (
          <div className="flex items-center gap-3">
            <div className="relative inline-block rounded-lg border border-border p-2 bg-white">
              <img
                src={form.favicon_url}
                alt="Favicon atual"
                className="h-16 w-16 object-contain"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, favicon_url: "" })}
                className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:opacity-80"
                aria-label="Remover favicon"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 rounded bg-slate-900 px-2 py-1">
                <img src={form.favicon_url} alt="" className="h-4 w-4 object-contain" />
                <span className="text-[11px] text-white">Aba do navegador</span>
              </div>
              <div className="flex items-center gap-2 rounded bg-white px-2 py-1 border border-border">
                <img src={form.favicon_url} alt="" className="h-4 w-4 object-contain" />
                <span className="text-[11px] text-slate-900">Fundo claro</span>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputFaviconRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "Enviando..." : form.favicon_url ? "Substituir favicon" : "Enviar favicon (PNG)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!form.favicon_url}
            onClick={handleDownloadFavicon}
          >
            <Download className="h-4 w-4 mr-1" />
            Baixar favicon PNG
          </Button>
          <Input
            value={form.favicon_url || ""}
            onChange={(e) => setForm({ ...form, favicon_url: e.target.value })}
            placeholder="ou cole uma URL do PNG..."
            className="flex-1 text-xs min-w-[200px]"
          />
        </div>
        <input
          ref={fileInputFaviconRef}
          type="file"
          accept="image/png,image/x-icon,image/vnd.microsoft.icon"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ext = file.name.split(".").pop() || "png";
            const path = `favicon/favicon-${Date.now()}.${ext}`;
            const url = await upload(file, path);
            if (url) setForm((prev) => ({ ...prev, favicon_url: url }));
          }}
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
            <div>
              <Label className="text-xs">Cor de fundo (hover)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_button_hover_bg || "#4f46e5"}
                  onChange={(e) => setForm({ ...form, primary_button_hover_bg: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.primary_button_hover_bg || "#4f46e5"}
                  onChange={(e) => setForm({ ...form, primary_button_hover_bg: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor do texto (hover)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_button_hover_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, primary_button_hover_text: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.primary_button_hover_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, primary_button_hover_text: e.target.value })}
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
            <div>
              <Label className="text-xs">Cor de fundo (hover)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondary_button_hover_bg || "#111827"}
                  onChange={(e) => setForm({ ...form, secondary_button_hover_bg: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.secondary_button_hover_bg || "#111827"}
                  onChange={(e) => setForm({ ...form, secondary_button_hover_bg: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Cor do texto (hover)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondary_button_hover_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, secondary_button_hover_text: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.secondary_button_hover_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, secondary_button_hover_text: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização (passe o cursor sobre os botões para ver o estado de hover)</p>
          <div className="flex flex-wrap gap-2 rounded-md bg-muted/30 p-3">
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
              style={{
                background: form.primary_button_bg || "#6366f1",
                color: form.primary_button_text || "#ffffff",
                ["--h-bg" as any]: form.primary_button_hover_bg || "#4f46e5",
                ["--h-fg" as any]: form.primary_button_hover_text || "#ffffff",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = form.primary_button_hover_bg || "#4f46e5";
                e.currentTarget.style.color = form.primary_button_hover_text || "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = form.primary_button_bg || "#6366f1";
                e.currentTarget.style.color = form.primary_button_text || "#ffffff";
              }}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
              style={{ background: form.secondary_button_bg || "#1f2937", color: form.secondary_button_text || "#ffffff" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = form.secondary_button_hover_bg || "#111827";
                e.currentTarget.style.color = form.secondary_button_hover_text || "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = form.secondary_button_bg || "#1f2937";
                e.currentTarget.style.color = form.secondary_button_text || "#ffffff";
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {/* Selection buttons */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Botões de seleção</h3>
          <p className="text-xs text-muted-foreground">
            Aplicado a todos os botões de múltipla escolha do projeto (ex.: áreas de especialização), com cores distintas para o estado inativo e o estado selecionado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Idle */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Não selecionado</p>
            <div>
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.selection_button_bg || "#000000"}
                  onChange={(e) => setForm({ ...form, selection_button_bg: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.selection_button_bg || "#000000"}
                  onChange={(e) => setForm({ ...form, selection_button_bg: e.target.value })}
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
                  value={form.selection_button_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, selection_button_text: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.selection_button_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, selection_button_text: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Selected */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selecionado</p>
            <div>
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.selection_button_selected_bg || "#3b82f6"}
                  onChange={(e) => setForm({ ...form, selection_button_selected_bg: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.selection_button_selected_bg || "#3b82f6"}
                  onChange={(e) => setForm({ ...form, selection_button_selected_bg: e.target.value })}
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
                  value={form.selection_button_selected_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, selection_button_selected_text: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={form.selection_button_selected_text || "#ffffff"}
                  onChange={(e) => setForm({ ...form, selection_button_selected_text: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
          <div className="flex flex-wrap gap-2 rounded-md bg-muted/30 p-3">
            <span
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: form.selection_button_bg || "#000000", color: form.selection_button_text || "#ffffff" }}
            >
              Matemática
            </span>
            <span
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: form.selection_button_selected_bg || "#3b82f6", color: form.selection_button_selected_text || "#ffffff" }}
            >
              Português (selecionado)
            </span>
            <span
              className="rounded-md px-3 py-1.5 text-xs font-medium"
              style={{ background: form.selection_button_bg || "#000000", color: form.selection_button_text || "#ffffff" }}
            >
              História
            </span>
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Campos de digitação</h3>
          <p className="text-xs text-muted-foreground">
            Aplicado a todos os campos de uma linha (nome, e-mail, busca, etc.) em toda a plataforma.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            ["input_bg", "Cor de fundo", "#0f172a"],
            ["input_text", "Cor do texto", "#ffffff"],
            ["input_border", "Cor da borda", "#334155"],
          ] as const).map(([k, label, fallback]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(form[k] as string) || fallback}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={(form[k] as string) || fallback}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
          <input
            type="text"
            placeholder="Digite algo..."
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: form.input_bg || "#0f172a",
              color: form.input_text || "#ffffff",
              border: `1px solid ${form.input_border || "#334155"}`,
            }}
          />
        </div>
      </div>

      {/* Textareas */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Caixas de texto</h3>
          <p className="text-xs text-muted-foreground">
            Aplicado a todas as caixas de texto longas (observações, descrições, comentários, mensagens) em toda a plataforma.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            ["textarea_bg", "Cor de fundo", "#0f172a"],
            ["textarea_text", "Cor do texto", "#ffffff"],
            ["textarea_border", "Cor da borda", "#334155"],
          ] as const).map(([k, label, fallback]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(form[k] as string) || fallback}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={(form[k] as string) || fallback}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="flex-1 text-xs"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
          <textarea
            placeholder="Escreva uma observação..."
            rows={3}
            className="w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              background: form.textarea_bg || "#0f172a",
              color: form.textarea_text || "#ffffff",
              border: `1px solid ${form.textarea_border || "#334155"}`,
            }}
          />
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

      {/* Banner navigation */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Botões de passagem dos banners</h3>
          <p className="text-xs text-muted-foreground">
            Cores das setas (anterior/próximo) e dos indicadores (pontinhos) exibidos no banner principal e no banner secundário.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ["banner_nav_bg", "Fundo das setas", "rgba(0,0,0,0.4)"],
            ["banner_nav_icon", "Cor do ícone (seta)", "#ffffff"],
            ["banner_nav_dot_active", "Indicador ativo", "#6366f1"],
            ["banner_nav_dot_idle", "Indicador inativo", "rgba(255,255,255,0.4)"],
          ] as const).map(([k, label, fallback]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(form[k] as string)?.startsWith("#") ? (form[k] as string) : "#000000"}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="w-9 h-9 rounded cursor-pointer border-0"
                />
                <Input
                  value={(form[k] as string) || fallback}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="flex-1 text-xs"
                  placeholder={fallback}
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Pré-visualização</p>
          <div
            className="relative h-28 rounded-md overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--secondary)) 100%)",
            }}
          >
            <button
              type="button"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-2 backdrop-blur"
              style={{ background: form.banner_nav_bg, color: form.banner_nav_icon }}
              aria-label="Anterior"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 backdrop-blur"
              style={{ background: form.banner_nav_bg, color: form.banner_nav_icon }}
              aria-label="Próximo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: i === 0 ? 32 : 8,
                    background: i === 0 ? form.banner_nav_dot_active : form.banner_nav_dot_idle,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsBranding;
