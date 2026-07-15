// Polyfill Buffer for browser environment (required by Solana/Jupiter swap libs)
// MUST run before any module that references Buffer is imported
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

// Error tracking — must be initialised before React renders
import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
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

// Defer App import until AFTER Buffer polyfill is set up
// This prevents ESM hoisting from evaluating App before window.Buffer is defined
async function bootstrap() {
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap().catch(console.error);
