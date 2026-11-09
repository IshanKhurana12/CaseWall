import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// BrowserRouter keeps the previous page's scroll position on navigation.
// Jump to the top whenever the path changes via a link/navigate (PUSH/REPLACE).
// Back/forward (POP) is left alone so the browser can restore the old position,
// e.g. returning to the same spot in the product grid.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if (navType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navType]);

  return null;
}
