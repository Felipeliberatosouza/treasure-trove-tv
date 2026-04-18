import { Loader2, ShieldCheck } from "lucide-react";
import { createPortal } from "react-dom";
import PaymentSecurityBadge from "@/components/PaymentSecurityBadge";

interface RedirectOverlayProps {
  open: boolean;
  title?: string;
  description?: string;
}

/**
 * Full-screen overlay shown while we redirect the browser to an external
 * URL (typically Stripe Checkout / Customer Portal). Visually consistent
 * with the in-modal 3DS overlay used in PlanChangeCheckoutModal so the
 * user sees the same security cue across all payment touchpoints.
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
        <div className="mx-auto mb-4 relative inline-flex">
          <ShieldCheck className="h-12 w-12 text-primary" />
          <Loader2 className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1 bg-card rounded-full" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-4 flex justify-center">
          <PaymentSecurityBadge variant="pill" />
        </div>
      </div>
    </div>,
    document.body
  );
}
