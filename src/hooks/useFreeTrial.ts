import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

export interface TrialStatus {
  /** Whether the user has an active, non-expired trial */
  hasActiveTrial: boolean;
  /** Whether the free trial feature is enabled globally */
  trialEnabled: boolean;
  /** Days remaining (only relevant for days-based trials) */
  daysRemaining: number;
  /** Videos remaining (only relevant for videos-based trials) */
  videosRemaining: number;
  /** Trial type configured by admin */
  trialType: "days" | "videos";
  /** Whether data is still loading */
  loading: boolean;
}

export function useFreeTrial() {
  const { user } = useAuth();
  const { data: trialSettings, loading: settingsLoading } = usePlatformSettings("free_trial");
  const [trialRow, setTrialRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrial = useCallback(async () => {
    if (!user) {
      setTrialRow(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("free_trials")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setTrialRow(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTrial();
  }, [fetchTrial]);

  /** Start a free trial for the current user using admin-configured settings */
  const startTrial = useCallback(async () => {
    if (!user || !trialSettings?.enabled) return false;
    const { error } = await supabase.from("free_trials").insert({
      user_id: user.id,
      trial_type: trialSettings.trial_type,
      trial_days: trialSettings.trial_days,
      trial_videos: trialSettings.trial_videos,
    });
    if (error) {
      console.error("Error starting trial", error);
      return false;
    }
    await fetchTrial();
    return true;
  }, [user, trialSettings, fetchTrial]);

  /** Increment videos_watched counter. Call after a video is accessed during trial. */
  const recordVideoWatch = useCallback(async () => {
    if (!user || !trialRow) return;
    await supabase
      .from("free_trials")
      .update({ videos_watched: (trialRow.videos_watched || 0) + 1 })
      .eq("user_id", user.id);
    await fetchTrial();
  }, [user, trialRow, fetchTrial]);

  // Compute status
  const trialEnabled = trialSettings?.enabled ?? false;
  const trialType = (trialSettings?.trial_type ?? "days") as "days" | "videos";

  let hasActiveTrial = false;
  let daysRemaining = 0;
  let videosRemaining = 0;
  let expiresAt: Date | null = null;

  if (trialRow && trialRow.active) {
    if (trialRow.trial_type === "days") {
      const started = new Date(trialRow.started_at).getTime();
      const now = Date.now();
      const elapsed = (now - started) / (1000 * 60 * 60 * 24);
      daysRemaining = Math.max(0, Math.ceil(trialRow.trial_days - elapsed));
      hasActiveTrial = daysRemaining > 0;
      expiresAt = new Date(started + trialRow.trial_days * 24 * 60 * 60 * 1000);
    } else {
      videosRemaining = Math.max(0, trialRow.trial_videos - (trialRow.videos_watched || 0));
      hasActiveTrial = videosRemaining > 0;
    }
  }

  const status: TrialStatus = {
    hasActiveTrial,
    trialEnabled,
    daysRemaining,
    videosRemaining,
    trialType,
    loading: loading || settingsLoading,
    expiresAt,
  };

  return { ...status, startTrial, recordVideoWatch, trialRow, refetch: fetchTrial };
}
