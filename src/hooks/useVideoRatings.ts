import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RatingsMap {
  [contentId: string]: { average: number; count: number };
}

export function useVideoRatings(contentIds: string[], contentType = "lesson") {
  const [ratings, setRatings] = useState<RatingsMap>({});

  useEffect(() => {
    if (contentIds.length === 0) return;

    const fetchAll = async () => {
      const { data } = await supabase.rpc("get_video_rating_aggregates" as any, {
        _ids: contentIds,
      });
      if (!data) return;
      const map: RatingsMap = {};
      for (const r of data as any[]) {
        if (r.content_type !== contentType) continue;
        map[r.content_id] = { average: Number(r.average) || 0, count: r.count || 0 };
      }
      setRatings(map);
    };

    fetchAll();
  }, [contentIds.join(","), contentType]);

  return ratings;
}
