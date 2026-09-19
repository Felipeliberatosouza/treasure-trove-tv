import { useEffect, useMemo, useState } from "react";
import { usePlatformSettings, DEFAULT_AI_AVATAR, resolveAiAvatar, aiRoleLabel } from "@/hooks/usePlatformSettings";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import VideoCarousel from "@/components/VideoCarousel";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Video } from "@/data/courses";
import { useAiKitCovers } from "@/hooks/useAiKitCovers";

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

/**
 * Material type stored in `lesson_material_meta.material_type`.
 * Note: the meta table uses singular "colinha", matching the CHECK constraint
 * in the database — keep this aligned with the schema.
 */
const META_MATERIAL_TYPE: Record<
  NonNullable<StudentContentSectionsProps["materialFilter"]>,
  "resumo" | "simulado" | "top_questoes" | "colinha"
> = {
  resumo: "resumo",
  simulado: "simulado",
  top_questoes: "top_questoes",
  colinha: "colinha",
};

const mapToVideo = (
  l: any,
  teacherMap?: Map<string, { name: string; slug: string | null }>,
): Video => ({
  id: l.id,
  title: l.title,
  description: l.description || "",
  thumbnail: l.thumbnail_url || l.carousel_cover_url || "/placeholder.svg",
  duration: "",
  category: ((l.areas as string[]) || [])[0] || "",
  instructor: teacherMap?.get(l.teacher_id)?.name || "",
  instructorHref: teacherMap?.get(l.teacher_id)?.slug
    ? `/${teacherMap.get(l.teacher_id)!.slug}`
    : undefined,
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
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { average: number; count: number }>>({});
  const [continueWatching, setContinueWatching] = useState<Array<Video & { _progress: number }>>([]);
  const [aiKits, setAiKits] = useState<Video[]>([]);
  const aiCovers = useAiKitCovers(aiKits.map((k) => k.id));
  const { data: aiAvatarSettings } = usePlatformSettings("ai_avatar");
  const { data: aiParams } = usePlatformSettings("ai_generation_params");

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
          .limit(200);
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

      let lessonsRows: any[] = lRes.data || [];
      let examsRows: any[] = eRes.data || [];

      // For lessons, also enforce that the material is approved and currently
      // offered via lesson_material_meta — the *_url column alone is not enough
      // because a teacher may revoke the offering without clearing the URL.
      if (materialFilter && lessonsRows.length > 0) {
        const ids = lessonsRows.map((l) => l.id);
        const { data: metas } = await supabase
          .from("lesson_material_meta")
          .select("lesson_id, offered, admin_approved")
          .in("lesson_id", ids)
          .eq("material_type", META_MATERIAL_TYPE[materialFilter])
          .eq("offered", true)
          .eq("admin_approved", true);
        const allowed = new Set((metas || []).map((m: any) => m.lesson_id));
        lessonsRows = lessonsRows.filter((l) => allowed.has(l.id));
      }

      if (cancelled) return;

      // Aggregated views, ratings & watched flags
      const lessonIds = lessonsRows.map((l) => l.id);
      const examIds = examsRows.map((e) => e.id);
      const allIds = [...lessonIds, ...examIds];

      const [lessonViewsRes, examViewsRes, ratingsRes, watchedRes] = await Promise.all([
        lessonIds.length
          ? supabase.rpc("get_content_view_counts", { _content_type: "lesson", _ids: lessonIds })
          : Promise.resolve({ data: [] as any[] }),
        examIds.length
          ? supabase.rpc("get_content_view_counts", {
              _content_type: "exam_solution",
              _ids: examIds,
            })
          : Promise.resolve({ data: [] as any[] }),
        allIds.length
          ? supabase.rpc("get_video_rating_aggregates" as any, { _ids: allIds })
          : Promise.resolve({ data: [] as any[] }),
        allIds.length
          ? supabase
              .from("video_views")
              .select("content_id, watch_percentage")
              .eq("user_id", user.id)
              .in("content_id", allIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (cancelled) return;

      const viewsMap = new Map<string, number>();
      ([...((lessonViewsRes as any).data || []), ...((examViewsRes as any).data || [])] as any[]).forEach(
        (r) => viewsMap.set(r.content_id, r.views_count)
      );

      const ratingsMap: Record<string, { average: number; count: number }> = {};
      ((ratingsRes.data as any[]) || []).forEach((r) => {
        ratingsMap[r.content_id] = {
          average: Number(r.average) || 0,
          count: r.count || 0,
        };
      });

      const watched = new Set<string>();
      const progressMap = new Map<string, number>();
      ((watchedRes.data as any[]) || []).forEach((v) => {
        const p = v.watch_percentage || 0;
        if (p >= 70) watched.add(v.content_id);
        // Track in-progress: started but not effectively finished
        const prev = progressMap.get(v.content_id) || 0;
        if (p > prev) progressMap.set(v.content_id, p);
      });

      const sortBy = (a: any, b: any) => {
        const va = viewsMap.get(a.id) || 0;
        const vb = viewsMap.get(b.id) || 0;
        if (vb !== va) return vb - va;
        const ra = ratingsMap[a.id]?.average || 0;
        const rb = ratingsMap[b.id]?.average || 0;
        if (rb !== ra) return rb - ra;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      };

      // Nome e página do professor real de cada conteúdo.
      const teacherIds = Array.from(
        new Set([...lessonsRows, ...examsRows].map((r: any) => r.teacher_id).filter(Boolean)),
      );
      const teacherMap = new Map<string, { name: string; slug: string | null }>();
      if (teacherIds.length > 0) {
        const { data: tProfiles } = await supabase
          .from("profiles")
          .select("user_id, name, slug")
          .in("user_id", teacherIds as string[]);
        (tProfiles || []).forEach((p: any) => teacherMap.set(p.user_id, { name: p.name, slug: p.slug }));
      }

      lessonsRows.sort(sortBy);
      examsRows.sort(sortBy);

      // Build "Continue watching": items with progress between 5% and 95%
      const allRows = [...lessonsRows, ...examsRows];
      const inProgress = allRows
        .map((r) => ({ row: r, progress: progressMap.get(r.id) || 0 }))
        .filter(({ progress }) => progress >= 5 && progress < 95)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 30)
        .map(({ row, progress }) => ({ ...mapToVideo(row, teacherMap), _progress: progress }));

      setContinueWatching(inProgress);
      setRatings(ratingsMap);
      setWatchedIds(watched);
      setLessons(lessonsRows.map((r) => mapToVideo(r, teacherMap)));
      setExams(examsRows.map((r) => mapToVideo(r, teacherMap)));
      setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user, studentAreas, materialFilter]);

  // Revisões geradas por IA vinculadas às áreas de interesse do aluno.
  useEffect(() => {
    if (materialFilter) {
      setAiKits([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      let q: any = supabase
        .from("ai_canonical_contents")
        .select("id, assunto, disciplina, areas, kit")
        .eq("status", "ready")
        .eq("visibility", "public_canonical")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (studentAreas.length > 0) q = q.overlaps("areas", studentAreas);
      const { data } = await q;
      if (cancelled) return;
      setAiKits(
        (data || []).map((row: any): Video => ({
          id: row.id,
          title: (row.kit?.titulo as string) || row.assunto,
          description: row.disciplina || "Revisão gerada com apoio de IA",
          thumbnail: "/placeholder.svg",
          duration: "Aula com Professor Virtual",
          category: (row.areas || [])[0] || row.disciplina || "",
          instructor: (() => {
            const avatar = resolveAiAvatar(
              aiParams,
              { ...DEFAULT_AI_AVATAR, ...(aiAvatarSettings || {}) },
              { disciplina: row.disciplina, areas: (row.areas as string[] | null) || [], contentType: "apresentacao" },
            );
            return `${aiRoleLabel(avatar.gender)} ${avatar.name}`.trim();
          })(),
          lessons: Array.isArray(row.kit?.slides) ? row.kit.slides.length : 0,
        })),
      );
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [studentAreas, materialFilter, aiAvatarSettings, aiParams]);

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

      {continueWatching.length > 0 && (
        <Section
          title="Continuar assistindo"
          videos={continueWatching}
          onVideoClick={onVideoClick}
          ratings={ratings}
          watchedIds={watchedIds}
          emptyText=""
        />
      )}

      <Section
        title={lessonsLabel}
        videos={[
          ...lessons,
          ...aiKits.map((k) => (aiCovers[k.id] ? { ...k, thumbnail: aiCovers[k.id] } : k)),
        ]}
        onVideoClick={(id) =>
          aiKits.some((k) => k.id === id) ? navigate(`/conteudo-ia/${id}`) : onVideoClick(id)
        }
        ratings={ratings}
        watchedIds={watchedIds}
        emptyText="Nenhum conteúdo encontrado para suas áreas de interesse."
      />
      <Section
        title={examsLabel}
        videos={exams}
        onVideoClick={onVideoClick}
        ratings={ratings}
        watchedIds={watchedIds}
        emptyText="Nenhuma resolução de prova encontrada para suas áreas de interesse."
      />
    </div>
  );
};

const Section = ({
  title,
  videos,
  onVideoClick,
  ratings,
  watchedIds,
  emptyText,
}: {
  title: string;
  videos: Video[];
  onVideoClick: (id: string) => void;
  ratings?: Record<string, { average: number; count: number }>;
  watchedIds?: Set<string>;
  emptyText: string;
}) => {
  const count = videos.length;
  const countLabel =
    count === 0
      ? "nenhum item"
      : count === 1
      ? "1 item disponível"
      : `${count} itens disponíveis`;
  const titleWithCount = `${title} (${countLabel})`;
  if (videos.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold md:text-2xl px-6 md:px-12 lg:px-20">
          {titleWithCount}
        </h2>
        <div className="mx-6 md:mx-12 lg:mx-20 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      </section>
    );
  }
  return (
    <VideoCarousel
      title={titleWithCount}
      videos={videos}
      onVideoClick={onVideoClick}
      ratings={ratings}
      watchedIds={watchedIds}
    />
  );
};

export default StudentContentSections;