// Drop-in replacement for React.lazy that survives a transient chunk fetch
// failure (one retry) and, if the HTML is genuinely stale, triggers a single
// guarded reload to fetch a fresh chunk map.
import { lazy, type ComponentType } from "react";
import { isChunkLoadError, reloadOnce } from "./chunkReload";

export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (e) {
      if (isChunkLoadError(e)) {
        try {
          return await factory(); // transient? retry once
        } catch {
          reloadOnce(); // stale HTML — reload to get fresh chunks
        }
      }
      throw e;
    }
  });
}
