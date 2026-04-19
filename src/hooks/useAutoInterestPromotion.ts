import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PROMOTION_THRESHOLD = 3;
const MAX_INTEREST_AREAS = 3;

/**
 * Promotes areas to a student's interest list when they watch ≥3 videos
 * (≥70% each) of an area not yet in their interests.
 *
 * Should be called whenever a student crosses the 70% watch milestone.
 * Safe to call multiple times — it only updates the profile when there's
 * a new area to add and respects the MAX_INTEREST_AREAS cap.
 */
export function useAutoInterestPromotion() {
  const { user, profile, role, refreshProfile } = useAuth();

  return useCallback(async () => {
    if (!user || role !== "student") return;

    const currentAreas: string[] = (profile as any)?.areas || [];
    if (currentAreas.length >= MAX_INTEREST_AREAS) return;

    // 1. Get all video views with ≥70% watched for this user
    const { data: views } = await supabase
      .from("video_views")
      .select("content_id, content_type")
      .eq("user_id", user.id)
      .gte("watch_percentage", 70);

    if (!views || views.length < PROMOTION_THRESHOLD) return;

    const lessonIds = views.filter((v) => v.content_type === "lesson").map((v) => v.content_id);
    const examIds = views.filter((v) => v.content_type === "exam_solution").map((v) => v.content_id);

    // 2. Fetch areas for each watched video in parallel
    const [lessonsRes, examsRes] = await Promise.all([
      lessonIds.length > 0
        ? supabase.from("lessons").select("id, areas").in("id", lessonIds)
        : Promise.resolve({ data: [] as { id: string; areas: string[] | null }[] }),
      examIds.length > 0
        ? supabase.from("exam_solutions").select("id, areas").in("id", examIds)
        : Promise.resolve({ data: [] as { id: string; areas: string[] | null }[] }),
    ]);

    const allWatched = [...(lessonsRes.data || []), ...(examsRes.data || [])];

    // 3. Count distinct watched videos per area (a video can belong to multiple areas)
    const areaCounts: Record<string, Set<string>> = {};
    for (const v of allWatched) {
      const areas = (v.areas || []) as string[];
      for (const area of areas) {
        if (!areaCounts[area]) areaCounts[area] = new Set();
        areaCounts[area].add(v.id);
      }
    }

    // 4. Find areas eligible for promotion (≥ threshold and not already selected)
    const eligible = Object.entries(areaCounts)
      .filter(([area, ids]) => ids.size >= PROMOTION_THRESHOLD && !currentAreas.includes(area))
      .sort((a, b) => b[1].size - a[1].size)
      .map(([area]) => area);

    if (eligible.length === 0) return;

    // 5. Respect cap of MAX_INTEREST_AREAS
    const slotsLeft = MAX_INTEREST_AREAS - currentAreas.length;
    const toAdd = eligible.slice(0, slotsLeft);
    const newAreas = [...currentAreas, ...toAdd];

    const { error } = await supabase
      .from("profiles")
      .update({ areas: newAreas })
      .eq("user_id", user.id);

    if (!error) {
      await refreshProfile();
      return toAdd;
    }
  }, [user, profile, role, refreshProfile]);
}
