import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Navigate to an external URL (e.g. Stripe Checkout).
 *
 * Stripe Checkout sets `X-Frame-Options: DENY`, so it cannot render inside
 * an iframe (Lovable preview, embedded apps, etc). We must break out of any
 * iframe before navigating, otherwise the user sees a blank/white screen.
 *
 * Strategy:
 * 1. If we're inside an iframe, try `window.top.location` (same-origin top).
 * 2. If that throws (cross-origin top, e.g. Lovable editor shell), open the
 *    URL in a new tab via `window.open(url, "_blank")`.
 * 3. If even that is blocked (popup blocker), fall back to same-frame nav
 *    so the user at least sees Stripe's "refused to connect" instead of
 *    a frozen white screen, and we surface a toast asking them to allow popups.
 */
export function redirectTopLevel(
  url: string,
  options?: { title?: string; description?: string }
) {
  window.dispatchEvent(
    new CustomEvent("lovable:external-redirect", {
      detail: {
        title: options?.title ?? "Redirecionando para o pagamento seguro...",
        description: options?.description,
      },
    })
  );

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true; // cross-origin access throws → definitely in an iframe
    }
  })();

  if (!inIframe) {
    window.location.href = url;
    return;
  }

  // Try to navigate the top-level window (works only if same-origin).
  try {
    if (window.top) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // cross-origin top (Lovable editor) — fall through to popup
  }

  // Open in a new tab. This is the most reliable cross-iframe path.
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) {
    // Hide our overlay since the user is now interacting with the new tab.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("lovable:external-redirect-dismiss"));
    }, 500);
    return;
  }

  // Popup blocked — last resort: same-frame nav. Stripe will refuse, but
  // we let the user know what happened.
  toast.error(
    "Permita popups para este site ou clique novamente para abrir o pagamento.",
    { duration: 6000 }
  );
  window.dispatchEvent(new CustomEvent("lovable:external-redirect-dismiss"));
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
