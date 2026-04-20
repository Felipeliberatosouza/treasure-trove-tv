import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MaterialType = "resumo" | "simulado" | "top_questoes" | "colinhas";

export interface MaterialAvailability {
  resumo: boolean;
  simulado: boolean;
  top_questoes: boolean;
  colinhas: boolean;
}

interface MaterialMetaRow {
  material_type: string;
  offered: boolean;
  admin_approved: boolean;
}

const EMPTY: MaterialAvailability = { resumo: false, simulado: false, top_questoes: false, colinhas: false };

/**
 * Returns which materials are simultaneously offered by the teacher AND approved by admin.
 * If `approvedOnly=false`, only checks `offered`.
 */
export const useLessonMaterials = (lessonId: string | null | undefined, approvedOnly = true) => {
  const [availability, setAvailability] = useState<MaterialAvailability>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lessonId) {
      setAvailability(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("lesson_material_meta")
        .select("material_type, offered, admin_approved")
        .eq("lesson_id", lessonId);
      if (cancelled) return;
      const map: MaterialAvailability = { ...EMPTY };
      (data as MaterialMetaRow[] | null)?.forEach((row) => {
        const ok = row.offered && (approvedOnly ? row.admin_approved : true);
        if (row.material_type === "resumo") map.resumo = ok;
        else if (row.material_type === "simulado") map.simulado = ok;
        else if (row.material_type === "top_questoes") map.top_questoes = ok;
        else if (row.material_type === "colinhas") map.colinhas = ok;
      });
      setAvailability(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lessonId, approvedOnly]);

  return { availability, loading };
};
