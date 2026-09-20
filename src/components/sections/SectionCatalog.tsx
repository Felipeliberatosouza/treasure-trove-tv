import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Search, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VideoCarousel from "@/components/VideoCarousel";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePlatformSettings,
  DEFAULT_AI_AVATAR,
  resolveAiAvatar,
  aiRoleLabel,
} from "@/hooks/usePlatformSettings";
import { CONTENT_SECTIONS, getSection, type SectionKey } from "@/lib/contentSections";
import type { Video } from "@/data/courses";
import { useAiKitCovers } from "@/hooks/useAiKitCovers";
import {
  formatDuration,
  estimateSlidesDuration,
  aiInstructorLabel,
  aiOverlayLabel,
  teacherInstructorLabel,
  teacherOverlayLabel,
} from "@/lib/contentDisplay";

interface Props {
  sectionKey: SectionKey;
}

type Item = Video & {
  _areas: string[];
  _origin: "teacher" | "ai";
  _contentType: "lesson" | "exam_solution" | "ai";
  _views: number;
  _createdAt: number;
};

const normalize = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const kitHasSection = (kit: any, key: SectionKey): boolean => {
  if (!kit) return false;
  const list =
    key === "revisoes"
      ? kit.slides
      : key === "resumo"
      ? kit.resumo
      : key === "simulado"
      ? kit.simulado
      : key === "top_questoes"
      ? kit.top_questoes
      : kit.colinha;
  return Array.isArray(list) && list.length > 0;
};

const SectionCatalog = ({ sectionKey }: Props) => {
  const section = getSection(sectionKey);
  const Icon = section.icon;
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: aiAvatarSettings } = usePlatformSettings("ai_avatar");
  const { data: aiParams } = usePlatformSettings("ai_generation_params");

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [continueWatching, setContinueWatching] = useState<Item[]>([]);
  const [ratings, setRatings] = useState<Record<string, { average: number; count: number }>>({});

  const studentAreas = useMemo<string[]>(
    () => ((profile as any)?.areas as string[] | undefined) ?? [],
    [profile],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      const buildQuery = (table: "lessons" | "exam_solutions") => {
        let q: any = supabase
          .from(table)
          .select("*")
          .eq("published", true)
          .eq("admin_approved", true)
          .order("created_at", { ascending: false })
          .limit(200);
        if (section.urlColumn) {
          q = q.not(section.urlColumn, "is", null).neq(section.urlColumn, "");
        }
        return q;
      };

      const [lessonsRes, examsRes, aiRes] = await Promise.all([
        buildQuery("lessons"),
        buildQuery("exam_solutions"),
        supabase
          .from("ai_canonical_contents")
          .select("id, assunto, disciplina, areas, kit, updated_at")
          .eq("status", "ready")
          .eq("visibility", "public_canonical")
          .order("updated_at", { ascending: false })
          .limit(120),
      ]);

      if (cancelled) return;

      let lessonRows: any[] = lessonsRes.data || [];
      const examRows: any[] = examsRes.data || [];

      // Para aulas, o material precisa estar aprovado e ofertado.
      if (section.metaType && lessonRows.length > 0) {
        const { data: metas } = await supabase
          .from("lesson_material_meta")
          .select("lesson_id")
          .in(
            "lesson_id",
            lessonRows.map((l) => l.id),
          )
          .eq("material_type", section.metaType)
          .eq("offered", true)
          .eq("admin_approved", true);
        const allowed = new Set((metas || []).map((m: any) => m.lesson_id));
        lessonRows = lessonRows.filter((l) => allowed.has(l.id));
      }

      if (cancelled) return;

      // Professores dos conteúdos humanos.
      const teacherIds = Array.from(
        new Set([...lessonRows, ...examRows].map((r) => r.teacher_id).filter(Boolean)),
      );
      const teacherMap = new Map<string, { name: string; slug: string | null }>();
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name, slug")
          .in("user_id", teacherIds as string[]);
        (profs || []).forEach((p: any) => teacherMap.set(p.user_id, { name: p.name, slug: p.slug }));
      }

      const lessonIds = lessonRows.map((l) => l.id);
      const examIds = examRows.map((e) => e.id);
      const aiIds = ((aiRes.data as any[]) || []).map((r) => r.id);
      const allIds = [...lessonIds, ...examIds, ...aiIds];

      const [lessonViews, examViews, aiViews, ratingsRes, viewsRes] = await Promise.all([
        lessonIds.length
          ? supabase.rpc("get_content_view_counts", { _content_type: "lesson", _ids: lessonIds })
          : Promise.resolve({ data: [] as any[] }),
        examIds.length
          ? supabase.rpc("get_content_view_counts", {
              _content_type: "exam_solution",
              _ids: examIds,
            })
          : Promise.resolve({ data: [] as any[] }),
        aiIds.length
          ? supabase.rpc("get_content_view_counts", { _content_type: "ai", _ids: aiIds })
          : Promise.resolve({ data: [] as any[] }),
        allIds.length
          ? supabase.rpc("get_video_rating_aggregates" as any, { _ids: allIds })
          : Promise.resolve({ data: [] as any[] }),
        user
          ? supabase.from("video_views").select("content_id, watch_percentage").eq("user_id", user.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      if (cancelled) return;

      const viewsMap = new Map<string, number>();
      [
        ...(((lessonViews as any).data || []) as any[]),
        ...(((examViews as any).data || []) as any[]),
        ...(((aiViews as any).data || []) as any[]),
      ].forEach((r) => viewsMap.set(r.content_id, r.views_count));

      const ratingsMap: Record<string, { average: number; count: number }> = {};
      (((ratingsRes as any).data || []) as any[]).forEach((r) => {
        ratingsMap[r.content_id] = { average: Number(r.average) || 0, count: r.count || 0 };
      });

      const watched = new Set<string>();
      const progressMap = new Map<string, number>();
      (((viewsRes as any).data || []) as any[]).forEach((v) => {
        const p = v.watch_percentage || 0;
        if (p >= 70) watched.add(v.content_id);
        if (p > (progressMap.get(v.content_id) || 0)) progressMap.set(v.content_id, p);
      });

      const sectionTitle = (raw: string) => {
        const clean = (raw || "").trim();
        if (sectionKey === "revisoes") return clean;
        const already = normalize(clean).startsWith(normalize(section.itemPrefix));
        return already ? clean : `${section.itemPrefix}: ${clean}`;
      };

      const mapTeacher = (r: any, type: "lesson" | "exam_solution"): Item => {
        const t = r.teacher_id ? teacherMap.get(r.teacher_id) : undefined;
        return {
          id: r.id,
          title: sectionTitle(r.title),
          description: r.description || "",
          thumbnail: r.thumbnail_url || r.carousel_cover_url || "/placeholder.svg",
          duration: formatDuration(r.duration_seconds),
          category: ((r.areas as string[]) || [])[0] || "",
          instructor: teacherInstructorLabel(t?.name),
          overlayLabel: teacherOverlayLabel(t?.name),
          instructorHref: t?.slug ? `/${t.slug}` : undefined,
          lessons: 1,
          views: viewsMap.get(r.id) || 0,
          videoUrl: r.video_url || undefined,
          _areas: (r.areas as string[]) || [],
          _origin: "teacher",
          _contentType: type,
          _views: viewsMap.get(r.id) || 0,
          _createdAt: new Date(r.created_at).getTime(),
        };
      };

      const sectionCount = (kit: any): number => {
        const list =
          sectionKey === "revisoes"
            ? kit?.slides
            : sectionKey === "resumo"
            ? kit?.resumo
            : sectionKey === "simulado"
            ? kit?.simulado
            : sectionKey === "top_questoes"
            ? kit?.top_questoes
            : kit?.colinha;
        return Array.isArray(list) ? list.length : 0;
      };

      const countLabel = (n: number) => {
        if (n <= 0) return "";
        if (sectionKey === "revisoes") return `${n} slides`;
        if (sectionKey === "simulado") return `${n} questões`;
        if (sectionKey === "top_questoes") return `${n} questões comentadas`;
        if (sectionKey === "colinha") return `${n} tópicos`;
        return `${n} pontos`;
      };

      const aiItems: Item[] = ((aiRes.data as any[]) || [])
        .filter((row) => kitHasSection(row.kit, sectionKey))
        .map((row) => {
          const areas = (row.areas as string[] | null) || [];
          const avatar = resolveAiAvatar(
            aiParams,
            { ...DEFAULT_AI_AVATAR, ...(aiAvatarSettings || {}) },
            { disciplina: row.disciplina, areas, contentType: "apresentacao" },
          );
          const total = sectionCount(row.kit);
          return {
            id: row.id,
            title: sectionTitle(row.assunto || (row.kit?.titulo as string) || ""),
            description: [row.disciplina, countLabel(total)].filter(Boolean).join(" • "),
            thumbnail: aiKitCover,
            duration: sectionKey === "revisoes" ? "Aula com Professor Virtual" : countLabel(total),
            category: areas[0] || row.disciplina || "",
            instructor: `${aiRoleLabel(avatar.gender)} ${avatar.name}`.trim(),
            lessons: total || 1,
            _areas: areas,
            _origin: "ai" as const,
            _contentType: "ai" as const,
            _views: 0,
            _createdAt: new Date(row.updated_at).getTime(),
          };
        });

      const all = [
        ...lessonRows.map((r) => mapTeacher(r, "lesson")),
        ...examRows.map((r) => mapTeacher(r, "exam_solution")),
        ...aiItems,
      ];

      setItems(all);
      setRatings(ratingsMap);
      setWatchedIds(watched);
      setContinueWatching(
        all
          .filter((i) => {
            const p = progressMap.get(i.id) || 0;
            return p >= 5 && p < 95;
          })
          .sort((a, b) => (progressMap.get(b.id) || 0) - (progressMap.get(a.id) || 0))
          .slice(0, 20),
      );
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [sectionKey, section.urlColumn, section.metaType, user, aiAvatarSettings, aiParams]);

  const aiIds = useMemo(() => items.filter((i) => i._origin === "ai").map((i) => i.id), [items]);
  const aiCovers = useAiKitCovers(aiIds);

  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    const base = term.length === 0
      ? items
      : items.filter((i) =>
          normalize(
            [i.title, i.description, i.category, i.instructor, ...i._areas].join(" "),
          ).includes(term),
        );
    return [...base]
      .map((i) => (aiCovers[i.id] ? { ...i, thumbnail: aiCovers[i.id] } : i))
      .sort((a, b) => {
        const aw = watchedIds.has(a.id) ? 1 : 0;
        const bw = watchedIds.has(b.id) ? 1 : 0;
        if (aw !== bw) return aw - bw;
        if (b._views !== a._views) return b._views - a._views;
        return b._createdAt - a._createdAt;
      });
  }, [items, query, watchedIds, aiCovers]);

  const hasAreas = !!user && studentAreas.length > 0;
  const inAreas = useMemo(
    () => (hasAreas ? filtered.filter((i) => i._areas.some((a) => studentAreas.includes(a))) : []),
    [filtered, hasAreas, studentAreas],
  );
  const suggestions = useMemo(
    () => (hasAreas ? filtered.filter((i) => !inAreas.includes(i)) : filtered),
    [filtered, hasAreas, inAreas],
  );

  const openItem = (item: Item | undefined, id: string) => {
    const found = item || items.find((i) => i.id === id);
    if (found?._origin === "ai") {
      navigate(`/conteudo-ia/${id}?secao=${sectionKey}`);
      return;
    }
    navigate(sectionKey === "revisoes" ? `/video/${id}` : `/video/${id}?material=${section.metaType}`);
  };

  const onVideoClick = (id: string) => openItem(undefined, id);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pb-14 pt-24">
        <header className="px-6 md:px-12 lg:px-20">
          <div className="flex items-center gap-3">
            <Icon className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold text-gradient">{section.label}</h1>
          </div>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">{section.description}</p>

          <div className="relative mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={section.searchPlaceholder}
              aria-label={section.searchPlaceholder}
              className="pl-9"
            />
          </div>

          <nav aria-label="Outras seções" className="mt-6 flex flex-wrap gap-2">
            {CONTENT_SECTIONS.filter((s) => s.key !== sectionKey).map((s) => (
              <Link
                key={s.key}
                to={s.href}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/60 hover:text-primary"
              >
                <s.icon className="h-4 w-4" />
                {s.shortLabel}
              </Link>
            ))}
          </nav>

          {user && studentAreas.length === 0 && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm">
                  Selecione suas áreas de interesse para personalizarmos o conteúdo desta seção.
                </p>
                <Link
                  to="/dashboard/student?tab=interests"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Configurar áreas de interesse →
                </Link>
              </div>
            </div>
          )}
        </header>

        <div className="mt-10 space-y-10">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-6 rounded-xl border border-border bg-card p-12 text-center md:mx-12 lg:mx-20">
              <Icon className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {query
                  ? `Nenhum conteúdo encontrado para "${query}".`
                  : "Em breve teremos conteúdos disponíveis aqui."}
              </p>
            </div>
          ) : (
            <>
              {!query && continueWatching.length > 0 && (
                <VideoCarousel
                  title="Continuar assistindo"
                  videos={continueWatching}
                  onVideoClick={onVideoClick}
                  ratings={ratings}
                  watchedIds={watchedIds}
                />
              )}
              {inAreas.length > 0 && (
                <VideoCarousel
                  title={`${section.label} nas suas áreas de interesse (${inAreas.length})`}
                  videos={inAreas}
                  onVideoClick={onVideoClick}
                  ratings={ratings}
                  watchedIds={watchedIds}
                />
              )}
              {suggestions.length > 0 && (
                <VideoCarousel
                  title={
                    hasAreas
                      ? `Sugestões para você (${suggestions.length})`
                      : `Todos os conteúdos (${suggestions.length})`
                  }
                  videos={suggestions}
                  onVideoClick={onVideoClick}
                  ratings={ratings}
                  watchedIds={watchedIds}
                />
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default SectionCatalog;
