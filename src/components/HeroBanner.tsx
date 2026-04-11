import { motion } from "framer-motion";
import { Play, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFeaturedVideo } from "@/data/courses";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import heroBanner from "@/assets/hero-banner.jpg";

interface HeroBannerProps {
  onVideoClick: (id: string) => void;
  onExploreClick?: () => void;
}

const HeroBanner = ({ onVideoClick, onExploreClick }: HeroBannerProps) => {
  const featured = getFeaturedVideo();
  const { data: heroBannerSettings } = usePlatformSettings("hero_banner");

  const title = heroBannerSettings?.title || featured.title;
  const subtitle = heroBannerSettings?.subtitle || featured.description;
  const ctaText = heroBannerSettings?.cta_text || "Assistir Agora";
  const bannerImage = heroBannerSettings?.banner_image_url || heroBanner;

  return (
    <section className="relative h-[85vh] min-h-[500px] w-full overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={bannerImage}
          alt="Banner principal"
          className="h-full w-full object-cover"
        />
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
            Em destaque
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground md:text-base max-w-lg leading-relaxed">
            {subtitle}
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{featured.lessons} aulas</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
            <span>{featured.duration}</span>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              className="gap-2 font-display font-semibold"
              onClick={() => onVideoClick(featured.id)}
            >
              <Play className="h-5 w-5" /> {ctaText}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 font-display font-semibold"
              onClick={onExploreClick}
            >
              <BookOpen className="h-5 w-5" /> Comece Agora
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroBanner;
