import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Play, ShoppingCart, Zap, Clock, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Video } from "@/data/courses";

interface VideoDetailModalProps {
  video: Video | null;
  open: boolean;
  onClose: () => void;
}

interface RatingData {
  average: number;
  count: number;
  userRating: number | null;
}

const VideoDetailModal = ({ video, open, onClose }: VideoDetailModalProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingData, setRatingData] = useState<RatingData>({ average: 0, count: 0, userRating: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (video && open) {
      fetchRatings();
    }
  }, [video, open, user]);

  const fetchRatings = async () => {
    if (!video) return;

    const { data: ratings } = await supabase
      .from("video_ratings")
      .select("rating, user_id")
      .eq("content_type", "lesson")
      .eq("content_id", video.id);

    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      const userR = user ? ratings.find((r) => r.user_id === user.id)?.rating ?? null : null;
      setRatingData({ average: avg, count: ratings.length, userRating: userR });
      if (userR) setRating(userR);
    } else {
      setRatingData({ average: 0, count: 0, userRating: null });
      setRating(0);
    }
  };

  const handleRate = async (value: number) => {
    if (!user) {
      toast.error("Faça login para avaliar.");
      return;
    }
    if (!video) return;
    setSubmitting(true);
    setRating(value);

    const payload = {
      user_id: user.id,
      content_type: "lesson" as const,
      content_id: video.id,
      rating: value,
    };

    if (ratingData.userRating !== null) {
      await supabase
        .from("video_ratings")
        .update({ rating: value })
        .eq("user_id", user.id)
        .eq("content_type", "lesson")
        .eq("content_id", video.id);
    } else {
      await supabase.from("video_ratings").insert(payload);
    }

    toast.success("Avaliação registrada!");
    await fetchRatings();
    setSubmitting(false);
  };

  const handleBuyUnit = () => {
    toast.info("Compra unitária será integrada com Stripe em breve.");
  };

  const handleSubscribe = () => {
    const el = document.getElementById("pricing");
    onClose();
    setTimeout(() => el?.scrollIntoView({ behavior: "smooth" }), 300);
  };

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 border-border bg-card">
        <div className="relative aspect-video w-full overflow-hidden">
          <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-background/30">
            <div className="rounded-full bg-primary p-4">
              <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
            </div>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold leading-tight">
              {video.title}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground leading-relaxed">{video.description}</p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{video.lessons} aulas</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{video.duration}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{video.level}</span>
          </div>

          {/* Rating display */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RatingStars value={ratingData.average} />
              <span className="text-sm font-semibold">{ratingData.average.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({ratingData.count} avaliações)</span>
            </div>

            {/* User rating */}
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sua nota:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      disabled={submitting}
                      onMouseEnter={() => setHoveredStar(s)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => handleRate(s)}
                      className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          s <= (hoveredStar || rating)
                            ? "fill-accent text-accent"
                            : "text-muted-foreground/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Purchase options */}
          <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opções de acesso</p>
            <Button onClick={handleSubscribe} className="w-full gap-2 font-display font-semibold">
              <Zap className="h-4 w-4" /> Assinar — R$ 49/mês (acesso total)
            </Button>
            <Button onClick={handleBuyUnit} variant="outline" className="w-full gap-2 font-display font-semibold">
              <ShoppingCart className="h-4 w-4" /> Comprar este vídeo — R$ 19,90
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const RatingStars = ({ value, size = 4 }: { value: number; size?: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={`h-${size} w-${size} ${
          s <= Math.round(value) ? "fill-accent text-accent" : "text-muted-foreground/30"
        }`}
      />
    ))}
  </div>
);

export default VideoDetailModal;
