import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFeaturedVideo } from "@/data/courses";
import {
  usePlatformSettings,
  HeroBannerSettings,
  normalizeHeroCarousel,
  DEFAULT_HERO_AUTOPLAY_SECONDS,
} from "@/hooks/usePlatformSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";

interface HeroBannerProps {
  onVideoClick: (id: string) => void;
  onExploreClick?: () => void;
}

const SEARCH_CTA_TEXTS = new Set(["comece agora", "começar agora"]);

interface SlideViewProps {
  onPrimary: () => void;
  ctaText: string;
  bannerImage: string;
  title: string;
  subtitle: string;
  badge: string;
  featured: ReturnType<typeof getFeaturedVideo>;
  primaryGoesToPopular: boolean;
}

const SlideView = ({
  onPrimary,
  ctaText,
  bannerImage,
  title,
  subtitle,
  badge,
  featured,
  primaryGoesToPopular,
}: SlideViewProps) => {
  const PrimaryIcon = primaryGoesToPopular ? BookOpen : Play;

  return (
    <>
      <div className="absolute inset-0">
        <img src={bannerImage} alt="Banner principal" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex h-full items-end pb-20 px-6 md:px-12 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl space-y-5"
        >
          <span className="inline-block rounded-full bg-primary/20 px-4 py-1 text-sm font-medium text-primary">
            {badge}
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground md:text-base max-w-lg leading-relaxed">
            {subtitle}
          </p>
          {featured && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{featured.lessons} aulas</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span>{featured.duration}</span>
            </div>
          )}
          <div className="flex gap-3 pt-2 flex-wrap">
            <Button size="lg" className="gap-2 font-display font-semibold" onClick={onPrimary}>
              <PrimaryIcon className="h-5 w-5" /> {ctaText}
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

interface FlatSlide {
  slide: HeroBannerSettings;
  badge: string;
  audience: "visitor" | "student" | "teacher";
  autoplaySeconds: number;
}

const HeroBanner = ({ onVideoClick, onExploreClick }: HeroBannerProps) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const featured = getFeaturedVideo();

  const { data: visitorRaw } = usePlatformSettings("hero_banner");
  const { data: studentRaw } = usePlatformSettings("hero_banner_student");
  const { data: teacherRaw } = usePlatformSettings("hero_banner_teacher");

  const slides: FlatSlide[] = useMemo(() => {
    const visitor = normalizeHeroCarousel(visitorRaw);
    const student = normalizeHeroCarousel(studentRaw);
    const teacher = normalizeHeroCarousel(teacherRaw);

    const flatten = (
      carousel: { slides: HeroBannerSettings[]; autoplay_seconds: number },
      audience: FlatSlide["audience"],
      badge: string
    ): FlatSlide[] =>
      carousel.slides.map((slide) => ({
        slide,
        audience,
        badge,
        autoplaySeconds: carousel.autoplay_seconds || DEFAULT_HERO_AUTOPLAY_SECONDS,
      }));

    if (role === "admin") {
      return [
        ...flatten(student, "student", "Visão do aluno"),
        ...flatten(teacher, "teacher", "Visão do professor"),
      ];
    }
    if (role === "student") return flatten(student, "student", "Em destaque");
    if (role === "teacher") return flatten(teacher, "teacher", "Em destaque");
    return flatten(visitor, "visitor", "Em destaque");
  }, [role, visitorRaw, studentRaw, teacherRaw]);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= slides.length) setCurrentIndex(0);
  }, [slides.length, currentIndex]);

  // Per-slide autoplay: schedule next based on the current slide's audience interval
  useEffect(() => {
    if (slides.length <= 1) return;
    const ms = (slides[currentIndex]?.autoplaySeconds || DEFAULT_HERO_AUTOPLAY_SECONDS) * 1000;
    const id = window.setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % slides.length);
    }, ms);
    return () => window.clearTimeout(id);
  }, [currentIndex, slides]);

  const active = slides[currentIndex] || slides[0];
  const slide = active?.slide;

  const title = slide?.title || featured?.title || "Bem-vindo";
  const subtitle = slide?.subtitle || featured?.description || "";
  const ctaText = slide?.cta_text || "Comece Agora";
  const bannerImage = slide?.banner_image_url || heroBanner;
  const ctaLink = slide?.cta_link || "";

  const normalizedPrimaryCta = ctaText.trim().toLowerCase();
  const primaryGoesToPopular = SEARCH_CTA_TEXTS.has(normalizedPrimaryCta);

  const handlePrimary = () => {
    if (primaryGoesToPopular && onExploreClick) {
      onExploreClick();
      return;
    }
    if (ctaLink) {
      if (ctaLink.startsWith("http")) {
        window.open(ctaLink, "_blank");
      } else {
        navigate(ctaLink);
      }
      return;
    }
    if (featured) onVideoClick(featured.id);
  };

  const goPrev = () => setCurrentIndex((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setCurrentIndex((i) => (i + 1) % slides.length);

  return (
    <section className="relative h-[85vh] min-h-[500px] w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <SlideView
            onPrimary={handlePrimary}
            ctaText={ctaText}
            bannerImage={bannerImage}
            title={title}
            subtitle={subtitle}
            badge={active?.badge || "Em destaque"}
            featured={featured}
            primaryGoesToPopular={primaryGoesToPopular}
          />
        </motion.div>
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Banner anterior"
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 rounded-full bg-background/60 hover:bg-background/90 backdrop-blur p-2 md:p-3 text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          <button
            onClick={goNext}
            aria-label="Próximo banner"
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 rounded-full bg-background/60 hover:bg-background/90 backdrop-blur p-2 md:p-3 text-foreground transition-colors"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === currentIndex ? "w-8 bg-primary" : "w-2 bg-foreground/30 hover:bg-foreground/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroBanner;
