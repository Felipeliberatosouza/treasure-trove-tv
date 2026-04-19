import { ArrowRight, Play, Eye } from "lucide-react";
import {
  HeroBannerSettings,
  isSlideScheduledNow,
} from "@/hooks/usePlatformSettings";
import heroFallback from "@/assets/hero-banner.jpg";
import secondaryFallback from "@/assets/teacher-banner-bg.jpg";

interface HeroSlidePreviewProps {
  slide: HeroBannerSettings;
  /** When true, renders the secondary-banner style (compact, color schemes).
   *  When false, renders a mini main-hero (cinematic, dark gradient). */
  isSecondary: boolean;
  /** Badge label to show ("Em destaque", "Visão do aluno", etc.) */
  badge?: string;
}

const schemeStyles = {
  light: {
    section: "bg-card border border-border",
    overlayOpacity: "opacity-10",
    badge: "bg-primary/15 text-primary",
    title: "text-foreground",
    subtitle: "text-muted-foreground",
    cta: "bg-primary text-primary-foreground",
  },
  dark: {
    section: "bg-foreground border border-foreground/40",
    overlayOpacity: "opacity-20",
    badge: "bg-background/15 text-background",
    title: "text-background",
    subtitle: "text-background/80",
    cta: "bg-background text-foreground",
  },
  accent: {
    section: "bg-primary border border-primary/40",
    overlayOpacity: "opacity-15",
    badge: "bg-primary-foreground/15 text-primary-foreground",
    title: "text-primary-foreground",
    subtitle: "text-primary-foreground/85",
    cta: "bg-primary-foreground text-primary",
  },
} as const;

const HeroSlidePreview = ({ slide, isSecondary, badge }: HeroSlidePreviewProps) => {
  const isVisibleNow = isSlideScheduledNow(slide);
  const bgImage =
    slide.banner_image_url || (isSecondary ? secondaryFallback : heroFallback);
  const showCta = !!slide.cta_text;
  const labelBadge = badge || "Em destaque";

  // ---- Secondary banner mini preview ----
  if (isSecondary) {
    const scheme = slide.color_scheme || "light";
    const s = schemeStyles[scheme];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" /> Prévia ao vivo
          </div>
        </div>
        <div
          className={`relative overflow-hidden rounded-lg ${s.section} aspect-[16/7]`}
        >
          <div
            className={`absolute inset-0 ${s.overlayOpacity}`}
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4 gap-2">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${s.badge}`}
            >
              {labelBadge}
            </span>
            {slide.title && (
              <h3 className={`text-sm md:text-base font-bold leading-tight ${s.title}`}>
                {slide.title}
              </h3>
            )}
            {slide.subtitle && (
              <p className={`text-[10px] md:text-xs ${s.subtitle} line-clamp-2 max-w-[90%]`}>
                {slide.subtitle}
              </p>
            )}
            {showCta && (
              <span
                className={`mt-1 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold ${s.cta}`}
              >
                {slide.cta_text}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
          {!isVisibleNow && (
            <div className="absolute top-2 right-2 z-20 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
              Fora da janela agendada
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Main hero mini preview (cinematic) ----
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3 w-3" /> Prévia ao vivo
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg aspect-[16/7] bg-background border border-border">
        <img src={bgImage} alt="Prévia" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
        <div className="relative z-10 h-full flex items-end p-4">
          <div className="space-y-1.5 max-w-[80%]">
            <span className="inline-block rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-medium text-primary">
              {labelBadge}
            </span>
            {slide.title && (
              <h3 className="font-display text-sm md:text-lg font-bold leading-tight text-foreground line-clamp-2">
                {slide.title}
              </h3>
            )}
            {slide.subtitle && (
              <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-2">
                {slide.subtitle}
              </p>
            )}
            {showCta && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                <Play className="h-2.5 w-2.5" /> {slide.cta_text}
              </span>
            )}
          </div>
        </div>
        {!isVisibleNow && (
          <div className="absolute top-2 right-2 z-20 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
            Fora da janela agendada
          </div>
        )}
      </div>
    </div>
  );
};

// Tiny shim so we can keep the file self-contained without pulling Label
const Label = ({ children }: { children?: React.ReactNode }) => (
  <span className="text-xs font-medium text-muted-foreground">{children}</span>
);

export default HeroSlidePreview;
