import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Loader2, Search, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import BookLessonModal from "@/components/BookLessonModal";

interface BookableResult {
  id: string;
  title: string;
  type: "lesson" | "exam_solution";
  teacher_id: string;
  teacher_name: string | null;
  teacher_avatar: string | null;
}

interface SelectedContent {
  id: string;
  title: string;
  type: "lesson" | "exam_solution";
  teacher_id: string;
  teacher_name: string | null;
  teacher_avatar: string | null;
}

const BookLessonSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookableResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedContent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const term = `%${query.trim()}%`;
      const [lessonsRes, examsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, title, teacher_id")
          .eq("published", true)
          .eq("admin_approved", true)
          .ilike("title", term)
          .limit(6),
        supabase
          .from("exam_solutions")
          .select("id, title, teacher_id")
          .eq("published", true)
          .eq("admin_approved", true)
          .ilike("title", term)
          .limit(6),
      ]);

      const rawRows = [
        ...((lessonsRes.data || []).map((l) => ({ ...l, type: "lesson" as const }))),
        ...((examsRes.data || []).map((e) => ({ ...e, type: "exam_solution" as const }))),
      ];
      const teacherIds = Array.from(new Set(rawRows.map((r) => r.teacher_id)));
      let teacherMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
      if (teacherIds.length > 0) {
        const { data: profs } = await supabase
          .from("teacher_profiles_public")
          .select("user_id, name, avatar_url")
          .in("user_id", teacherIds);
        (profs || []).forEach((p) => {
          teacherMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url };
        });
      }
      setResults(
        rawRows.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          teacher_id: r.teacher_id,
          teacher_name: teacherMap[r.teacher_id]?.name ?? null,
          teacher_avatar: teacherMap[r.teacher_id]?.avatar_url ?? null,
        })),
      );
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const handlePick = (r: BookableResult) => {
    setSelected({
      id: r.id,
      title: r.title,
      type: r.type,
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name,
      teacher_avatar: r.teacher_avatar,
    });
    setResults([]);
    setQuery("");
  };

  const handleStart = () => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent("/aulas-agendadas#agendar-aula")}`);
      return;
    }
    if (!selected) return;
    setModalOpen(true);
  };

  const helpText = useMemo(
    () =>
      selected
        ? "Escolha um dia e horário disponíveis na agenda do professor."
        : "Busque por uma aula ou prova publicada para agendar uma aula particular com o professor responsável.",
    [selected],
  );

  return (
    <section id="agendar-aula" className="px-6 md:px-12 lg:px-20 scroll-mt-24">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-xl md:text-2xl font-semibold leading-tight">
                Agende uma Aula Particular
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{helpText}</p>
            </div>
          </div>

          {!selected ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque por aula, prova ou tema..."
                className="pl-10 pr-10"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {results.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                  {results.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => handlePick(r)}
                      className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-secondary"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15">
                        {r.teacher_avatar ? (
                          <img src={r.teacher_avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-foreground">{r.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.type === "lesson" ? "Aula" : "Resolução de prova"}
                          {r.teacher_name ? ` · ${r.teacher_name}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {query.trim().length >= 2 && !loading && results.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum conteúdo encontrado para "{query.trim()}".
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15">
                {selected.teacher_avatar ? (
                  <img src={selected.teacher_avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{selected.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {selected.type === "lesson" ? "Aula" : "Resolução de prova"}
                  {selected.teacher_name ? ` · com ${selected.teacher_name}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  <X className="mr-1 h-4 w-4" />
                  Trocar
                </Button>
                <Button size="sm" onClick={handleStart}>
                  <CalendarDays className="mr-1 h-4 w-4" />
                  Ver horários
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <BookLessonModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          teacherId={selected.teacher_id}
          teacherName={selected.teacher_name}
          contentId={selected.id}
          contentType={selected.type}
          contentTitle={selected.title}
        />
      )}
    </section>
  );
};

export default BookLessonSection;