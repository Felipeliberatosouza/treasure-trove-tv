import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  usePlatformSettings,
  HeroBannerSettings,
  normalizeHeroCarousel,
  DEFAULT_HERO_AUTOPLAY_SECONDS,
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

  return (
    <section
      className={`relative w-full py-16 md:py-20 overflow-hidden ${s.section}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className={`absolute inset-0 ${s.overlayOpacity}`}
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex flex-col items-center justify-center text-center px-6 gap-4 max-w-3xl mx-auto"
        >
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${s.badge}`}>
            {active.badge}
          </span>
          {slide.title && (
            <h2 className={`text-3xl md:text-4xl font-display font-bold ${s.title}`}>
              {slide.title}
            </h2>
          )}
          {slide.subtitle && (
            <p className={`text-lg md:text-xl max-w-2xl ${s.subtitle}`}>
              {slide.subtitle}
            </p>
          )}
          {slide.cta_text && (
            isExternal ? (
              <a
                href={ctaLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-4 inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold shadow-lg transition-opacity ${s.cta}`}
              >
                {slide.cta_text}
                <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <Link
                to={ctaLink}
                className={`mt-4 inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold shadow-lg transition-opacity ${s.cta}`}
              >
                {slide.cta_text}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )
          )}
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Slide anterior"
            className={`absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 rounded-full backdrop-blur p-2 transition-colors ${s.nav}`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goNext}
            aria-label="Próximo slide"
            className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 rounded-full backdrop-blur p-2 transition-colors ${s.nav}`}
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
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default SecondaryBanner;
