import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Forces the window to scroll to the top whenever the route changes.
 * Without this, React Router preserves the previous scroll position,
 * which makes pages like /checkout appear mid-scroll on mobile.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, "");
      // Retry briefly while the page mounts AND re-scroll a few times after
      // it's found, since async content above can shift the section's
      // position after the first scroll.
      let mountTries = 0;
      let settleTries = 0;
      const settle = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
        if (settleTries++ < 8) setTimeout(settle, 150);
      };
      const waitForMount = () => {
        if (document.getElementById(id)) {
          settle();
          return;
        }
        if (mountTries++ < 30) setTimeout(waitForMount, 100);
      };
      waitForMount();
      return;
    }
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
