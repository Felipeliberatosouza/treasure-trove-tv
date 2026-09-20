import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  contentId: string;
  contentType: string;
  /** Texto exibido acima das estrelas. */
  title?: string;
}

/**
 * Avaliação por estrelas reutilizável (aulas gravadas e aulas com professor virtual).
 */
const ContentRating = ({ contentId, contentType, title = "Avalie esta aula" }: Props) => {
  const { user } = useAuth();
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [aggRes, ownRes] = await Promise.all([
      supabase.rpc("get_video_rating_aggregates" as any, { _ids: [contentId] }),
      user
        ? supabase
            .from("video_ratings")
            .select("rating")
            .eq("content_type", contentType)
            .eq("content_id", contentId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);
    const agg = (((aggRes as any).data as any[]) || []).find(
      (r) => r.content_type === contentType && r.content_id === contentId,
    );
    setAverage(agg ? Number(agg.average) || 0 : 0);
    setCount(agg?.count || 0);
    setUserRating((ownRes as any).data?.rating ?? null);
  }, [contentId, contentType, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const rate = async (value: number) => {
    if (!user) {
      toast.error("Faça login para avaliar.");
      return;
    }
    setSaving(true);
    if (userRating !== null) {
      await supabase
        .from("video_ratings")
        .update({ rating: value })
        .eq("user_id", user.id)
        .eq("content_type", contentType)
        .eq("content_id", contentId);
    } else {
      await supabase
        .from("video_ratings")
        .insert({ user_id: user.id, content_type: contentType, content_id: contentId, rating: value });
    }
    toast.success("Avaliação registrada!");
    await load();
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`h-4 w-4 ${s <= Math.round(average) ? "fill-accent text-accent" : "text-muted-foreground/40"}`}
            />
          ))}
        </div>
        <span className="text-sm font-semibold">{average.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">({count} avaliações)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{title}:</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              disabled={saving}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => rate(s)}
              aria-label={`Dar nota ${s}`}
              className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
            >
              <Star
                className={`h-5 w-5 ${s <= (hovered || userRating || 0) ? "fill-accent text-accent" : "text-muted-foreground/40"}`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContentRating;
