import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BookOpen, Video, Star, ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeacherData {
  name: string;
  avatar_url: string | null;
  bio: string | null;
  expertise_area: string | null;
  profile_title: string | null;
  user_id: string;
}

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  areas: string[] | null;
  type: "lesson" | "exam_solution";
}

const TeacherProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [teacher, setTeacher] = useState<TeacherData | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const fetchTeacher = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url, bio, expertise_area, profile_title, user_id")
        .eq("slug", slug)
        .maybeSingle();

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTeacher(profile);

      // Fetch lessons and exam solutions by this teacher
      const [lessonsRes, examsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, title, description, thumbnail_url, areas")
          .eq("teacher_id", profile.user_id)
          .eq("published", true)
          .eq("admin_approved", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("exam_solutions")
          .select("id, title, description, thumbnail_url, areas")
          .eq("teacher_id", profile.user_id)
          .eq("published", true)
          .eq("admin_approved", true)
          .order("created_at", { ascending: false }),
      ]);

      const lessons: ContentItem[] = (lessonsRes.data || []).map((l) => ({ ...l, type: "lesson" as const }));
      const exams: ContentItem[] = (examsRes.data || []).map((e) => ({ ...e, type: "exam_solution" as const }));
      const allContent = [...lessons, ...exams];
      setContent(allContent);

      // Fetch views and ratings for all content IDs
      const contentIds = allContent.map((c) => c.id);
      if (contentIds.length > 0) {
        const [viewsRes, ratingsRes] = await Promise.all([
          supabase
            .from("video_views")
            .select("id", { count: "exact", head: true })
            .in("content_id", contentIds),
          supabase
            .from("video_ratings")
            .select("rating")
            .in("content_id", contentIds),
        ]);
        setTotalViews(viewsRes.count || 0);
        const ratings = ratingsRes.data || [];
        setRatingCount(ratings.length);
        if (ratings.length > 0) {
          setAvgRating(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length);
        }
      }

      setLoading(false);
    };
    fetchTeacher();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-20">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !teacher) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center pt-20 px-6 gap-4">
          <h1 className="text-2xl font-display font-bold">Professor não encontrado</h1>
          <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const expertiseList = teacher.expertise_area?.split(", ").filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <div className="flex-1 pt-20 pb-12">
        {/* Teacher header */}
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border-2 border-primary/20">
              {teacher.avatar_url ? (
                <img src={teacher.avatar_url} alt={teacher.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-primary">{teacher.name.charAt(0)}</span>
              )}
            </div>
            <div className="text-center sm:text-left space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold">{teacher.name}</h1>
              {expertiseList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {expertiseList.map((area) => (
                    <span key={area} className="text-xs bg-primary/10 text-primary rounded-full px-2.5 py-0.5">{area}</span>
                  ))}
                </div>
              )}
              {teacher.bio && <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{teacher.bio}</p>}
              <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center sm:justify-start">
                <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" />{content.length} conteúdo{content.length !== 1 ? "s" : ""}</span>
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{totalViews.toLocaleString("pt-BR")} visualizações</span>
                {ratingCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                    {avgRating.toFixed(1)} ({ratingCount})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Page title */}
          {teacher.profile_title && (
            <h2 className="font-display text-xl sm:text-2xl font-bold text-center mb-8 text-foreground">{teacher.profile_title}</h2>
          )}

          {/* Content grid */}
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold mb-4">Conteúdos do Professor</h2>
          </div>

          {content.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum conteúdo publicado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {content.map((item) => (
                <Link
                  key={item.id}
                  to={`/video/${item.id}`}
                  className="group rounded-xl border border-border bg-secondary/30 overflow-hidden hover:border-primary/30 transition-colors"
                >
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 text-[10px] bg-background/80 text-foreground rounded px-1.5 py-0.5 font-medium">
                      {item.type === "lesson" ? "Aula" : "Resolução"}
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
                    {item.areas && item.areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.areas.slice(0, 2).map((a) => (
                          <span key={a} className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default TeacherProfile;
