import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Item = {
  id: string;
  title: string;
  progress: number;
  type: "lesson" | "exam_solution";
};

interface Props {
  onNavigate?: () => void;
}

const ContinueWatchingMenu = ({ onNavigate }: Props) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: views } = await supabase
        .from("video_views")
        .select("content_id, watch_percentage")
        .eq("user_id", user.id);
      if (cancelled) return;
      const progressMap = new Map<string, number>();
      ((views as any[]) || []).forEach((v) => {
        const p = v.watch_percentage || 0;
        const prev = progressMap.get(v.content_id) || 0;
        if (p > prev) progressMap.set(v.content_id, p);
      });
      const inProgressIds = Array.from(progressMap.entries())
        .filter(([, p]) => p >= 5 && p < 95)
        .map(([id]) => id);
      if (inProgressIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const [lessonsRes, examsRes] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, title")
          .in("id", inProgressIds)
          .eq("published", true)
          .eq("admin_approved", true),
        supabase
          .from("exam_solutions")
          .select("id, title")
          .in("id", inProgressIds)
          .eq("published", true)
          .eq("admin_approved", true),
      ]);
      if (cancelled) return;
      const all: Item[] = [
        ...((lessonsRes.data as any[]) || []).map((r) => ({
          id: r.id,
          title: r.title,
          progress: progressMap.get(r.id) || 0,
          type: "lesson" as const,
        })),
        ...((examsRes.data as any[]) || []).map((r) => ({
          id: r.id,
          title: r.title,
          progress: progressMap.get(r.id) || 0,
          type: "exam_solution" as const,
        })),
      ];
      all.sort((a, b) => b.progress - a.progress);
      setItems(all.slice(0, 6));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;
  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Continuar assistindo
      </span>
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              to={`/video/${it.id}`}
              onClick={onNavigate}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-background transition-colors"
            >
              <Play className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 truncate" title={it.title}>{it.title}</span>
              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                {Math.round(it.progress)}%
              </span>
            </Link>
            <div className="mx-2 mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, it.progress))}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContinueWatchingMenu;