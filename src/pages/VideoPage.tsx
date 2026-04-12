import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Play, ShoppingCart, Zap, Clock, BookOpen, Gift, AlertTriangle, Lock, ArrowLeft, FileText, ClipboardList, Trophy, StickyNote, HelpCircle, CalendarCheck, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFreeTrial } from "@/hooks/useFreeTrial";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useResourceLimit, type ResourceType } from "@/hooks/useResourceLimit";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoPlayer from "@/components/VideoPlayer";
import VideoShareButtons from "@/components/VideoShareButtons";
import { getVideoById } from "@/data/courses";
import type { Video } from "@/data/courses";
import DoubtForm from "@/components/DoubtForm";
import { RatingStars } from "@/components/VideoDetailModal";
import ResourceLimitModal from "@/components/ResourceLimitModal";
import CpfRequiredModal from "@/components/CpfRequiredModal";
import { useCpfGuard } from "@/hooks/useCpfGuard";
import VLibrasWidget from "@/components/VLibrasWidget";

const DEMO_VIDEO_URL = "/demo-course.mp4";

const VideoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const trial = useFreeTrial();
  const { data: branding } = usePlatformSettings("branding");
  const resourceLimit = useResourceLimit();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{ resourceType: string; used: number; total: number; hasSubscription: boolean; individualPrice: number | null } | null>(null);

  const staticVideo = id ? getVideoById(id) : null;

  const [dbVideo, setDbVideo] = useState<Video | null>(null);
  const [contentType, setContentType] = useState<"lesson" | "exam_solution">("lesson");
  const [loadingDb, setLoadingDb] = useState(!staticVideo);
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
  const [teacherProfile, setTeacherProfile] = useState<{ name: string; avatar_url: string | null; slug: string | null } | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<string | null>(null);
  const [provaVotePercent, setProvaVotePercent] = useState<number | null>(null);
  const [userProvaVote, setUserProvaVote] = useState<boolean | null>(null);
  const [votingProva, setVotingProva] = useState(false);
  const [isDoubtsOpen, setIsDoubtsOpen] = useState(false);

  const resolveVideoPlaybackUrl = useCallback(async (storedVideoUrl?: string | null) => {
    if (!storedVideoUrl) return undefined;

    const marker = "/videos/";
    const markerIndex = storedVideoUrl.indexOf(marker);
    const storagePath = markerIndex >= 0
      ? decodeURIComponent(storedVideoUrl.slice(markerIndex + marker.length).split("?")[0])
      : storedVideoUrl.replace(/^\/+/, "");

    if (!storagePath) return storedVideoUrl || undefined;

    const { data, error } = await supabase.storage
      .from("videos")
      .createSignedUrl(storagePath, 60 * 60);

    if (error || !data?.signedUrl) {
      return /^https?:\/\//.test(storedVideoUrl) ? storedVideoUrl : undefined;
    }

    return data.signedUrl;
  }, []);

  // Fetch video from DB if not found in static data
  useEffect(() => {
    if (staticVideo || !id) { setLoadingDb(false); return; }
    if (authLoading) return;

    const fetchFromDb = async () => {
      setLoadingDb(true);
      const { data: lesson } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (lesson) {
        const lessonVideoUrl = await resolveVideoPlaybackUrl(lesson.video_url);
        setDbVideo({
          id: lesson.id,
          title: lesson.title,
          description: lesson.description || "",
          thumbnail: lesson.thumbnail_url || "",
          duration: "",
          category: (lesson.areas && lesson.areas.length > 0) ? lesson.areas[0] : "",
          instructor: "",
          lessons: 1,
          videoUrl: lessonVideoUrl || undefined,
        });
        setTeacherId(lesson.teacher_id);
        setVideoType(lesson.video_type);
        setContentType("lesson");
        setLoadingDb(false);
        return;
      }

      const { data: exam } = await supabase
        .from("exam_solutions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (exam) {
        const examVideoUrl = await resolveVideoPlaybackUrl(exam.video_url);
        setDbVideo({
          id: exam.id,
          title: exam.title,
          description: exam.description || "",
          thumbnail: exam.thumbnail_url || "",
          duration: "",
          category: (exam.areas && exam.areas.length > 0) ? exam.areas[0] : "",
          instructor: "",
          lessons: 1,
          videoUrl: examVideoUrl || undefined,
        });
        setTeacherId(exam.teacher_id);
        setVideoType(exam.video_type);
        setContentType("exam_solution");
        setLoadingDb(false);
        return;
      }

      setLoadingDb(false);
    };

    fetchFromDb();
  }, [authLoading, id, resolveVideoPlaybackUrl, staticVideo]);

  const video = staticVideo || dbVideo;

  const VIDEO_TYPE_TO_RESOURCE: Record<string, ResourceType> = {
    revisao: "revisao",
    resolucao_prova: "revisao",
    resumo: "resumo",
    simulado: "simulado",
    top_questoes: "top_questoes",
    colinha: "colinha",
    duvida: "duvida",
    aula_particular: "aula_particular",
  };

  useEffect(() => {
    if (!video) return;
    const checkAccess = async () => {
      if (!user) { setHasFullAccess(false); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const userRoles = roles?.map((r) => r.role) || [];
      if (userRoles.includes("admin")) { setHasFullAccess(true); return; }
      if (userRoles.includes("teacher") && teacherId === user.id) { setHasFullAccess(true); return; }

      if (trial.hasActiveTrial) { setHasFullAccess(true); return; }

      // Check individual purchase
      const { data: purchase } = await supabase
        .from("video_purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_id", video.id)
        .eq("payment_status", "completed")
        .limit(1);
      if (purchase && purchase.length > 0) { setHasFullAccess(true); return; }

      // Check subscription resource limit
      if (resourceLimit.loaded && videoType) {
        const rt = VIDEO_TYPE_TO_RESOURCE[videoType];
        if (rt) {
          const result = resourceLimit.checkLimit(rt);
          if (result.hasSubscription && result.allowed) {
            setHasFullAccess(true);
            return;
          }
          if (result.hasSubscription && !result.allowed) {
            // Will show modal when user tries to play
            setLimitInfo({ resourceType: rt, used: result.used, total: result.total, hasSubscription: result.hasSubscription, individualPrice: result.individualPrice });
          }
          if (!result.hasSubscription) {
            setLimitInfo({ resourceType: rt, used: 0, total: 0, hasSubscription: false, individualPrice: result.individualPrice });
          }
        }
      }

      setHasFullAccess(false);
    };
    checkAccess();
  }, [video, user, trial.hasActiveTrial, teacherId, resourceLimit.loaded, videoType]);

  useEffect(() => {
    if (!video || dbVideo) return;
    const fetchTeacherAndType = async () => {
      let tId: string | null = null;
      let vType: string | null = null;

      const { data: lesson } = await supabase
        .from("lessons")
        .select("teacher_id, video_type")
        .eq("id", video.id)
        .limit(1)
        .maybeSingle();
      tId = lesson?.teacher_id ?? null;
      setTeacherId(tId);
      vType = lesson?.video_type ?? null;

      if (!tId) {
        const { data: exam } = await supabase
          .from("exam_solutions")
          .select("teacher_id, video_type")
          .eq("id", video.id)
          .limit(1)
          .maybeSingle();
        tId = exam?.teacher_id ?? null;
        setTeacherId(tId);
        vType = exam?.video_type ?? null;
      }

      setVideoType(vType);
    };
    fetchTeacherAndType();
  }, [video, dbVideo]);

  useEffect(() => {
    if (!teacherId) return;
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url, slug")
        .eq("user_id", teacherId)
        .maybeSingle();
      if (profile) setTeacherProfile(profile);
    };
    fetchProfile();
  }, [teacherId]);

  const fetchProvaVotes = useCallback(async () => {
    if (!video) return;
    const { data: votes } = await supabase
      .from("prova_votes")
      .select("vote, user_id")
      .eq("content_id", video.id);
    if (votes && votes.length > 0) {
      const yesCount = votes.filter(v => v.vote === true).length;
      setProvaVotePercent(Math.round((yesCount / votes.length) * 100));
      if (user) {
        const uv = votes.find(v => v.user_id === user.id);
        setUserProvaVote(uv?.vote ?? null);
      }
    } else {
      setProvaVotePercent(null);
      setUserProvaVote(null);
    }
  }, [video, user]);

  useEffect(() => {
    if (videoType === "resolucao_prova") fetchProvaVotes();
  }, [videoType, fetchProvaVotes]);

  const handleProvaVote = async (vote: boolean) => {
    if (!user) { toast.error("Faça login para votar."); return; }
    if (!video) return;
    setVotingProva(true);
    if (userProvaVote !== null) {
      await supabase.from("prova_votes").update({ vote }).eq("content_id", video.id).eq("user_id", user.id);
    } else {
      await supabase.from("prova_votes").insert({ content_id: video.id, content_type: contentType, user_id: user.id, vote });
    }
    await fetchProvaVotes();
    setVotingProva(false);
  };

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
      .insert({ user_id: user.id, content_type: contentType, content_id: contentId, watch_percentage: 0 })
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
      .eq("content_type", contentType)
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
      .eq("content_type", contentType)
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
    const payload = { user_id: user.id, content_type: contentType, content_id: video.id, rating: value };
    if (ratingData.userRating !== null) {
      await supabase.from("video_ratings").update({ rating: value }).eq("user_id", user.id).eq("content_type", contentType).eq("content_id", video.id);
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
    if (ok) {
      toast.success("Teste grátis ativado!");
      setShowPaywall(false);
      setHasFullAccess(true);
    } else {
      toast.error("Não foi possível iniciar o teste grátis.");
    }
    setStartingTrial(false);
  };

  const handleReplayVideo = () => {
    setIsWatching(true);
    setShowPaywall(false);
    if (user && video) startViewTracking(video.id);
  };

  const handleOpenDoubts = () => {
    setIsDoubtsOpen(true);
    if (!user) {
      toast.info("Faça login para enviar sua dúvida.");
    } else if (!teacherId) {
      toast.info("Este vídeo demonstrativo não recebe dúvidas.");
    }
  };

  const handleProgressMilestone = useCallback((pct: number) => {
    if (pct >= 70) setHasWatched70(true);
  }, []);

  const handlePreviewLimitReached = useCallback(() => {
    if (limitInfo) {
      setShowLimitModal(true);
    } else {
      setShowPaywall(true);
    }
  }, [limitInfo]);

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

  if (loadingDb) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-24">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-12 md:px-16 lg:px-32">
          <h1 className="mb-4 text-2xl font-display font-bold text-foreground">Vídeo não encontrado</h1>
          <Button onClick={() => navigate("/")} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
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
      <VLibrasWidget />
      <Navbar />

      {limitInfo && (
        <ResourceLimitModal
          open={showLimitModal}
          onClose={() => setShowLimitModal(false)}
          resourceType={limitInfo.resourceType}
          used={limitInfo.used}
          total={limitInfo.total}
          hasSubscription={limitInfo.hasSubscription}
          individualPrice={limitInfo.individualPrice}
          onBuyIndividual={() => {
            toast.info("Compra individual será integrada com Stripe em breve.");
          }}
        />
      )}

      <Dialog open={isDoubtsOpen} onOpenChange={setIsDoubtsOpen}>
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Dúvidas sobre este conteúdo
            </DialogTitle>
          </DialogHeader>

          {user ? (
            teacherId ? (
              <DoubtForm contentId={video.id} contentType={contentType} teacherId={teacherId} />
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Este vídeo é demonstrativo e não está vinculado a um professor, então não é possível enviar dúvidas por aqui.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-sm text-muted-foreground">Faça login para enviar sua dúvida ao professor.</p>
              <div>
                <Button size="sm" onClick={() => navigate("/login")}>Fazer login</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex-1 pt-16">
        <div className="px-4 py-3 md:px-12 lg:px-20">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>

        <div className="mx-auto max-w-4xl px-4 pb-12 md:px-8">
          <div className="mb-4 space-y-2">
            {(() => {
              const teacherSlug = teacherProfile?.slug;
              const teacherLink = teacherSlug ? `/${teacherSlug}` : undefined;
              const avatarContent = (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                  {teacherProfile?.avatar_url ? (
                    <img src={teacherProfile.avatar_url} alt={teacherProfile.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">
                      {(teacherProfile?.name || video.instructor)?.charAt(0) || "P"}
                    </span>
                  )}
                </div>
              );
              const nameContent = <span className="text-xs text-muted-foreground transition-colors hover:text-primary">{teacherProfile?.name || video.instructor}</span>;
              return (
                <div className="flex items-center gap-2.5">
                  {teacherLink ? <Link to={teacherLink}>{avatarContent}</Link> : avatarContent}
                  <div className="min-w-0">
                    <h1 className="truncate font-display text-xl font-bold leading-tight text-foreground sm:text-2xl">{video.title}</h1>
                    {teacherLink ? <Link to={teacherLink}>{nameContent}</Link> : nameContent}
                  </div>
                </div>
              );
            })()}
            <p className="text-sm leading-relaxed text-muted-foreground">{video.description}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{video.lessons} aulas</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{video.duration}</span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-black">
            {isWatching ? (
              <VideoPlayer
                videoUrl={video.videoUrl || DEMO_VIDEO_URL}
                contentId={video.id}
                contentType={contentType}
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
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto bg-background/90 p-4 text-center backdrop-blur-sm sm:p-6">
                <div className="my-auto flex w-full max-w-xs flex-col items-center">
                  <div className="mb-2 rounded-full bg-primary/10 p-2 sm:mb-3 sm:p-3"><Lock className="h-6 w-6 text-primary sm:h-8 sm:w-8" /></div>
                  <h3 className="mb-1 text-base font-display font-bold text-foreground sm:text-lg">Prévia encerrada</h3>
                  <p className="mb-3 text-xs text-muted-foreground sm:mb-4 sm:text-sm">Você assistiu a prévia gratuita! Gostou do vídeo? Para continuar, escolha uma das opções abaixo:</p>
                  <div className="flex w-full flex-col gap-1.5 sm:gap-2">
                    {!user && <Button onClick={handleGoToSignup} size="sm" className="w-full gap-2 font-display text-xs font-semibold sm:text-sm">Criar conta gratuita</Button>}
                    {canStartTrial && (
                      <Button onClick={handleStartTrial} disabled={startingTrial} variant={user ? "default" : "outline"} size="sm" className="w-full gap-2 font-display text-xs font-semibold sm:text-sm">
                        <Gift className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> {startingTrial ? "Ativando..." : "Iniciar Teste Grátis"}
                      </Button>
                    )}
                    <Button onClick={handleSubscribe} variant={!user || canStartTrial ? "outline" : "default"} size="sm" className="w-full gap-2 font-display text-xs font-semibold sm:text-sm">
                      <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Assinar — acesso total
                    </Button>
                    <Button onClick={handleBuyUnit} variant="outline" size="sm" className="w-full gap-2 font-display text-xs font-semibold sm:text-sm">
                      <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Comprar este vídeo — R$ 19,90
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <VideoShareButtons videoTitle={video.title} videoUrl={window.location.href} />

              {videoType === "resolucao_prova" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Caiu na sua Prova?</span>
                  <Button
                    variant={userProvaVote === true ? "default" : "outline"}
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={votingProva}
                    onClick={() => handleProvaVote(true)}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> Sim
                  </Button>
                  <Button
                    variant={userProvaVote === false ? "default" : "outline"}
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    disabled={votingProva}
                    onClick={() => handleProvaVote(false)}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> Não
                  </Button>
                  {provaVotePercent !== null && (
                    <span className="ml-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                      {provaVotePercent}% sim
                    </span>
                  )}
                </div>
              )}
            </div>

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
              {user && !hasWatched70 && <p className="text-xs italic text-muted-foreground">Assista pelo menos 70% do vídeo para poder avaliar.</p>}
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[
                { icon: FileText, label: "Resumo" },
                { icon: ClipboardList, label: "Simulado" },
                { icon: Trophy, label: "Top Questões" },
                { icon: StickyNote, label: "Colinha" },
                { icon: HelpCircle, label: "Dúvidas", action: handleOpenDoubts },
                { icon: CalendarCheck, label: "Aula Particular" },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-secondary/30 p-3 transition-colors hover:bg-secondary/60"
                >
                  <Icon className="h-6 w-6 text-foreground" />
                  <span className="text-center text-[10px] leading-tight text-muted-foreground sm:text-xs">{label}</span>
                </button>
              ))}
            </div>

            {user && !trial.loading && (
              <>
                {trial.hasActiveTrial && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <Gift className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-foreground">
                      {trial.trialType === "days" ? `Teste grátis ativo — ${trial.daysRemaining} dia(s) restante(s)` : `Teste grátis ativo — ${trial.videosRemaining} acesso(s) restante(s)`}
                    </span>
                  </div>
                )}
                {trialExpired && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    <span className="text-sm text-foreground">Seu teste grátis expirou. Assine para continuar assistindo.</span>
                  </div>
                )}
              </>
            )}

            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opções de acesso</p>
              {isWatching && !showPaywall && (
                <div className="py-1 text-center text-xs text-muted-foreground">
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
