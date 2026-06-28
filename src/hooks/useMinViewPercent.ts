import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_MIN_VIEW_PERCENT = 70;
let cached: number | null = null;
let inflight: Promise<number> | null = null;

async function fetchMinViewPercent(): Promise<number> {
  if (cached !== null) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "free_trial")
      .maybeSingle();
    const raw = (data?.value as { min_view_percent?: number } | null)?.min_view_percent;
    const n = typeof raw === "number" && raw > 0 && raw <= 100 ? raw : DEFAULT_MIN_VIEW_PERCENT;
    cached = n;
    return n;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function invalidateMinViewPercentCache() {
  cached = null;
}

export { fetchMinViewPercent, DEFAULT_MIN_VIEW_PERCENT };

/** Returns the platform-wide minimum watch percentage required to count a
 *  video view towards public stats. Falls back to 70 while loading. */
export function useMinViewPercent(): number {
  const [value, setValue] = useState<number>(cached ?? DEFAULT_MIN_VIEW_PERCENT);
  useEffect(() => {
    let active = true;
    fetchMinViewPercent().then((n) => {
      if (active) setValue(n);
    });
    return () => {
      active = false;
    };
  }, []);
  return value;
}