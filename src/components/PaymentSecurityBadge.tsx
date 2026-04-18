import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentSecurityBadgeProps {
  className?: string;
  variant?: "inline" | "pill";
}

/**
 * Reusable trust badge shown wherever the user enters or is about to enter
 * card data. Reinforces that card processing happens on Stripe and never
 * touches our servers. Use across in-app card capture (PaymentElement),
 * redirect overlays, and checkout CTAs for visual consistency.
 */
export default function PaymentSecurityBadge({
  className,
  variant = "inline",
}: PaymentSecurityBadgeProps) {
  if (variant === "pill") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground",
          className
        )}
      >
        <Lock className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        <span>Pagamento seguro via Stripe</span>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Lock className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      <span>Pagamento seguro via Stripe</span>
    </p>
  );
}
