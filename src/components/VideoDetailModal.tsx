import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, Play, ShoppingCart, Zap, Clock, BookOpen, Gift, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import VideoPlayer from "@/components/VideoPlayer";
import CpfRequiredModal from "@/components/CpfRequiredModal";
import { useCpfGuard } from "@/hooks/useCpfGuard";
import { startUnitCheckout } from "@/lib/payments";
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

const DEMO_VIDEO_URL = "/demo-course.mp4";
const PENDING_TRIAL_INTENT_KEY = "revisao_facil_pending_trial_intent";
const TRIAL_ALREADY_USED_MESSAGE = "Você já utilizou seu teste grátis anteriormente!";

const VideoDetailModal = ({ video, open, onClose }: VideoDetailModalProps) => {
  const { user } = useAuth();
  const trial = useFreeTrial();
  const navigate = useNavigate();
  const { data: videoPricing } = usePlatformSettings("video_pricing");
  const { requireCpf, showCpfModal, setShowCpfModal, onCpfComplete } = useCpfGuard();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingData, setRatingData] = useState<RatingData>({ average: 0, count: 0, userRating: null });
  const [submitting, setSubmitting] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [hasWatched70, setHasWatched70] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);
  const [trialAccessContentId, setTrialAccessContentId] = useState<string | null>(null);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [contentType, setContentType] = useState<"lesson" | "exam_solution">("lesson");
  const [buying, setBuying] = useState(false);
  const recordedTrialAccessRef = useRef<Set<string>>(new Set());

  // Check if user has full access (subscription, purchase, or active trial)
  useEffect(() => {
    if (!video || !open) return;

    const checkAccess = async () => {
      if (!user) {
        setHasFullAccess(false);
        return;
      }

      // Admins have full access
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const userRoles = roles?.map((r) => r.role) || [];
      if (userRoles.includes("admin")) { setHasFullAccess(true); return; }

      if (trialAccessContentId === video.id) {
        setHasFullAccess(true);
        return;
      }

      // Check active trial
      if (trial.hasActiveTrial) {
        setHasFullAccess(true);
        return;
      }

      // Check unit purchase
      const { data: purchase } = await supabase
        .from("video_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_id", video.id)
        .eq("payment_status", "completed")
        .limit(1);

      if (purchase && purchase.length > 0) {
        setHasFullAccess(true);
        return;
      }

      setHasFullAccess(false);
    };

    checkAccess();
  }, [video, open, user, trial.hasActiveTrial, trialAccessContentId]);

  useEffect(() => {
    if (video && open) {
      fetchRatings();
      checkWatchProgress();
      setViewId(null);
      setShowPaywall(false);
      setIsWatching(true);
      setTrialAccessContentId(null);
      if (user) {
        startViewTracking(video.id);
      }
      // Fetch price + content type
      (async () => {
        const { data: lesson } = await supabase
          .from("lessons")
          .select("price, video_type")
          .eq("id", video.id)
          .maybeSingle();
        if (lesson) {
          setUnitPrice(Number(lesson.price) || 0);
          setContentType("lesson");
          return;
        }
        const { data: exam } = await supabase
          .from("exam_solutions")
          .select("price, video_type")
          .eq("id", video.id)
          .maybeSingle();
        if (exam) {
          setUnitPrice(Number(exam.price) || 0);
          setContentType("exam_solution");
        } else {
          setUnitPrice(null);
        }
      })();
    } else {
      setIsWatching(false);
      setShowPaywall(false);
    }
  }, [video, open, user]);

  useEffect(() => {
    if (!open || !user || !video || trial.loading || !trial.hasActiveTrial) return;
    const accessKey = `${user.id}:${video.id}`;
    if (recordedTrialAccessRef.current.has(accessKey)) return;

    recordedTrialAccessRef.current.add(accessKey);
    setTrialAccessContentId(video.id);

    trial.recordContentAccess().then((ok) => {
      if (!ok) recordedTrialAccessRef.current.delete(accessKey);
    });
  }, [open, user, video, trial.loading, trial.hasActiveTrial, trial.recordContentAccess]);

  const startViewTracking = async (contentId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("video_views")
      .insert({
        user_id: user.id,
        content_type: "lesson",
        content_id: contentId,
        watch_percentage: 0,
      })
      .select("id")
      .single();
    if (data) setViewId(data.id);
  };

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
    const [aggRes, ownRes] = await Promise.all([
      supabase.rpc("get_video_rating_aggregates" as any, { _ids: [video.id] }),
      user
        ? supabase
            .from("video_ratings")
            .select("rating")
            .eq("content_type", "lesson")
            .eq("content_id", video.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const agg = ((aggRes.data as any[]) || []).find(
      (r) => r.content_type === "lesson" && r.content_id === video.id,
    );
    const userR = (ownRes as any).data?.rating ?? null;
    if (agg) {
      setRatingData({ average: Number(agg.average) || 0, count: agg.count || 0, userRating: userR });
      if (userR) setRating(userR);
    } else {
      setRatingData({ average: 0, count: 0, userRating: userR });
      setRating(userR ?? 0);
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
    if (!user) {
      onClose();
      const returnTo = `/video/${video?.id ?? ""}?intent=trial`;
      window.sessionStorage.setItem(PENDING_TRIAL_INTENT_KEY, "1");
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setStartingTrial(true);
    const ok = await trial.startTrial();
    if (ok) {
      toast.success("Teste grátis ativado! Aproveite.");
      setShowPaywall(false);
      if (video?.id) setTrialAccessContentId(video.id);
      setHasFullAccess(true);
    } else {
      toast.error(TRIAL_ALREADY_USED_MESSAGE);
    }
    setStartingTrial(false);
  };

  const handleReplayVideo = () => {
    setIsWatching(true);
    setShowPaywall(false);
    if (user && video) {
      startViewTracking(video.id);
    }
  };

  const handleProgressMilestone = useCallback((pct: number) => {
    if (pct >= 70) {
      setHasWatched70(true);
    }
  }, []);

  const handlePreviewLimitReached = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const handleBuyUnit = () => {
    if (!user) {
      onClose();
      navigate("/login");
      return;
    }
    if (!video) return;
    requireCpf(() => {
      setBuying(true);
      const ok = startUnitCheckout({
        contentId: video.id,
        contentType,
        contentTitle: video.title,
        unitPrice: effectivePrice,
        cancelUrl: `/video/${video.id}`,
        navigate,
      });
      if (!ok) {
        setBuying(false);
      } else {
        onClose();
      }
    });
  };

  const handleSubscribe = () => {
    if (!user) {
      onClose();
      navigate("/#pricing");
      return;
    }
    onClose();
    navigate("/#pricing");
  };

  const handleGoToSignup = () => {
    onClose();
    const returnTo = `/video/${video.id}?intent=trial`;
    window.sessionStorage.setItem(PENDING_TRIAL_INTENT_KEY, "1");
    navigate(`/signup/student?returnTo=${encodeURIComponent(returnTo)}`);
  };

  if (!video) return null;

  const trialExpired = trial.trialRow && !trial.hasActiveTrial;
  const canStartTrial = trial.trialEnabled && !trial.trialRow;
  const previewLimit = hasFullAccess ? undefined : 20;

  const minPrice = videoPricing
    ? (contentType === "lesson" ? videoPricing.default_lesson_price : videoPricing.default_exam_solution_price) ?? 0
    : 0;
  const effectivePrice = Math.max(unitPrice ?? 0, minPrice);
  const priceLabel = effectivePrice > 0 ? `R$ ${effectivePrice.toFixed(2).replace(".", ",")}` : null;
  const buyDisabled = buying || effectivePrice <= 0;

  return (
    <>
    <CpfRequiredModal open={showCpfModal} onClose={() => setShowCpfModal(false)} onComplete={onCpfComplete} />
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 border-border bg-card">
        {/* Video area */}
        <div className="relative">
          {isWatching ? (
            <VideoPlayer
              videoUrl={video.videoUrl || DEMO_VIDEO_URL}
              contentId={video.id}
              contentType="lesson"
              viewId={viewId}
              onProgressMilestone={handleProgressMilestone}
              poster={video.thumbnail}
              previewLimit={previewLimit}
              onPreviewLimitReached={handlePreviewLimitReached}
            />
          ) : (
            <div
              className="relative aspect-video w-full overflow-hidden cursor-pointer"
              onClick={handleReplayVideo}
            >
              <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <div className="rounded-full bg-primary p-4">
                  <Play className="h-6 w-6 text-primary-foreground" fill="currentColor" />
                </div>
              </div>
            </div>
          )}

          {/* Paywall overlay at 20% */}
          {showPaywall && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-6 text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-3">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-1">
                Prévia encerrada
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Você assistiu a prévia gratuita de 20%. Para continuar, escolha uma das opções abaixo:
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {!user && (
                  <Button onClick={handleGoToSignup} className="w-full gap-2 font-display font-semibold">
                    Criar conta gratuita
                  </Button>
                )}
                {canStartTrial && (
                  <Button
                    onClick={handleStartTrial}
                    disabled={startingTrial}
                    variant={user ? "default" : "outline"}
                    className="w-full gap-2 font-display font-semibold"
                  >
                    <Gift className="h-4 w-4" />
                    {startingTrial ? "Ativando..." : "Iniciar Teste Grátis"}
                  </Button>
                )}
                <Button onClick={handleSubscribe} variant={!user || canStartTrial ? "outline" : "default"} className="w-full gap-2 font-display font-semibold">
                  <Zap className="h-4 w-4" /> Assinar — acesso total
                </Button>
                {priceLabel && (
                  <Button onClick={handleBuyUnit} disabled={buyDisabled} variant="outline" className="w-full gap-2 font-display font-semibold">
                    <ShoppingCart className="h-4 w-4" /> {buying ? "Processando..." : `Comprar este vídeo — ${priceLabel}`}
                  </Button>
                )}
              </div>
            </div>
          )}
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
                  <button
                    type="button"
                    onClick={handleSubscribe}
                    className="border-0 bg-transparent p-0 text-left text-sm text-foreground underline hover:text-primary"
                  >
                    Seu teste grátis expirou. Assine para continuar assistindo.
                  </button>
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

            {isWatching && !showPaywall && (
              <div className="text-center text-xs text-muted-foreground py-1">
                {hasFullAccess
                  ? "🎬 Reproduzindo — assista 70% para poder avaliar"
                  : "🎬 Prévia gratuita — até 20% do vídeo"}
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
            {priceLabel && (
              <Button onClick={handleBuyUnit} disabled={buyDisabled} variant="outline" className="w-full gap-2 font-display font-semibold">
                <ShoppingCart className="h-4 w-4" /> {buying ? "Processando..." : `Comprar este vídeo — ${priceLabel}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
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
