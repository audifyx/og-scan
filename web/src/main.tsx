// Buffer polyfill — MUST stay the first import so it evaluates before the app graph.
import "./polyfills";

// Error tracking — must be initialised before React renders
import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunk references after a new deploy
// ("Failed to fetch dynamically imported module"). Reload once, guarded against loops.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const KEY = "og:preload-reloaded-at";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
