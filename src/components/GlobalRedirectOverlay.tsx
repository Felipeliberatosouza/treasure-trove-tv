import { useEffect, useState } from "react";
import RedirectOverlay from "./RedirectOverlay";

export const REDIRECT_EVENT = "lovable:external-redirect";

export interface RedirectEventDetail {
  title?: string;
  description?: string;
}

/**
 * Globally mounted overlay that listens for `REDIRECT_EVENT` window events
 * and shows a full-screen loading state. Useful for non-React redirect
 * helpers (e.g. lib/payments.ts) that don't have local UI state.
 */
export default function GlobalRedirectOverlay() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<RedirectEventDetail>({});

  useEffect(() => {
    let safetyTimer: number | undefined;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<RedirectEventDetail>;
      setDetail(ce.detail || {});
      setOpen(true);
      // Safety net: if for any reason the navigation doesn't happen
      // (popup blocked, network error, SPA route instead of full nav),
      // auto-dismiss after 8s so the user isn't stuck behind the overlay.
      window.clearTimeout(safetyTimer);
      safetyTimer = window.setTimeout(() => setOpen(false), 8000);
    };
    const dismiss = () => {
      window.clearTimeout(safetyTimer);
      setOpen(false);
    };
    window.addEventListener(REDIRECT_EVENT, handler);
    // Explicit dismiss event (e.g. opened in a new tab → no nav happens here).
    window.addEventListener("lovable:external-redirect-dismiss", dismiss);
    // pageshow fires when navigating back from Stripe via bfcache — hide overlay.
    window.addEventListener("pageshow", dismiss);
    // If the SPA changes route (popstate / pushState), the redirect was
    // cancelled or replaced by an in-app navigation — clear the overlay.
    window.addEventListener("popstate", dismiss);
    return () => {
      window.clearTimeout(safetyTimer);
      window.removeEventListener(REDIRECT_EVENT, handler);
      window.removeEventListener("lovable:external-redirect-dismiss", dismiss);
      window.removeEventListener("pageshow", dismiss);
      window.removeEventListener("popstate", dismiss);
    };
  }, []);

  return <RedirectOverlay open={open} title={detail.title} description={detail.description} />;
}
