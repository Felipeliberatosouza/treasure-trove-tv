import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Redirect that escapes any iframe (e.g. preview iframe). */
export function redirectTopLevel(url: string) {
  try {
    window.top!.location.href = url;
  } catch {
    window.location.href = url;
  }
}

interface BuyUnitParams {
  contentId: string;
  contentType: "lesson" | "exam_solution";
}

/**
 * Initiates a one-off purchase via Stripe Checkout.
 * Returns true if redirect started, false on error (toast already shown).
 */
export async function startUnitCheckout({ contentId, contentType }: BuyUnitParams): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("create-payment", {
      body: { contentId, contentType },
    });
    if (error) throw error;
    if (!data?.ok) {
      toast.error(data?.error || "Não foi possível iniciar a compra.");
      return false;
    }
    if (data?.url) {
      redirectTopLevel(data.url);
      return true;
    }
    toast.error("Resposta inválida do servidor de pagamento.");
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao iniciar a compra.";
    toast.error(msg);
    console.error("startUnitCheckout error:", err);
    return false;
  }
}
