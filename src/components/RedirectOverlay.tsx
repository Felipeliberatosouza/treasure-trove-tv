import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

interface RedirectOverlayProps {
  open: boolean;
  title?: string;
  description?: string;
}

/**
 * Full-screen overlay shown while we redirect the browser to an external
 * URL (typically Stripe Checkout / Customer Portal). Prevents the user
 * from thinking the app froze during the brief network round-trip.
 */
export default function RedirectOverlay({
  open,
  title = "Redirecionando para o pagamento seguro...",
  description = "Aguarde alguns instantes. Não feche esta janela.",
}: RedirectOverlayProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm animate-in fade-in"
    >
      <div className="mx-4 max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>,
    document.body
  );
}
