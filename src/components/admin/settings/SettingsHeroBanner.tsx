import { useEffect, useState, useRef } from "react";
import {
  usePlatformSettings,
  HeroBannerSettings,
  HeroBannerCarouselSettings,
  normalizeHeroCarousel,
  emptyHeroSlide,
  MAX_HERO_SLIDES,
  DEFAULT_HERO_AUTOPLAY_SECONDS,
} from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Save,
  Upload,
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  EyeOff,
} from "lucide-react";

type HeroSettingsKey =
  | "hero_banner"
  | "hero_banner_student"
  | "hero_banner_teacher"
  | "secondary_banner"
  | "secondary_banner_student"
  | "secondary_banner_teacher";

interface SettingsHeroBannerProps {
  settingsKey?: HeroSettingsKey;
  description?: string;
}

const SettingsHeroBanner = ({
  settingsKey = "hero_banner",
  description,
}: SettingsHeroBannerProps) => {
  const { data, loading, update } = usePlatformSettings(settingsKey);
  const { upload, uploading } = useStorageUpload("platform-assets");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [carousel, setCarousel] = useState<HeroBannerCarouselSettings>({
    slides: [emptyHeroSlide()],
    autoplay_seconds: DEFAULT_HERO_AUTOPLAY_SECONDS,
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const normalized = normalizeHeroCarousel(data);
    setCarousel(normalized);
    setActiveIndex((i) => Math.min(i, normalized.slides.length - 1));
  }, [data]);

  const activeSlide = carousel.slides[activeIndex] || carousel.slides[0];

  const updateActiveSlide = (patch: Partial<HeroBannerSettings>) => {
    setCarousel((prev) => ({
      ...prev,
      slides: prev.slides.map((s, i) => (i === activeIndex ? { ...s, ...patch } : s)),
    }));
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `${settingsKey}/banner-${Date.now()}-${activeIndex}.${ext}`;
    const url = await upload(file, path);
    if (url) updateActiveSlide({ banner_image_url: url });
  };

  const addSlide = () => {
    if (carousel.slides.length >= MAX_HERO_SLIDES) return;
    setCarousel((prev) => ({ ...prev, slides: [...prev.slides, emptyHeroSlide()] }));
    setActiveIndex(carousel.slides.length);
  };

  const removeSlide = (index: number) => {
    if (carousel.slides.length <= 1) return;
    if (!window.confirm(`Remover o slide ${index + 1}? Esta ação será aplicada ao salvar.`)) return;
    setCarousel((prev) => ({
      ...prev,
      slides: prev.slides.filter((_, i) => i !== index),
    }));
    setActiveIndex((i) => Math.max(0, Math.min(i, carousel.slides.length - 2)));
  };

  const moveSlide = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= carousel.slides.length) return;
    setCarousel((prev) => {
      const next = [...prev.slides];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, slides: next };
    });
    setActiveIndex(target);
  };

  const handleSave = async () => {
    setSaving(true);
    await update(carousel);
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const isSecondary = settingsKey.startsWith("secondary_");
  const enabled = carousel.enabled !== false;

  return (
    <div className="space-y-5 max-w-2xl">
      {description && (
        <p className="text-sm text-muted-foreground bg-secondary/50 border border-border rounded-md p-3">
          {description}
        </p>
      )}

      {isSecondary && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <EyeOff className="h-4 w-4" /> Exibir este banner
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando desligado, o banner é completamente ocultado para este público.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) =>
              setCarousel((prev) => ({ ...prev, enabled: v }))
            }
            aria-label="Exibir banner"
          />
        </div>
      )}

      {/* Slides manager */}
      <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4" /> Slides do carrossel ({carousel.slides.length}/{MAX_HERO_SLIDES})
          </Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addSlide}
            disabled={carousel.slides.length >= MAX_HERO_SLIDES}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar slide
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {carousel.slides.map((slide, i) => (
            <div
              key={i}
              className={`group flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                i === activeIndex
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <button type="button" onClick={() => setActiveIndex(i)} className="px-1 font-medium">
                Slide {i + 1}
                {slide.title && <span className="hidden md:inline"> · {slide.title.slice(0, 18)}</span>}
              </button>
              <button
                type="button"
                onClick={() => moveSlide(i, -1)}
                disabled={i === 0}
                className="opacity-50 hover:opacity-100 disabled:opacity-20"
                aria-label="Mover para cima"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => moveSlide(i, 1)}
                disabled={i === carousel.slides.length - 1}
                className="opacity-50 hover:opacity-100 disabled:opacity-20"
                aria-label="Mover para baixo"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => removeSlide(i)}
                disabled={carousel.slides.length <= 1}
                className="opacity-50 hover:opacity-100 hover:text-destructive disabled:opacity-20 disabled:hover:text-current"
                aria-label="Remover slide"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        <div>
          <Label className="text-xs">Tempo entre slides (segundos)</Label>
          <Input
            type="number"
            min={2}
            max={60}
            value={carousel.autoplay_seconds}
            onChange={(e) =>
              setCarousel((prev) => ({
                ...prev,
                autoplay_seconds: Math.max(2, Math.min(60, Number(e.target.value) || DEFAULT_HERO_AUTOPLAY_SECONDS)),
              }))
            }
            className="max-w-[120px]"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Aplicado quando há mais de 1 slide. O carrossel troca automaticamente nesse intervalo.
          </p>
        </div>
      </div>

      {/* Active slide editor */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          Editando slide {activeIndex + 1}
        </h3>

        <div>
          <Label>Título Principal</Label>
          <Input
            value={activeSlide.title}
            onChange={(e) => updateActiveSlide({ title: e.target.value })}
          />
        </div>
        <div>
          <Label>Subtítulo</Label>
          <Input
            value={activeSlide.subtitle}
            onChange={(e) => updateActiveSlide({ subtitle: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Imagem do Banner</Label>
          {activeSlide.banner_image_url && (
            <div className="relative inline-block rounded-lg border border-border bg-muted/30 p-2">
              <img
                src={activeSlide.banner_image_url}
                alt="Banner"
                className="h-24 max-w-[300px] object-cover rounded"
              />
              <button
                onClick={() => updateActiveSlide({ banner_image_url: "" })}
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
              value={activeSlide.banner_image_url || ""}
              onChange={(e) => updateActiveSlide({ banner_image_url: e.target.value })}
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
          <Input
            value={activeSlide.cta_text}
            onChange={(e) => updateActiveSlide({ cta_text: e.target.value })}
          />
        </div>
        <div>
          <Label>Link do Botão (CTA)</Label>
          <Input
            value={activeSlide.cta_link}
            onChange={(e) => updateActiveSlide({ cta_link: e.target.value })}
            placeholder="/cadastro/aluno"
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default SettingsHeroBanner;
