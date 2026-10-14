import { useEffect } from "react";
import { env } from "./appsettings";

const HIDE_DELAY_MS = 1000;

// Viser kun scrollbaren, mens brugeren scroller (slås til med
// SCROLLBAR_ON_SCROLL i appsettings). Elementet, der scrolles i, får
// data-scrolling, som CSS'en i globals-skolegpt.scss bruger til at vise scrollbaren.
export function useScrollbarOnScroll() {
  useEffect(() => {
    if (!env.SCROLLBAR_ON_SCROLL) return;

    const hideTimers = new Map<Element, ReturnType<typeof setTimeout>>();

    const showScrollbar = (event: Event) => {
      const element =
        event.target instanceof Element
          ? event.target
          : document.documentElement;

      element.setAttribute("data-scrolling", "");
      clearTimeout(hideTimers.get(element));
      hideTimers.set(
        element,
        setTimeout(() => {
          element.removeAttribute("data-scrolling");
          hideTimers.delete(element);
        }, HIDE_DELAY_MS),
      );
    };

    // Scroll-events bobler ikke, så de fanges i capture-fasen
    document.addEventListener("scroll", showScrollbar, true);
    return () => {
      document.removeEventListener("scroll", showScrollbar, true);
      hideTimers.forEach(clearTimeout);
    };
  }, []);
}
