import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CourseArea {
  id: string;
  name: string;
  icon: string;
  active: boolean;
  show_on_homepage: boolean;
  sort_order: number;
}

export function useCourseAreas(onlyActive = true) {
  const [areas, setAreas] = useState<CourseArea[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("course_areas")
      .select("*")
      .order("sort_order", { ascending: true });

    if (onlyActive) {
      query = query.eq("active", true);
    }

    const { data, error } = await query;
    if (!error && data) {
      setAreas(data as CourseArea[]);
    }
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => { fetch(); }, [fetch]);

  return { areas, loading, refetch: fetch };
}

export function useHomepageAreas() {
  const [areas, setAreas] = useState<CourseArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAreas = async () => {
      const { data, error } = await supabase
        .from("course_areas")
        .select("*")
        .eq("active", true)
        .eq("show_on_homepage", true)
        .order("sort_order", { ascending: true });

      if (!error && data) {
        setAreas(data as CourseArea[]);
      }
      setLoading(false);
    };
    fetchAreas();
  }, []);

  return { areas, loading };
}
