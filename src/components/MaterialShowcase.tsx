import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import MaterialViewerModal from "@/components/MaterialViewerModal";
import SimuladoModal from "@/components/SimuladoModal";
import ColinhaFlashcardModal from "@/components/ColinhaFlashcardModal";
import type { LucideIcon } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  teacher_id: string;
  teacher_name?: string;
}

interface MaterialShowcaseProps {
  title: string;
  description: string;
  icon: LucideIcon;
  materialType: "resumo" | "simulado" | "top_questoes" | "colinhas";
}

const MaterialShowcase = ({ title, description, icon: Icon, materialType }: MaterialShowcaseProps) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lesson | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 1. Find lessons with this material offered + admin_approved
      const { data: metas } = await supabase
        .from("lesson_material_meta")
        .select("lesson_id")
        .eq("material_type", materialType)
        .eq("offered", true)
        .eq("admin_approved", true);
      const ids = (metas || []).map((m) => m.lesson_id);
      if (ids.length === 0) { setLessons([]); setLoading(false); return; }

      // 2. Fetch published+approved lessons
      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("id, title, description, thumbnail_url, teacher_id")
        .in("id", ids)
        .eq("published", true)
        .eq("admin_approved", true)
        .order("created_at", { ascending: false });

      const teacherIds = Array.from(new Set((lessonRows || []).map((l) => l.teacher_id)));
      let teacherMap = new Map<string, string>();
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("teacher_profiles_public")
          .select("user_id, name")
          .in("user_id", teacherIds);
        teacherMap = new Map((profiles || []).map((p) => [p.user_id, p.name]));
      }

      setLessons((lessonRows || []).map((l) => ({ ...l, teacher_name: teacherMap.get(l.teacher_id) })));
      setLoading(false);
    })();
  }, [materialType]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 px-6 pt-24 pb-12 md:px-16 lg:px-32">
        <div className="mx-auto max-w-6xl space-y-8">
          <div className="flex items-center gap-3">
            <Icon className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl font-bold text-gradient">{title}</h1>
          </div>
          <p className="text-muted-foreground text-lg">{description}</p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : lessons.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <Icon className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">Em breve teremos conteúdos disponíveis aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lessons.map((lesson) => (
                <button key={lesson.id} type="button" onClick={() => setSelected(lesson)} className="text-left">
                  <Card className="overflow-hidden transition-transform hover:scale-[1.02] hover:border-primary/50 cursor-pointer h-full">
                    <div className="relative aspect-video bg-muted">
                      {lesson.thumbnail_url ? (
                        <img src={lesson.thumbnail_url} alt={lesson.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Icon className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-background/0 hover:bg-background/30 transition-colors">
                        <Icon className="h-10 w-10 text-foreground opacity-0 hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-semibold line-clamp-2 mb-1">{lesson.title}</p>
                      {lesson.teacher_name && (
                        <p className="text-xs text-muted-foreground">por {lesson.teacher_name}</p>
                      )}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />

      {selected && materialType === "simulado" && (
        <SimuladoModal
          open
          onClose={() => setSelected(null)}
          lessonId={selected.id}
          lessonTitle={selected.title}
        />
      )}
      {selected && materialType === "colinhas" && (
        <ColinhaFlashcardModal
          open
          onClose={() => setSelected(null)}
          lessonId={selected.id}
          lessonTitle={selected.title}
        />
      )}
      {selected && (materialType === "resumo" || materialType === "top_questoes") && (
        <MaterialViewerModal
          open
          onClose={() => setSelected(null)}
          lessonId={selected.id}
          lessonTitle={selected.title}
          kind={materialType}
        />
      )}
    </div>
  );
};

export default MaterialShowcase;
