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
    const handler = (e: Event) => {
      const ce = e as CustomEvent<RedirectEventDetail>;
      setDetail(ce.detail || {});
      setOpen(true);
    };
    window.addEventListener(REDIRECT_EVENT, handler);
    // pageshow fires when navigating back from Stripe via bfcache — hide overlay.
    const onPageShow = () => setOpen(false);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener(REDIRECT_EVENT, handler);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return <RedirectOverlay open={open} title={detail.title} description={detail.description} />;
}
