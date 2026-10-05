import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { scrollToId } from "../lib/dom";

/** New page: jump to the top. A link like /#craft: scroll to that section. Filter changes do neither. */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const frame = requestAnimationFrame(() => scrollToId(hash.slice(1)));
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
