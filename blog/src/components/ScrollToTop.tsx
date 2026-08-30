import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scroll management for the blog.
 *
 *  - Forward navigation (PUSH/REPLACE) always starts at the top. React Router
 *    does not reset scroll by itself, so opening a post from halfway down the
 *    index used to drop you halfway down the post.
 *  - Back/forward (POP) returns you to where you were on that entry.
 *  - A hard reload starts at the top: main.tsx sets
 *    history.scrollRestoration = "manual", and the position store below is
 *    per-session, so nothing is remembered across a refresh.
 *
 * We restore positions ourselves rather than leaving it to the browser. With
 * "auto" the browser restores as soon as the history entry is applied, which in
 * an SPA is *before* the post has been fetched and rendered — the document is
 * still short, the offset gets clamped, and you land in the wrong place.
 */

// scrollY per history entry key. Session-only by design.
const positions = new Map<string, number>();
const MAX_ENTRIES = 50;

// True while restore() is reapplying an offset. Every one of those attempts
// fires a scroll event, and until the content is tall enough the reported
// scrollY is a clamped 0 — recording that would overwrite the very target we
// are trying to reach, which is exactly how back-navigation lost its position.
let restoring = false;

function remember(key: string, y: number) {
  // Re-insert so the Map's insertion order doubles as a recency list.
  positions.delete(key);
  positions.set(key, y);
  if (positions.size > MAX_ENTRIES) {
    positions.delete(positions.keys().next().value as string);
  }
}

// index.css sets `scroll-behavior: smooth` on <html>, which would animate these
// and make the jump visible. "instant" opts these scrolls out of that.
function jumpTo(top: number) {
  window.scrollTo({ top, left: 0, behavior: "instant" });
}

/**
 * The target may not be reachable yet: post content arrives asynchronously, so
 * right after a POP the document can still be too short to hold the old offset.
 * Keep reapplying until it sticks or the budget runs out. The budget is wall
 * time, not a frame count — a slow fetch, not a slow renderer, is what we are
 * waiting on.
 */
const RESTORE_BUDGET_MS = 3000;

function restore(target: number): () => void {
  let cancelled = false;
  let raf = 0;
  const deadline = Date.now() + RESTORE_BUDGET_MS;

  restoring = true;
  const stop = () => {
    restoring = false;
    cancelAnimationFrame(raf);
  };

  const attempt = () => {
    if (cancelled) return;
    jumpTo(target);
    if (Math.abs(window.scrollY - target) > 2 && Date.now() < deadline) {
      raf = requestAnimationFrame(attempt);
    } else {
      stop();
    }
  };

  attempt();
  return () => {
    cancelled = true;
    stop();
  };
}

export function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = location.key;

  // Track where the reader is on this entry, so a later POP can come back to it.
  useEffect(() => {
    const save = () => {
      if (restoring) return;
      remember(key, window.scrollY);
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [key]);

  useLayoutEffect(() => {
    // Leave anchor links alone — #section is a request to scroll somewhere.
    if (location.hash) return;

    if (navigationType === "POP") {
      const saved = positions.get(key);
      // No saved offset means this is a fresh load (or a reload), not a real
      // back/forward within the session — start at the top.
      if (saved !== undefined) return restore(saved);
    }

    jumpTo(0);
  }, [key, navigationType, location.hash]);

  return null;
}

export default ScrollToTop;
