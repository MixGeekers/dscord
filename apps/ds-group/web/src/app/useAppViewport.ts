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
 */
export function useAppViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;

    const apply = () => {
      frame = 0;
      if (!viewport || viewport.scale > 1.01) return;
      const top = Math.max(0, viewport.offsetTop);
      const bottom = Math.max(0, window.innerHeight - top - viewport.height);
      root.style.setProperty("--app-top", `${Math.round(top)}px`);
      root.style.setProperty("--app-bottom", `${Math.round(bottom)}px`);
      root.toggleAttribute("data-keyboard", bottom > KEYBOARD_THRESHOLD);
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
    for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
      document.addEventListener(name, blockGesture, { passive: false });
    }
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
        document.removeEventListener(name, blockGesture);
      }
      root.style.removeProperty("--app-top");
      root.style.removeProperty("--app-bottom");
      root.removeAttribute("data-keyboard");
    };
  }, []);
}
