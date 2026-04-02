import { motion } from "framer-motion";
import { Play, Clock, BookOpen } from "lucide-react";
import type { Video } from "@/data/courses";

interface VideoCardProps {
  video: Video;
  index: number;
  onClick: (id: string) => void;
}

const VideoCard = ({ video, index, onClick }: VideoCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group relative min-w-[240px] cursor-pointer md:min-w-[280px]"
      onClick={() => onClick(video.id)}
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
          <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {video.level}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default VideoCard;
