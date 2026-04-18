import { toast } from "sonner";
import type { NavigateFunction } from "react-router-dom";
import type { EmbeddedCheckoutState } from "@/pages/Checkout";

interface BuyUnitParams {
  contentId: string;
  contentType: "lesson" | "exam_solution";
  contentTitle: string;
  unitPrice: number; // in BRL
  cancelUrl?: string;
  navigate: NavigateFunction;
}

/**
 * Routes the user to the embedded /checkout page for a one-off
 * content purchase. No external page is opened.
 *
 * Returns true if navigation started.
 */
export function startUnitCheckout({
  contentId,
  contentType,
  contentTitle,
  unitPrice,
  cancelUrl,
  navigate,
}: BuyUnitParams): boolean {
  if (!contentId || !contentType) {
    toast.error("Conteúdo inválido para compra.");
    return false;
  }
  if (!unitPrice || unitPrice <= 0) {
    toast.error("Esta aula não está disponível para compra avulsa.");
    return false;
  }
  const state: EmbeddedCheckoutState = {
    mode: "unit",
    contentId,
    contentType,
    contentTitle,
    unitPrice,
    cancelUrl: cancelUrl || `/video/${contentId}`,
  };
  navigate("/checkout", { state });
  return true;
}
