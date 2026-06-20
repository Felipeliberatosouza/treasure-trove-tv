import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Forces the window to scroll to the top whenever the route changes.
 * When the URL has a hash, scroll to the target element and keep
 * re-aligning it until its position stabilises — this compensates for
 * async sections above (e.g. PricingSection) that mount after the first
 * scroll and would otherwise push the target out of view.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, "");
      let cancelled = false;
      const start = performance.now();
      const MAX_WAIT_MS = 6000; // total budget
      const STABLE_FRAMES = 6; // ~6 RAF + 120ms ticks of unchanged height/top
      const TICK_MS = 120;

      let lastTop = Number.NaN;
      let lastDocHeight = Number.NaN;
      let stableCount = 0;

      const getHeaderOffset = () => {
        const header =
          document.querySelector<HTMLElement>("[data-fixed-header]") ||
          document.querySelector<HTMLElement>("header.fixed, nav.fixed");
        // Small visual gap so the section title isn't flush against the header.
        const gap = 8;
        return (header?.getBoundingClientRect().height ?? 0) + gap;
      };

      const align = (el: HTMLElement) => {
        const offset = getHeaderOffset();
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
      };

      const tick = () => {
        if (cancelled) return;
        const el = document.getElementById(id);
        const elapsed = performance.now() - start;

        if (!el) {
          if (elapsed < MAX_WAIT_MS) setTimeout(tick, TICK_MS);
          return;
        }

        const top = el.getBoundingClientRect().top + window.scrollY;
        const docHeight = document.documentElement.scrollHeight;

        // Re-align every tick so the target stays in view as layout shifts.
        align(el);

        if (top === lastTop && docHeight === lastDocHeight) {
          stableCount += 1;
        } else {
          stableCount = 0;
          lastTop = top;
          lastDocHeight = docHeight;
        }

        if (stableCount >= STABLE_FRAMES) return; // layout settled
        if (elapsed < MAX_WAIT_MS) setTimeout(tick, TICK_MS);
      };

      const realign = () => {
        const el = document.getElementById(id);
        if (el && !cancelled) align(el);
      };

      tick();

      window.addEventListener("resize", realign);
      window.addEventListener("orientationchange", realign);

      return () => {
        cancelled = true;
        window.removeEventListener("resize", realign);
        window.removeEventListener("orientationchange", realign);
      };
    }
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
