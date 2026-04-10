import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, Play, ShoppingCart, Zap, Clock, BookOpen, Gift, AlertTriangle, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoPlayer from "@/components/VideoPlayer";
import VideoShareButtons from "@/components/VideoShareButtons";
import { getVideoById } from "@/data/courses";
import { RatingStars } from "@/components/VideoDetailModal";

const DEMO_VIDEO_URL = "/demo-course.mp4";

const VideoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const trial = useFreeTrial();
  const { data: branding } = usePlatformSettings("branding");

  const video = id ? getVideoById(id) : null;

  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingData, setRatingData] = useState<{ average: number; count: number; userRating: number | null }>({ average: 0, count: 0, userRating: null });
  const [submitting, setSubmitting] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [hasWatched70, setHasWatched70] = useState(false);
  const [isWatching, setIsWatching] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasFullAccess, setHasFullAccess] = useState(false);

  useEffect(() => {
    if (!video) return;
    const checkAccess = async () => {
      if (!user) { setHasFullAccess(false); return; }
      if (trial.hasActiveTrial) { setHasFullAccess(true); return; }
      const { data: purchase } = await supabase
        .from("video_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_id", video.id)
        .eq("payment_status", "completed")
        .limit(1);
      if (purchase && purchase.length > 0) { setHasFullAccess(true); return; }
      setHasFullAccess(false);
    };
    checkAccess();
  }, [video, user, trial.hasActiveTrial]);

  useEffect(() => {
    if (video) {
      fetchRatings();
      checkWatchProgress();
      setViewId(null);
      setShowPaywall(false);
      setIsWatching(true);
      if (user) startViewTracking(video.id);
    }
  }, [video, user]);

  const startViewTracking = async (contentId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("video_views")
      .insert({ user_id: user.id, content_type: "lesson", content_id: contentId, watch_percentage: 0 })
      .select("id")
      .single();
    if (data) setViewId(data.id);
  };

  const checkWatchProgress = async () => {
    if (!video || !user) { setHasWatched70(false); return; }
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
    const payload = { user_id: user.id, content_type: "lesson" as const, content_id: video.id, rating: value };
    if (ratingData.userRating !== null) {
      await supabase.from("video_ratings").update({ rating: value }).eq("user_id", user.id).eq("content_type", "lesson").eq("content_id", video.id);
    } else {
      await supabase.from("video_ratings").insert(payload);
    }
    toast.success("Avaliação registrada!");
    await fetchRatings();
    setSubmitting(false);
  };

  const handleStartTrial = async () => {
    if (!user) { navigate("/login"); return; }
    setStartingTrial(true);
    const ok = await trial.startTrial();
    if (ok) { toast.success("Teste grátis ativado!"); setShowPaywall(false); setHasFullAccess(true); }
    else toast.error("Não foi possível iniciar o teste grátis.");
    setStartingTrial(false);
  };

  const handleReplayVideo = () => {
    setIsWatching(true);
    setShowPaywall(false);
    if (user && video) startViewTracking(video.id);
  };

  const handleProgressMilestone = useCallback((pct: number) => { if (pct >= 70) setHasWatched70(true); }, []);
  const handlePreviewLimitReached = useCallback(() => { setShowPaywall(true); }, []);

  const handleBuyUnit = () => {
    if (!user) { navigate("/login"); return; }
    toast.info("Compra unitária será integrada com Stripe em breve.");
  };

  const handleSubscribe = () => {
    if (!user) { navigate("/login"); return; }
    navigate("/");
    setTimeout(() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }), 300);
  };

  const handleGoToSignup = () => navigate("/signup/student");

  if (!video) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-12 md:px-16 lg:px-32">
          <h1 className="text-2xl font-display font-bold text-foreground mb-4">Vídeo não encontrado</h1>
          <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button>
        </div>
        <Footer />
      </div>
    );
  }

  const trialExpired = trial.trialRow && !trial.hasActiveTrial;
  const canStartTrial = trial.trialEnabled && !trial.trialRow;
  const previewLimit = hasFullAccess ? undefined : 20;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <div className="flex-1 pt-16">
        {/* Back button */}
        <div className="px-4 py-3 md:px-12 lg:px-20">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8 pb-12">
          {/* Video area */}
          <div className="relative rounded-xl overflow-hidden bg-black">
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
                logoUrl={branding?.logo_url}
              />
            ) : (
              <div className="relative aspect-video w-full cursor-pointer" onClick={handleReplayVideo}>
                <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                  <div className="rounded-full bg-primary p-4"><Play className="h-6 w-6 text-primary-foreground" fill="currentColor" /></div>
                </div>
              </div>
            )}

            {showPaywall && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-4 sm:p-6 text-center overflow-y-auto">
                <div className="flex flex-col items-center w-full max-w-xs my-auto">
                  <div className="rounded-full bg-primary/10 p-2 sm:p-3 mb-2 sm:mb-3"><Lock className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /></div>
                  <h3 className="text-base sm:text-lg font-display font-bold text-foreground mb-1">Prévia encerrada</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">Você assistiu a prévia gratuita! Gostou do vídeo? Para continuar, escolha uma das opções abaixo:</p>
                  <div className="flex flex-col gap-1.5 sm:gap-2 w-full">
                    {!user && <Button onClick={handleGoToSignup} size="sm" className="w-full gap-2 font-display font-semibold text-xs sm:text-sm">Criar conta gratuita</Button>}
                    {canStartTrial && (
                      <Button onClick={handleStartTrial} disabled={startingTrial} variant={user ? "default" : "outline"} size="sm" className="w-full gap-2 font-display font-semibold text-xs sm:text-sm">
                        <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {startingTrial ? "Ativando..." : "Iniciar Teste Grátis"}
                      </Button>
                    )}
                    <Button onClick={handleSubscribe} variant={!user || canStartTrial ? "outline" : "default"} size="sm" className="w-full gap-2 font-display font-semibold text-xs sm:text-sm">
                      <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Assinar — acesso total
                    </Button>
                    <Button onClick={handleBuyUnit} variant="outline" size="sm" className="w-full gap-2 font-display font-semibold text-xs sm:text-sm">
                      <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Comprar este vídeo — R$ 19,90
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video info */}
          <div className="mt-6 space-y-5">
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground">{video.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{video.description}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{video.lessons} aulas</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{video.duration}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">{video.level}</span>
            </div>

            {user && !trial.loading && (
              <>
                {trial.hasActiveTrial && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <Gift className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">
                      {trial.trialType === "days" ? `Teste grátis ativo — ${trial.daysRemaining} dia(s) restante(s)` : `Teste grátis ativo — ${trial.videosRemaining} acesso(s) restante(s)`}
                    </span>
                  </div>
                )}
                {trialExpired && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-sm text-foreground">Seu teste grátis expirou. Assine para continuar assistindo.</span>
                  </div>
                )}
              </>
            )}

            {/* Rating */}
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
                      <button key={s} disabled={submitting} onMouseEnter={() => setHoveredStar(s)} onMouseLeave={() => setHoveredStar(0)} onClick={() => handleRate(s)} className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50">
                        <Star className={`h-5 w-5 ${s <= (hoveredStar || rating) ? "fill-accent text-accent" : "text-muted-foreground/40"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {user && !hasWatched70 && <p className="text-xs text-muted-foreground italic">Assista pelo menos 70% do vídeo para poder avaliar.</p>}
            </div>

            {/* Access options */}
            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opções de acesso</p>
              {isWatching && !showPaywall && (
                <div className="text-center text-xs text-muted-foreground py-1">
                  {hasFullAccess ? "🎬 Reproduzindo — assista 70% para poder avaliar" : "🎬 Prévia gratuita — até 20% do vídeo"}
                </div>
              )}
              {canStartTrial && (
                <Button onClick={handleStartTrial} disabled={startingTrial} className="w-full gap-2 font-display font-semibold" variant="outline">
                  <Gift className="h-4 w-4" /> {startingTrial ? "Ativando..." : "Iniciar Teste Grátis"}
                </Button>
              )}
              <Button onClick={handleSubscribe} className="w-full gap-2 font-display font-semibold"><Zap className="h-4 w-4" /> Assinar — acesso total</Button>
              <Button onClick={handleBuyUnit} variant="outline" className="w-full gap-2 font-display font-semibold"><ShoppingCart className="h-4 w-4" /> Comprar este vídeo — R$ 19,90</Button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default VideoPage;
