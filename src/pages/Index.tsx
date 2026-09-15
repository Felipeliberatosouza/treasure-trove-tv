import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import FreeTrialBanner from "@/components/FreeTrialBanner";
import VideoCarousel from "@/components/VideoCarousel";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import SecondaryBanner from "@/components/SecondaryBanner";
import TeacherHomeStats from "@/components/teacher/TeacherHomeStats";
import BookLessonSection from "@/components/BookLessonSection";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useHomepageAreas } from "@/hooks/useCourseAreas";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2, Sparkles, Plus, SlidersHorizontal, Send, BookOpen, FileQuestion, ListChecks, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence, motion } from "framer-motion";
import type { Video } from "@/data/courses";

interface SearchResult {
  id: string;
  title: string;
  type: "lesson" | "exam_solution";
}

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const { data: trialSettings } = usePlatformSettings("free_trial");
  const showTrialBadge = trialSettings?.enabled ?? false;
  const { areas } = useHomepageAreas();
  const [areaLessons, setAreaLessons] = useState<Record<string, Video[]>>({});
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [popularVideos, setPopularVideos] = useState<Video[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [teacherLessons, setTeacherLessons] = useState<Video[]>([]);
  const [teacherExams, setTeacherExams] = useState<Video[]>([]);
  const [loadingTeacherContent, setLoadingTeacherContent] = useState(false);
  const [revisionTopic, setRevisionTopic] = useState("");

  const isTeacher = role === "teacher";

  // Inline search state
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [inlineQuery, setInlineQuery] = useState("");
  const [inlineResults, setInlineResults] = useState<SearchResult[]>([]);
  const [inlineSearching, setInlineSearching] = useState(false);
  const inlineSearchRef = useRef<HTMLInputElement>(null);
  const popularSectionRef = useRef<HTMLDivElement>(null);

  // Fetch watched video IDs for logged-in students
  useEffect(() => {
    if (!user || role !== "student") {
      setWatchedIds(new Set());
      return;
    }
    const fetchWatched = async () => {
      const { data } = await supabase
        .from("video_views")
        .select("content_id")
        .eq("user_id", user.id);
      setWatchedIds(new Set((data || []).map((v) => v.content_id)));
    };
    fetchWatched();
  }, [user, role]);

  // Fetch popular videos based on student's interest areas
  useEffect(() => {
    const studentAreas = profile?.areas;
    const isStudent = role === "student" && user && studentAreas && studentAreas.length > 0;

    if (!isStudent) {
      setPopularVideos([]);
      return;
    }

    const fetchPopular = async () => {
      setLoadingPopular(true);

      // Fetch all view counts and lessons in parallel
      const { fetchMinViewPercent } = await import("@/hooks/useMinViewPercent");
      const minViewPct = await fetchMinViewPercent();
      const [viewCountsRes, lessonsRes] = await Promise.all([
        supabase
          .from("video_views")
          .select("content_id, content_type")
          .gte("watch_percentage", minViewPct),
        supabase
          .from("lessons")
          .select("*")
          .eq("published", true)
          .eq("admin_approved", true)
          .overlaps("areas", studentAreas!)
          .limit(40),
      ]);

      // Count views per content
      const viewMap: Record<string, number> = {};
      (viewCountsRes.data || []).forEach((v) => {
        viewMap[v.content_id] = (viewMap[v.content_id] || 0) + 1;
      });

      const lessons = lessonsRes.data;
      if (lessons && lessons.length > 0) {
        // Sort: unwatched first, then by view count descending
        const sorted = [...lessons].sort((a, b) => {
          const aWatched = watchedIds.has(a.id) ? 1 : 0;
          const bWatched = watchedIds.has(b.id) ? 1 : 0;
          if (aWatched !== bWatched) return aWatched - bWatched;
          return (viewMap[b.id] || 0) - (viewMap[a.id] || 0);
        });
        setPopularVideos(
          sorted.slice(0, 20).map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description || "",
            thumbnail: l.thumbnail_url || "/placeholder.svg",
            duration: "",
            category: (l.areas as string[] || [])[0] || "",
            instructor: "",
            lessons: 1,
            level: "Iniciante" as const,
            videoUrl: l.video_url || undefined,
          }))
        );
      } else {
        setPopularVideos([]);
      }
      setLoadingPopular(false);
    };

    fetchPopular();
  }, [user, profile?.areas, role, watchedIds]);

  // Fetch teacher's own published content
  useEffect(() => {
    if (!isTeacher || !user) {
      setTeacherLessons([]);
      setTeacherExams([]);
      return;
    }
    const fetchOwn = async () => {
      setLoadingTeacherContent(true);
      const [lessonsRes, examsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("*")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("exam_solutions")
          .select("*")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const mapToVideo = (l: any): Video => ({
        id: l.id,
        title: l.title,
        description: l.description || "",
        thumbnail: l.thumbnail_url || "/placeholder.svg",
        duration: "",
        category: (l.areas as string[] || [])[0] || "",
        instructor: "",
        lessons: 1,
        videoUrl: l.video_url || undefined,
      });
      setTeacherLessons((lessonsRes.data || []).map(mapToVideo));
      setTeacherExams((examsRes.data || []).map(mapToVideo));
      setLoadingTeacherContent(false);
    };
    fetchOwn();
  }, [isTeacher, user]);

  useEffect(() => {
    if (areas.length === 0 || isTeacher) return;
    const fetchAreaLessons = async () => {
      setLoadingAreas(true);
      const result: Record<string, Video[]> = {};
      for (const area of areas) {
        const { data } = await supabase
          .from("lessons")
          .select("*")
          .eq("published", true)
          .eq("admin_approved", true)
          .contains("areas", [area.name])
          .limit(20);

        if (data && data.length > 0) {
          result[area.name] = data.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description || "",
            thumbnail: l.thumbnail_url || "/placeholder.svg",
            duration: "",
            category: (l.areas as string[] || [])[0] || "",
            instructor: "",
            lessons: 1,
            level: "Iniciante" as const,
            videoUrl: l.video_url || undefined,
          }));
        }
      }
      setAreaLessons(result);
      setLoadingAreas(false);
    };
    fetchAreaLessons();
  }, [areas, isTeacher]);

  // Inline search effect
  useEffect(() => {
    if (inlineQuery.trim().length < 2) {
      setInlineResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setInlineSearching(true);
      const term = `%${inlineQuery.trim()}%`;
      const [lessonsRes, examsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, title")
          .eq("published", true)
          .eq("admin_approved", true)
          .ilike("title", term)
          .limit(5),
        supabase
          .from("exam_solutions")
          .select("id, title")
          .eq("published", true)
          .eq("admin_approved", true)
          .ilike("title", term)
          .limit(5),
      ]);
      setInlineResults([
        ...(lessonsRes.data || []).map((l) => ({ id: l.id, title: l.title, type: "lesson" as const })),
        ...(examsRes.data || []).map((e) => ({ id: e.id, title: e.title, type: "exam_solution" as const })),
      ]);
      setInlineSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [inlineQuery]);

  useEffect(() => {
    if (inlineSearchOpen && inlineSearchRef.current) {
      inlineSearchRef.current.focus();
    }
  }, [inlineSearchOpen]);

  const handleVideoClick = (id: string) => {
    navigate(`/video/${id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      {!isTeacher && (
        <section className="flex items-center border-b border-border bg-background px-4 pb-12 pt-28 md:px-10 md:pb-16 md:pt-32" aria-labelledby="revision-ai-title">
          <div className="mx-auto w-full max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Seu Kit de Revisão completo em poucos minutos
            </div>
            <h1 id="revision-ai-title" className="font-display text-3xl font-bold md:text-5xl">
              {profile?.name
                ? `Qual o assunto da sua próxima prova, ${profile.name.trim().split(" ")[0]}?`
                : "Qual o assunto da sua próxima prova?"}
            </h1>
            <form
              className="mx-auto mt-10 max-w-3xl"
              onSubmit={(event) => {
                event.preventDefault();
                if (revisionTopic.trim().length < 3) return;
                navigate(`/revisao-ia?assunto=${encodeURIComponent(revisionTopic.trim())}`);
              }}
            >
              <div className="rounded-2xl border border-border bg-card p-3 text-left shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background md:p-4">
                <Textarea
                  value={revisionTopic}
                  onChange={(event) => setRevisionTopic(event.target.value)}
                  placeholder="Digite o assunto, a disciplina ou os tópicos da sua prova..."
                  maxLength={500}
                  rows={3}
                  className="min-h-[112px] resize-none border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  aria-label="Assunto da próxima prova"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && revisionTopic.trim().length >= 3) {
                      event.preventDefault();
                      navigate(`/revisao-ia?assunto=${encodeURIComponent(revisionTopic.trim())}`);
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" aria-label="Adicionar detalhes" title="Adicionar detalhes" onClick={() => navigate("/revisao-ia")}>
                      <Plus className="h-5 w-5" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => navigate("/revisao-ia")}>
                      <SlidersHorizontal className="h-4 w-4" />
                      Personalizar
                    </Button>
                  </div>
                  <Button type="submit" size="icon" className="rounded-full" disabled={revisionTopic.trim().length < 3} aria-label="Gerar Kit de Revisão" title="Gerar Kit de Revisão">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {[
                { label: "Criar resumo", icon: BookOpen },
                { label: "Criar simulado", icon: FileQuestion },
                { label: "Top Questões", icon: ListChecks },
                { label: "Criar colinha", icon: StickyNote },
              ].map(({ label, icon: Icon }) => (
                <Button key={label} type="button" variant="outline" className="rounded-full bg-background" onClick={() => navigate("/revisao-ia")}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              1ª revisão grátis, sem cadastro. Conteúdo produzido com apoio de IA.
            </p>
          </div>
        </section>
      )}
      {isTeacher && <div className="pt-20" />}
      {!isTeacher && <FreeTrialBanner />}

      <div className="space-y-12 py-12">
        {isTeacher ? (
          <>
            <TeacherHomeStats />

            {loadingTeacherContent ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando seus conteúdos...</span>
              </div>
            ) : (
              <>
                {teacherLessons.length > 0 && (
                  <VideoCarousel
                    title="🎬 Minhas Aulas"
                    videos={teacherLessons}
                    onVideoClick={handleVideoClick}
                  />
                )}
                {teacherExams.length > 0 && (
                  <VideoCarousel
                    title="📝 Minhas Resoluções de Provas"
                    videos={teacherExams}
                    onVideoClick={handleVideoClick}
                  />
                )}
                {teacherLessons.length === 0 && teacherExams.length === 0 && (
                  <div className="px-6 md:px-12 lg:px-20">
                    <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Você ainda não publicou conteúdos. Acesse o Painel do Professor para começar.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Inline search + Mais Populares */}
            <div ref={popularSectionRef} className="scroll-mt-20">
              <AnimatePresence>
                {inlineSearchOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 md:px-12 lg:px-20 mb-4"
                  >
                    <div className="relative max-w-xl mx-auto">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        ref={inlineSearchRef}
                        value={inlineQuery}
                        onChange={(e) => setInlineQuery(e.target.value)}
                        placeholder="Buscar aulas, provas, conteúdos..."
                        className="pl-10 pr-10"
                      />
                      {inlineSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {inlineResults.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border bg-card shadow-lg z-20 max-h-60 overflow-y-auto">
                          {inlineResults.map((r) => (
                            <button
                              key={r.id}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors flex items-center gap-2"
                              onClick={() => {
                                handleVideoClick(r.id);
                                setInlineSearchOpen(false);
                                setInlineQuery("");
                                setInlineResults([]);
                              }}
                            >
                              <span className="text-xs text-muted-foreground">
                                {r.type === "lesson" ? "Aula" : "Prova"}
                              </span>
                              <span className="text-foreground">{r.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {loadingPopular ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando vídeos populares...</span>
                </div>
              ) : popularVideos.length > 0 ? (
                <VideoCarousel
                  title="✨ Recomendado para você"
                  videos={popularVideos}
                  onVideoClick={handleVideoClick}
                  showTrialBadge={showTrialBadge}
                  watchedIds={watchedIds}
                />
              ) : (
                user && role === "student" && (!profile?.areas || profile.areas.length === 0) && (
                  <div className="px-6 md:px-12 lg:px-20">
                    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                      <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <Sparkles className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display text-lg font-semibold mb-1">
                          Personalize suas recomendações
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Selecione até 3 áreas de interesse e a gente te mostra os melhores conteúdos para você aqui na home.
                        </p>
                      </div>
                      <button
                        onClick={() => navigate("/dashboard/student?tab=interests")}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        Configurar áreas
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {loadingAreas && areas.length > 0 ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Carregando conteúdos por área...</span>
              </div>
            ) : (
              areas.map((area) =>
                areaLessons[area.name] && areaLessons[area.name].length > 0 ? (
                  <VideoCarousel
                    key={area.id}
                    title={`📚 ${area.name}`}
                    videos={areaLessons[area.name]}
                    onVideoClick={handleVideoClick}
                    showTrialBadge={showTrialBadge}
                    watchedIds={watchedIds}
                  />
                ) : null
              )
            )}
          </>
        )}
      </div>

      {!isTeacher && (
        <div id="pricing">
          <PricingSection />
        </div>
      )}
      {!isTeacher && (
        <div className="pb-12">
          <BookLessonSection />
        </div>
      )}
      <SecondaryBanner />
      <Footer />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;

