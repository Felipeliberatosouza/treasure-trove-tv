import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import FreeTrialBanner from "@/components/FreeTrialBanner";
import VideoCarousel from "@/components/VideoCarousel";
import PricingSection from "@/components/PricingSection";
import Footer from "@/components/Footer";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { videos } from "@/data/courses";
import { useVideoRatings } from "@/hooks/useVideoRatings";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useHomepageAreas } from "@/hooks/useCourseAreas";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const ratings = useVideoRatings(videos.map((v) => v.id));
  const { data: trialSettings } = usePlatformSettings("free_trial");
  const showTrialBadge = trialSettings?.enabled ?? false;
  const { areas } = useHomepageAreas();
  const [areaLessons, setAreaLessons] = useState<Record<string, Video[]>>({});
  const [popularVideos, setPopularVideos] = useState<Video[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);

  // Inline search state
  const [inlineSearchOpen, setInlineSearchOpen] = useState(false);
  const [inlineQuery, setInlineQuery] = useState("");
  const [inlineResults, setInlineResults] = useState<SearchResult[]>([]);
  const [inlineSearching, setInlineSearching] = useState(false);
  const inlineSearchRef = useRef<HTMLInputElement>(null);
  const popularSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (areas.length === 0) return;
    const fetchAreaLessons = async () => {
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
    };
    fetchAreaLessons();
  }, [areas]);

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

  const handleExploreClick = useCallback(() => {
    setInlineSearchOpen(true);
    setTimeout(() => {
      popularSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => inlineSearchRef.current?.focus(), 500);
    }, 50);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <HeroBanner onVideoClick={handleVideoClick} onExploreClick={handleExploreClick} />
      <FreeTrialBanner />

      <div className="space-y-12 py-12">
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

          <VideoCarousel
            title="🔥 Mais Populares"
            videos={videos}
            onVideoClick={handleVideoClick}
            ratings={ratings}
            showTrialBadge={showTrialBadge}
          />
        </div>

        {areas.map((area) =>
          areaLessons[area.name] && areaLessons[area.name].length > 0 ? (
            <VideoCarousel
              key={area.id}
              title={`📚 ${area.name}`}
              videos={areaLessons[area.name]}
              onVideoClick={handleVideoClick}
              showTrialBadge={showTrialBadge}
            />
          ) : null
        )}
      </div>

      <div id="pricing">
        <PricingSection />
      </div>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
};

export default Index;
