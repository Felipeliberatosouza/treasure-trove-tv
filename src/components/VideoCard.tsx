import { motion } from "framer-motion";
import { Play, Clock, BookOpen, Star, Gift, CheckCircle } from "lucide-react";
import type { Video } from "@/data/courses";
import { prefetchSignedUrlForContent } from "@/lib/signedUrlCache";
import { useEffect, useRef } from "react";

interface VideoCardProps {
  video: Video;
  index: number;
  onClick: (id: string) => void;
  rating?: { average: number; count: number };
  showTrialBadge?: boolean;
  watched?: boolean;
}

const VideoCard = ({ video, index, onClick, rating, showTrialBadge, watched }: VideoCardProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // Prefetch ao entrar no viewport: gera a URL assinada em background para
  // reduzir o TTFB caso o usuário clique no card.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          prefetchSignedUrlForContent(video.id);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [video.id]);

  const handlePrefetch = () => prefetchSignedUrlForContent(video.id);

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group relative min-w-[240px] cursor-pointer md:min-w-[280px]"
      onClick={() => onClick(video.id)}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      tabIndex={0}
    >
      <div className="card-shine overflow-hidden rounded-lg bg-card transition-all duration-300 group-hover:ring-1 group-hover:ring-primary/40 group-hover:scale-[1.03]">
        <div className="relative aspect-video overflow-hidden">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-background/0 transition-all group-hover:bg-background/40">
            <div className="scale-0 rounded-full bg-primary p-3 transition-transform group-hover:scale-100">
              <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
            {video.duration}
          </div>
          {showTrialBadge && (
            <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground shadow-md">
              <Gift className="h-3 w-3" /> TESTE GRÁTIS
            </div>
          )}
          {watched && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-600/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-md backdrop-blur-sm">
              <CheckCircle className="h-3 w-3" /> Assistido
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="font-display text-sm font-semibold leading-tight line-clamp-2">
            {video.title}
          </h3>
          <p className="text-xs text-muted-foreground">{video.instructor}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {video.lessons} aulas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {video.duration}
            </span>
          </div>
          <div className="flex items-center justify-end">
            {rating && rating.count > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-accent text-accent" />
                <span className="text-xs font-medium">{rating.average.toFixed(1)}</span>
                <span className="text-[10px] text-muted-foreground">({rating.count})</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoCard;
