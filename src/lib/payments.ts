import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Navigate to an external URL (e.g. Stripe Checkout).
 *
 * We intentionally use window.location (not window.top) because:
 * - In the Lovable preview iframe, window.top points to the editor shell,
 *   so navigating it leaves the app frame blank.
 * - Stripe Checkout works correctly when opened in the same frame.
 */
export function redirectTopLevel(url: string) {
  window.location.href = url;
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
