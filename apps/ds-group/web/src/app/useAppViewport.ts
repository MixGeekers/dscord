import { useEffect } from "react";

// The keyboard is treated as open when it hides more than this much of the screen.
const KEYBOARD_THRESHOLD = 120;

/**
 * Keeps the app pinned to the visible part of the screen and turns off page zoom.
 *
 * Mobile browsers and installed apps (iOS and Android) shrink only the visual
 * viewport when the on-screen keyboard opens, then pan the page so the focused
 * input stays visible. That pan pushes the header under the status bar. The
 * page body instead follows the visual viewport through --app-top and
 * --app-bottom, so nothing moves under the status bar and the composer sits
 * directly on the keyboard. While the keyboard is open the home-indicator
 * inset is no longer at the bottom of the app, so data-keyboard drops it.
 * The keyboard counts as open only while a text field has focus.
 */
export function useAppViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const typing = () => {
      const element = document.activeElement as HTMLElement | null;
      return Boolean(
        element &&
        (element.isContentEditable ||
          (element.tagName === "INPUT" &&
            !["button", "checkbox", "radio", "range", "color", "file"].includes(
              (element as HTMLInputElement).type,
            )) ||
          element.tagName === "TEXTAREA" ||
          element.tagName === "SELECT"),
      );
    };

    const apply = () => {
      frame = 0;
      if (!viewport || viewport.scale > 1.01) return;
      const hidden = window.innerHeight - viewport.height;
      const keyboard = typing() && hidden > KEYBOARD_THRESHOLD;
      // iOS 26 can leave offsetTop behind after the keyboard closes, which would
      // shift the whole app down; without a keyboard the page always starts at 0.
      const top = keyboard ? Math.max(0, viewport.offsetTop) : 0;
      const bottom = keyboard ? Math.max(0, hidden - top) : 0;
      if (!keyboard && (window.scrollY || viewport.offsetTop))
        window.scrollTo(0, 0);
      root.style.setProperty("--app-top", `${Math.round(top)}px`);
      root.style.setProperty("--app-bottom", `${Math.round(bottom)}px`);
      root.toggleAttribute("data-keyboard", keyboard);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    // iOS ignores user-scalable=no; its gesture events are the only way to stop pinch zoom.
    const blockGesture = (event: Event) => event.preventDefault();

    apply();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(name, blockGesture, { passive: false });
    }
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
        document.removeEventListener(name, blockGesture);
      }
      root.style.removeProperty("--app-top");
      root.style.removeProperty("--app-bottom");
      root.removeAttribute("data-keyboard");
    };
  }, []);
}
