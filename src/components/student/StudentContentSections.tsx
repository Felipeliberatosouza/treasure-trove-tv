import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import VideoCarousel from "@/components/VideoCarousel";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Video } from "@/data/courses";

interface StudentContentSectionsProps {
  /**
   * Material filter. When omitted, every published item is included
   * (used for the "Revisões" page). Otherwise, only items that have a
   * non-empty value in the corresponding `*_url` column are shown.
   */
  materialFilter?: "resumo" | "simulado" | "top_questoes" | "colinha";
  /** Section copy. */
  lessonsLabel?: string;
  examsLabel?: string;
  /** Show the "no interest areas" CTA if the student has none configured. */
  emptyAreasMessage?: string;
}

const URL_COLUMN: Record<NonNullable<StudentContentSectionsProps["materialFilter"]>, string> = {
  resumo: "resumo_url",
  simulado: "simulado_url",
  top_questoes: "top_questoes_url",
  colinha: "colinha_url",
};

const mapToVideo = (l: any): Video => ({
  id: l.id,
  title: l.title,
  description: l.description || "",
  thumbnail: l.thumbnail_url || l.carousel_cover_url || "/placeholder.svg",
  duration: "",
  category: ((l.areas as string[]) || [])[0] || "",
  instructor: "",
  lessons: 1,
  videoUrl: l.video_url || undefined,
});

const StudentContentSections = ({
  materialFilter,
  lessonsLabel = "Aulas de Revisão",
  examsLabel = "Resoluções de Provas",
  emptyAreasMessage = "Selecione suas áreas de interesse para personalizarmos o conteúdo abaixo.",
}: StudentContentSectionsProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Video[]>([]);
  const [exams, setExams] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  const studentAreas = useMemo<string[]>(
    () => ((profile as any)?.areas as string[] | undefined) ?? [],
    [profile]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const buildQuery = (table: "lessons" | "exam_solutions"): any => {
        let q: any = supabase
          .from(table)
          .select("*")
          .eq("published", true)
          .eq("admin_approved", true)
          .order("created_at", { ascending: false })
          .limit(30);
        if (studentAreas.length > 0) q = q.overlaps("areas", studentAreas);
        if (materialFilter) {
          const col = URL_COLUMN[materialFilter];
          q = q.not(col, "is", null).neq(col, "");
        }
        return q;
      };

      const [lRes, eRes] = await Promise.all([
        buildQuery("lessons"),
        buildQuery("exam_solutions"),
      ]);

      if (cancelled) return;
      setLessons((lRes.data || []).map(mapToVideo));
      setExams((eRes.data || []).map(mapToVideo));
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user, studentAreas, materialFilter]);

  const onVideoClick = (id: string) => navigate(`/video/${id}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {studentAreas.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm">{emptyAreasMessage}</p>
            <Link
              to="/dashboard/student?tab=interests"
              className="text-sm font-medium text-primary hover:underline"
            >
              Configurar áreas de interesse →
            </Link>
          </div>
        </div>
      )}

      <Section
        title={lessonsLabel}
        videos={lessons}
        onVideoClick={onVideoClick}
        emptyText="Nenhum conteúdo encontrado para suas áreas de interesse."
      />
      <Section
        title={examsLabel}
        videos={exams}
        onVideoClick={onVideoClick}
        emptyText="Nenhuma resolução de prova encontrada para suas áreas de interesse."
      />
    </div>
  );
};

const Section = ({
  title,
  videos,
  onVideoClick,
  emptyText,
}: {
  title: string;
  videos: Video[];
  onVideoClick: (id: string) => void;
  emptyText: string;
}) => {
  if (videos.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold md:text-2xl px-6 md:px-12 lg:px-20">
          {title}
        </h2>
        <div className="mx-6 md:mx-12 lg:mx-20 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      </section>
    );
  }
  return <VideoCarousel title={title} videos={videos} onVideoClick={onVideoClick} />;
};

export default StudentContentSections;