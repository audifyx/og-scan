/**
 * OrbitX Social — post impression recording.
 *
 * Views are counted anonymously: the client sends its per-browser visitor
 * id and the server SHA-256-hashes it before storing (see
 * social-overhaul-migration.sql + web/api/_social.js). One viewer counts
 * once per post per day — the server dedups, this hook just avoids
 * spamming the endpoint (in-memory once-per-post-per-page-load + an
 * IntersectionObserver so only posts actually seen on screen are counted).
 *
 * Visitor-id resolution mirrors the stats tracker snippet in web/app.html:
 * signed-in hashed identity (localStorage `orbitx_uid`) > `orbitx_vid`
 * cookie > localStorage `orbitx_vid` > fresh UUID (persisted for next time).
 */
import { useCallback, useEffect, useRef } from "react";

const UID_KEY = "orbitx_uid";
const VID_KEY = "orbitx_vid";

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function writeVid(vid: string): void {
  try {
    window.localStorage.setItem(VID_KEY, vid);
  } catch {
    /* private mode — keep the in-memory id */
  }
  try {
    document.cookie = `${VID_KEY}=${encodeURIComponent(vid)}; path=/; max-age=${365 * 86400}; SameSite=Lax`;
  } catch {
    /* cookies blocked — localStorage copy is enough */
  }
}

/** Anonymous per-browser visitor id, same resolution order as the stats tracker. */
export function getSocialVid(): string {
  if (typeof window === "undefined") return "";
  try {
    const signedIn = window.localStorage.getItem(UID_KEY);
    if (signedIn) return signedIn;
    const fromCookie = readCookie(VID_KEY);
    if (fromCookie) return fromCookie;
    const fromStorage = window.localStorage.getItem(VID_KEY);
    if (fromStorage) return fromStorage;
  } catch {
    /* storage unavailable — fall through to a fresh id */
  }
  const fresh =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `vid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  writeVid(fresh);
  return fresh;
}

// Once per post per page load — the server dedups per day on top of this.
const sentThisLoad = new Set<string>();

/** Fire-and-forget: record one anonymous view of a post. Never throws. */
export function recordImpression(postId: string): void {
  if (!postId || typeof window === "undefined") return;
  if (sentThisLoad.has(postId)) return;
  sentThisLoad.add(postId);
  const vid = getSocialVid();
  if (!vid) return;
  try {
    const body = JSON.stringify({ postId, vid });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/social/impression", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/social/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics must never break the feed */
  }
}

/**
 * IntersectionObserver-based recording for a feed.
 *
 * Usage (W1 — inside the feed's post renderer):
 *   const observePost = usePostImpressionObserver();
 *   ...
 *   <article ref={observePost(post.id)} data-post-id={post.id}>…</article>
 *
 * A post counts once it has been ≥40% visible. Each post fires at most
 * once per page load; the element is unobserved after it fires.
 */
export function usePostImpressionObserver(): (postId: string) => (el: HTMLElement | null) => void {
  const seenRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.postId;
          if (!id || seenRef.current.has(id)) continue;
          seenRef.current.add(id);
          observer.unobserve(entry.target);
          recordImpression(id);
        }
      },
      { threshold: 0.4 }
    );
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  return useCallback(
    (postId: string) => (el: HTMLElement | null) => {
      if (!el) return;
      el.dataset.postId = postId;
      if (seenRef.current.has(postId)) return;
      if (observerRef.current) {
        observerRef.current.observe(el);
      } else {
        // No IntersectionObserver (old browser / SSR): count on mount.
        seenRef.current.add(postId);
        recordImpression(postId);
      }
    },
    []
  );
}
