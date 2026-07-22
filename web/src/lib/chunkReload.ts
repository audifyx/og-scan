// Shared stale-chunk recovery. After a redeploy, an old cached HTML can name a
// since-deleted chunk hash; the dynamic import then fails (a clean fetch error,
// OR a "reading 'default'" once React.lazy resolves to undefined). Either way
// the tab's HTML is stale — reload once, guarded against loops.
const RELOAD_KEY = "og:preload-reloaded-at";

export function isChunkLoadError(err: unknown): boolean {
  const anyErr = err as { message?: string; name?: string } | null;
  const msg = String(anyErr?.message ?? err ?? "");
  const name = String(anyErr?.name ?? "");
  return (
    name === "ChunkLoadError" ||
    /reading 'default'|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module/i.test(msg)
  );
}

export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return true;
    }
  } catch { /* sessionStorage unavailable */ }
  return false;
}
