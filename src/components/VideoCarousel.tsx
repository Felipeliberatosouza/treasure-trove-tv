import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import VideoCard from "./VideoCard";
import type { Video } from "@/data/courses";

interface VideoCarouselProps {
  title: string;
  videos: Video[];
  onVideoClick: (id: string) => void;
  ratings?: Record<string, { average: number; count: number }>;
}

const VideoCarousel = ({ title, videos, onVideoClick, ratings }: VideoCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-6 md:px-12 lg:px-20">
        <h2 className="font-display text-xl font-bold md:text-2xl">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="rounded-full bg-secondary p-2 transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="rounded-full bg-secondary p-2 transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-4 overflow-x-auto px-6 pb-4 md:px-12 lg:px-20"
      >
        {videos.map((video, i) => (
          <VideoCard
            key={video.id}
            video={video}
            index={i}
            onClick={onVideoClick}
            rating={ratings?.[video.id]}
          />
        ))}
      </div>
    </section>
  );
};

export default VideoCarousel;
