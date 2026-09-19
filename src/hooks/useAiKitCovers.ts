import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Busca as capas geradas para cada material de IA (assinadas no backend).
 * Materiais sem capa pronta continuam com a imagem padrão do chamador.
 */
export const useAiKitCovers = (ids: string[]) => {
  const [covers, setCovers] = useState<Record<string, string>>({});
  const key = ids.slice().sort().join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) {
      setCovers({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.functions.invoke("study-slide-image", {
        body: { cover_ids: list },
      });
      if (cancelled) return;
      const result = (data as { covers?: Record<string, string> } | null)?.covers;
      if (result) setCovers(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return covers;
};
