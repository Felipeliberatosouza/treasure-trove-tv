import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ContentForm from "./ContentForm";

const LessonsTab = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLessons = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("lessons")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    setLessons(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLessons();
  }, [user]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">Minhas Aulas</h2>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="font-display gap-1">
            <Plus className="h-4 w-4" /> Nova Aula
          </Button>
        )}
      </div>

      {showForm ? (
        <ContentForm
          table="lessons"
          onSaved={() => { setShowForm(false); fetchLessons(); }}
          onCancel={() => setShowForm(false)}
        />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma aula cadastrada. Clique em "Nova Aula" para começar.</p>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
              {lesson.thumbnail_url ? (
                <img src={lesson.thumbnail_url} alt="" className="h-14 w-20 rounded object-cover" />
              ) : (
                <div className="flex h-14 w-20 items-center justify-center rounded bg-muted">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lesson.title}</p>
                <p className="text-xs text-muted-foreground truncate">{lesson.description || "Sem descrição"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LessonsTab;
