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
      const { data } = await supabase
        .from("video_ratings")
        .select("content_id, rating")
        .eq("content_type", contentType)
        .in("content_id", contentIds);

      if (!data) return;

      const map: RatingsMap = {};
      for (const r of data) {
        if (!map[r.content_id]) map[r.content_id] = { average: 0, count: 0 };
        map[r.content_id].count++;
        map[r.content_id].average += r.rating;
      }
      for (const id of Object.keys(map)) {
        map[id].average = map[id].average / map[id].count;
      }
      setRatings(map);
    };

    fetchAll();
  }, [contentIds.join(","), contentType]);

  return ratings;
}
