import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  usePlatformSettings,
  HeroBannerSettings,
  normalizeHeroCarousel,
  DEFAULT_HERO_AUTOPLAY_SECONDS,
  isSlideScheduledNow,
} from "@/hooks/usePlatformSettings";
import { useAuth } from "@/contexts/AuthContext";
import defaultBg from "@/assets/teacher-banner-bg.jpg";

interface FlatSlide {
  slide: HeroBannerSettings;
  badge: string;
  audience: "visitor" | "student" | "teacher";
  autoplaySeconds: number;
}

const SecondaryBanner = () => {
  const { role } = useAuth();

  const { data: visitorRaw } = usePlatformSettings("secondary_banner");
  const { data: studentRaw } = usePlatformSettings("secondary_banner_student");
  const { data: teacherRaw } = usePlatformSettings("secondary_banner_teacher");
  const { data: branding } = usePlatformSettings("branding");
  const navBg = (branding as any)?.banner_nav_bg as string | undefined;
  const navIcon = (branding as any)?.banner_nav_icon as string | undefined;
  const dotActive = (branding as any)?.banner_nav_dot_active as string | undefined;
  const dotIdle = (branding as any)?.banner_nav_dot_idle as string | undefined;

  const slides: FlatSlide[] = useMemo(() => {
    const visitor = normalizeHeroCarousel(visitorRaw);
    const student = normalizeHeroCarousel(studentRaw);
    const teacher = normalizeHeroCarousel(teacherRaw);

    const flatten = (
      carousel: { slides: HeroBannerSettings[]; autoplay_seconds: number; enabled?: boolean },
      audience: FlatSlide["audience"],
      badge: string
    ): FlatSlide[] => {
      if (carousel.enabled === false) return [];
      return carousel.slides
        .filter((s) => s && (s.title || s.subtitle || s.cta_text || s.banner_image_url))
        .filter((s) => isSlideScheduledNow(s))
        .map((slide) => ({
          slide,
          audience,
          badge,
          autoplaySeconds: carousel.autoplay_seconds || DEFAULT_HERO_AUTOPLAY_SECONDS,
        }));
    };

    if (role === "admin") {
      return [
        ...flatten(student, "student", "Visão do aluno"),
        ...flatten(teacher, "teacher", "Visão do professor"),
      ];
    }
    if (role === "student") return flatten(student, "student", "Para você");
    if (role === "teacher") return flatten(teacher, "teacher", "Para você");
    return flatten(visitor, "visitor", "Destaque");
  }, [role, visitorRaw, studentRaw, teacherRaw]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (currentIndex >= slides.length) setCurrentIndex(0);
  }, [slides.length, currentIndex]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const totalMs =
      (slides[currentIndex]?.autoplaySeconds || DEFAULT_HERO_AUTOPLAY_SECONDS) * 1000;
    const id = window.setTimeout(() => {
      if (isPaused) return;
      setCurrentIndex((i) => (i + 1) % slides.length);
    }, totalMs);
    return () => window.clearTimeout(id);
  }, [currentIndex, slides, isPaused]);

  if (slides.length === 0) return null;

  const active = slides[currentIndex] || slides[0];
  const slide = active.slide;
  const bgImage = slide.banner_image_url || defaultBg;
  const ctaLink = slide.cta_link || "#";
  const isExternal = ctaLink.startsWith("http");
  const scheme = slide.color_scheme || "light";

  const goPrev = () => setCurrentIndex((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setCurrentIndex((i) => (i + 1) % slides.length);

  const schemeStyles: Record<typeof scheme, {
    section: string;
    overlayOpacity: string;
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    nav: string;
    dotActive: string;
    dotIdle: string;
  }> = {
    light: {
      section: "bg-card border-t border-border",
      overlayOpacity: "opacity-10",
      badge: "bg-primary/15 text-primary",
      title: "text-foreground",
      subtitle: "text-muted-foreground",
      cta: "bg-primary text-primary-foreground hover:opacity-90",
      nav: "bg-background/60 hover:bg-background/90 text-foreground",
      dotActive: "bg-primary",
      dotIdle: "bg-foreground/30 hover:bg-foreground/50",
    },
    dark: {
      section: "bg-foreground border-t border-foreground/40",
      overlayOpacity: "opacity-20",
      badge: "bg-background/15 text-background",
      title: "text-background",
      subtitle: "text-background/80",
      cta: "bg-background text-foreground hover:opacity-90",
      nav: "bg-background/20 hover:bg-background/40 text-background",
      dotActive: "bg-background",
      dotIdle: "bg-background/30 hover:bg-background/60",
    },
    accent: {
      section: "bg-primary border-t border-primary/40",
      overlayOpacity: "opacity-15",
      badge: "bg-primary-foreground/15 text-primary-foreground",
      title: "text-primary-foreground",
      subtitle: "text-primary-foreground/85",
      cta: "bg-primary-foreground text-primary hover:opacity-90",
      nav: "bg-primary-foreground/20 hover:bg-primary-foreground/40 text-primary-foreground",
      dotActive: "bg-primary-foreground",
      dotIdle: "bg-primary-foreground/30 hover:bg-primary-foreground/60",
    },
  };
  const s = schemeStyles[scheme];
  const layout = slide.layout || "center";
  const align =
    layout === "left" ? "items-start text-left" : layout === "right" ? "items-end text-right" : "items-center text-center";
  const pad = slide.height === "compact" ? "py-10 md:py-12" : slide.height === "tall" ? "py-24 md:py-32" : "py-16 md:py-20";
  const imgOpacity = typeof slide.image_opacity === "number" ? slide.image_opacity / 100 : undefined;
  const btnStyle = slide.button_style || "solid";
  const newTab = slide.button_new_tab ?? isExternal;
  const showIcon = slide.button_icon !== false;
  const btnBase = "mt-4 inline-flex items-center gap-2 text-sm font-semibold transition-opacity";
  const btnClass =
    btnStyle === "outline"
      ? `${btnBase} rounded-lg px-8 py-3 border-2 border-current bg-transparent hover:opacity-80 ${s.title}`
      : btnStyle === "text"
      ? `${btnBase} underline underline-offset-4 hover:opacity-80 ${s.title}`
      : `${btnBase} rounded-lg px-8 py-3 shadow-lg ${s.cta}`;
  const btnInline: React.CSSProperties = {};
  if (btnStyle === "solid") {
    if (slide.button_bg_color) btnInline.background = slide.button_bg_color;
    if (slide.button_text_color) btnInline.color = slide.button_text_color;
  } else if (slide.button_text_color || slide.button_bg_color) {
    btnInline.color = slide.button_text_color || slide.button_bg_color;
  }
  const badgeText = slide.badge_text?.trim() || active.badge;
  const isSplit = layout === "split" && !!slide.banner_image_url;

  return (
    <section
      className={`relative w-full ${pad} overflow-hidden ${s.section}`}
      style={slide.bg_color ? { background: slide.bg_color } : undefined}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {!isSplit && <div
        className={`absolute inset-0 ${imgOpacity === undefined ? s.overlayOpacity : ""}`}
        style={{
          opacity: imgOpacity,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4 }}
          className={`relative z-10 px-6 w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto min-w-0 ${isSplit ? "grid md:grid-cols-2 gap-8 items-center" : ""}`}
        >
          {isSplit && (
            <img src={slide.banner_image_url} alt="" className="w-full max-h-80 object-cover rounded-xl shadow-lg" />
          )}
          <div className={`flex flex-col justify-center gap-4 w-full min-w-0 ${isSplit ? "items-start text-left" : align}`}>
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${s.badge}`}>
            {badgeText}
          </span>
          {slide.title && (
            <h2 className={`w-full text-3xl md:text-4xl lg:text-5xl xl:text-5xl 2xl:text-6xl font-display font-bold break-words hyphens-auto [overflow-wrap:anywhere] ${s.title}`} style={slide.title_color ? { color: slide.title_color } : undefined}>
              {slide.title}
            </h2>
          )}
          {slide.subtitle && (
            <p className={`w-full text-lg md:text-xl lg:text-2xl max-w-2xl lg:max-w-4xl xl:max-w-5xl break-words hyphens-auto [overflow-wrap:anywhere] ${s.subtitle}`} style={slide.subtitle_color ? { color: slide.subtitle_color } : undefined}>
              {slide.subtitle}
            </p>
          )}
          {slide.cta_text && btnStyle !== "none" && (
            isExternal || newTab ? (
              <a
                href={ctaLink}
                target={newTab ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={btnClass}
                style={btnInline}
              >
                {slide.cta_text}
                {showIcon && <ArrowRight className="h-4 w-4" />}
              </a>
            ) : (
              <Link to={ctaLink} className={btnClass} style={btnInline}>
                {slide.cta_text}
                {showIcon && <ArrowRight className="h-4 w-4" />}
              </Link>
            )
          )}
          </div>
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Slide anterior"
            className={`absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 rounded-full backdrop-blur p-2 transition-colors ${s.nav}`}
            style={navBg || navIcon ? { background: navBg, color: navIcon } : undefined}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            aria-label="Próximo slide"
            className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 rounded-full backdrop-blur p-2 transition-colors ${s.nav}`}
            style={navBg || navIcon ? { background: navBg, color: navIcon } : undefined}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Ir para o slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === currentIndex ? `w-8 ${s.dotActive}` : `w-2 ${s.dotIdle}`
                }`}
                style={
                  i === currentIndex
                    ? dotActive ? { background: dotActive } : undefined
                    : dotIdle ? { background: dotIdle } : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default SecondaryBanner;
