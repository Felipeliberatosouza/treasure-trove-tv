import { motion } from "framer-motion";
import { Play, Clock, Eye, Star, Gift, CheckCircle } from "lucide-react";
import type { Video } from "@/data/courses";
import { prefetchSignedUrlForContent, getSignedVideoUrl } from "@/lib/signedUrlCache";
import { formatDuration } from "@/lib/contentDisplay";
import { useEffect, useRef, useState } from "react";

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
      className="group relative w-[240px] min-w-[240px] flex-none cursor-pointer md:w-[280px] md:min-w-[280px]"
      onClick={() => onClick(video.id)}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      tabIndex={0}
    >
      <div className="card-shine overflow-hidden rounded-lg bg-card transition-all duration-300 group-hover:ring-1 group-hover:ring-primary/40 group-hover:scale-[1.03]">
        <div className="relative aspect-video overflow-hidden bg-muted">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-gradient-to-br from-muted to-muted-foreground/10" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-background/0 transition-all group-hover:bg-background/40">
            <div className="scale-0 rounded-full bg-primary p-3 transition-transform group-hover:scale-100">
              <Play className="h-5 w-5 text-primary-foreground" fill="currentColor" />
            </div>
          </div>
          {video.overlayLabel && (
            <div className="absolute bottom-2 left-2 right-2 truncate rounded bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
              {video.overlayLabel}
            </div>
          )}
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
          {video.instructorHref ? (
            <a
              href={video.instructorHref}
              onClick={(e) => e.stopPropagation()}
              className="block text-xs text-muted-foreground transition-colors hover:text-primary hover:underline"
            >
              {video.instructor}
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">{video.instructor}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {video.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {video.duration}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {video.views ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <Star className={`h-3 w-3 ${rating && rating.count > 0 ? "fill-accent text-accent" : ""}`} />
              {rating && rating.count > 0 ? (
                <>
                  <span className="font-medium">{rating.average.toFixed(1)}</span>
                  <span className="text-[10px]">({rating.count})</span>
                </>
              ) : (
                <span className="text-[10px]">sem avaliações</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoCard;
