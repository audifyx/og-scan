// Buffer polyfill — MUST stay the first import so it evaluates before the app graph.
import "./polyfills";

// Error tracking — must be initialised before React renders
import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunk references after a new deploy. Two failure
// shapes show up in practice:
//  1. "Failed to fetch dynamically imported module" -> Vite's own
//     vite:preloadError event.
//  2. A stale index.html still names an old, since-deleted chunk hash; the
//     fetch can come back 200 (e.g. a CDN/proxy edge serving a cached
//     redirect/fallback) but the module body isn't the real chunk, so
//     React.lazy's import() resolves to something without a usable
//     `default` export and throws "Cannot read properties of undefined
//     (reading 'default')" instead of a clean fetch error.
// Both cases mean the same thing: this tab's HTML is stale. Reload once,
// guarded against loops.
const RELOAD_KEY = "og:preload-reloaded-at";
function reloadOnce() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }
}
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnce();
});
window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? "");
  if (/reading 'default'|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) {
    event.preventDefault();
    reloadOnce();
  }
});
window.addEventListener("error", (event) => {
  const msg = String(event.error?.message ?? event.message ?? "");
  if (/reading 'default'|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) {
    event.preventDefault();
    reloadOnce();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
