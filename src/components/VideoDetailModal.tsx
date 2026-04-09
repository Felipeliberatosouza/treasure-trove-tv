import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Play, ShoppingCart, Zap, Clock, BookOpen, Gift, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { toast } from "sonner";
import VideoPlayer from "@/components/VideoPlayer";
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

// Demo video for static course data (replace with real URLs from DB)
const DEMO_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const VideoDetailModal = ({ video, open, onClose }: VideoDetailModalProps) => {
  const { user } = useAuth();
  const trial = useFreeTrial();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingData, setRatingData] = useState<RatingData>({ average: 0, count: 0, userRating: null });
  const [submitting, setSubmitting] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [hasWatched70, setHasWatched70] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    if (video && open) {
      fetchRatings();
      checkWatchProgress();
      setIsWatching(false);
      setViewId(null);
    }
  }, [video, open, user]);

  const checkWatchProgress = async () => {
    if (!video || !user) {
      setHasWatched70(false);
      return;
    }
    const { data } = await supabase
      .from("video_views")
      .select("watch_percentage")
      .eq("user_id", user.id)
      .eq("content_type", "lesson")
      .eq("content_id", video.id)
      .gte("watch_percentage", 70)
      .limit(1);
    setHasWatched70(!!(data && data.length > 0));
  };

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
    if (!user) { toast.error("Faça login para avaliar."); return; }
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

  const handleStartTrial = async () => {
    if (!user) { toast.error("Faça login para iniciar o teste grátis."); return; }
    setStartingTrial(true);
    const ok = await trial.startTrial();
    if (ok) {
      toast.success("Teste grátis ativado! Aproveite.");
    } else {
      toast.error("Não foi possível iniciar o teste grátis.");
    }
    setStartingTrial(false);
  };

  const handleWatchVideo = async () => {
    if (!user || !video) return;

    // If user is on a video-based trial, record the watch
    if (trial.hasActiveTrial && trial.trialType === "videos") {
      await trial.recordVideoWatch();
    }

    // Create a view record and get its ID for progress tracking
    const { data } = await supabase
      .from("video_views")
      .insert({
        user_id: user.id,
        content_type: "lesson",
        content_id: video.id,
        watch_percentage: 0,
      })
      .select("id")
      .single();

    if (data) {
      setViewId(data.id);
    }

    setIsWatching(true);
  };

  const handleProgressMilestone = useCallback((pct: number) => {
    if (pct >= 70) {
      setHasWatched70(true);
    }
  }, []);

  const handleBuyUnit = () => {
    toast.info("Compra unitária será integrada com Stripe em breve.");
  };

  const handleSubscribe = () => {
    const el = document.getElementById("pricing");
    onClose();
    setTimeout(() => el?.scrollIntoView({ behavior: "smooth" }), 300);
  };

  if (!video) return null;

  const canWatch = trial.hasActiveTrial;
  const trialExpired = trial.trialRow && !trial.hasActiveTrial;
  const canStartTrial = trial.trialEnabled && !trial.trialRow && user;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 border-border bg-card">
        {/* Video area: player or thumbnail */}
        {isWatching ? (
          <VideoPlayer
            videoUrl={DEMO_VIDEO_URL}
            contentId={video.id}
            contentType="lesson"
            viewId={viewId}
            onProgressMilestone={handleProgressMilestone}
            poster={video.thumbnail}
          />
        ) : (
          <div className="relative aspect-video w-full overflow-hidden">
            <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-background/30">
              <div className="rounded-full bg-primary p-4">
                <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
              </div>
            </div>
          </div>
        )}

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

          {/* Trial status banner */}
          {user && !trial.loading && (
            <>
              {trial.hasActiveTrial && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <Gift className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground">
                    {trial.trialType === "days"
                      ? `Teste grátis ativo — ${trial.daysRemaining} dia(s) restante(s)`
                      : `Teste grátis ativo — ${trial.videosRemaining} vídeo(s) restante(s)`}
                  </span>
                </div>
              )}

              {trialExpired && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm text-foreground">
                    Seu teste grátis expirou. Assine para continuar assistindo.
                  </span>
                </div>
              )}
            </>
          )}

          {/* Rating display */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RatingStars value={ratingData.average} />
              <span className="text-sm font-semibold">{ratingData.average.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({ratingData.count} avaliações)</span>
            </div>

            {user && hasWatched70 && (
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
            {user && !hasWatched70 && (
              <p className="text-xs text-muted-foreground italic">
                Assista pelo menos 70% do vídeo para poder avaliar.
              </p>
            )}
          </div>

          {/* Access options */}
          <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opções de acesso</p>

            {canWatch && !isWatching && (
              <Button onClick={handleWatchVideo} className="w-full gap-2 font-display font-semibold" variant="default">
                <Play className="h-4 w-4" /> Assistir (Teste Grátis)
              </Button>
            )}

            {canWatch && isWatching && (
              <div className="text-center text-xs text-muted-foreground py-1">
                🎬 Reproduzindo — assista 70% para poder avaliar
              </div>
            )}

            {canStartTrial && (
              <Button
                onClick={handleStartTrial}
                disabled={startingTrial}
                className="w-full gap-2 font-display font-semibold"
                variant="outline"
              >
                <Gift className="h-4 w-4" />
                {startingTrial ? "Ativando..." : "Iniciar Teste Grátis"}
              </Button>
            )}

            <Button onClick={handleSubscribe} className="w-full gap-2 font-display font-semibold">
              <Zap className="h-4 w-4" /> Assinar — acesso total
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
