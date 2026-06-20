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
      let cachedOffset = Number.NaN;
      let rafId = 0;
      let realignScheduled = false;
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const getHeaderOffset = () => {
        const header =
          document.querySelector<HTMLElement>("[data-fixed-header]") ||
          document.querySelector<HTMLElement>("header.fixed, nav.fixed");
        // Small visual gap so the section title isn't flush against the header.
        const gap = 8;
        return (header?.getBoundingClientRect().height ?? 0) + gap;
      };

      const align = (el: HTMLElement, behavior: ScrollBehavior = "auto") => {
        // Reuse cached offset during the stabilisation loop to avoid
        // forced layout reads on every tick.
        if (Number.isNaN(cachedOffset)) cachedOffset = getHeaderOffset();
        const top = el.getBoundingClientRect().top + window.scrollY - cachedOffset;
        const target = Math.max(0, top);
        if (Math.abs(window.scrollY - target) < 1) return;
        window.scrollTo({ top: target, left: 0, behavior });
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
        // Use instant scroll during stabilisation to avoid stacking smooth
        // animations and producing jank.
        align(el, "auto");

        if (top === lastTop && docHeight === lastDocHeight) {
          stableCount += 1;
        } else {
          stableCount = 0;
          lastTop = top;
          lastDocHeight = docHeight;
        }

        if (stableCount >= STABLE_FRAMES) {
          // Layout settled — refresh offset and animate the final landing
          // for a smooth visual handoff.
          cachedOffset = getHeaderOffset();
          align(el, prefersReducedMotion ? "auto" : "smooth");
          return;
        }
        if (elapsed < MAX_WAIT_MS) setTimeout(tick, TICK_MS);
      };

      const realign = () => {
        if (cancelled || realignScheduled) return;
        realignScheduled = true;
        rafId = window.requestAnimationFrame(() => {
          realignScheduled = false;
          if (cancelled) return;
          const el = document.getElementById(id);
          if (!el) return;
          // Invalidate cached offset so the new viewport size is measured.
          cachedOffset = getHeaderOffset();
          align(el, prefersReducedMotion ? "auto" : "smooth");
        });
      };

      tick();

      window.addEventListener("resize", realign, { passive: true });
      window.addEventListener("orientationchange", realign, { passive: true });

      return () => {
        cancelled = true;
        if (rafId) window.cancelAnimationFrame(rafId);
        window.removeEventListener("resize", realign);
        window.removeEventListener("orientationchange", realign);
      };
    }
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduced ? "auto" : "smooth" });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
