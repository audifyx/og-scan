/**
 * OrbitX City downtown — store menu event bus.
 *
 * The NPC worker lane calls openStoreMenu(storeKey) from a worker's TALK
 * prompt to open that store's order menu (StoreMenu.tsx). The City HUD
 * subscribes and renders the modal. Keys: "mcorbits" | "burgerkhan" |
 * "wendas" | "pizzashack" | "coffeeshop" (see STORE_MENUS).
 */
import type { StoreKey } from "./StoreMenu";

type StoreMenuHandler = (key: StoreKey) => void;

const handlers = new Set<StoreMenuHandler>();

/** Subscribe to store-menu open requests. Returns an unsubscribe function. */
export function subscribeStoreMenu(h: StoreMenuHandler): () => void {
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
}

/**
 * Open a store's order menu (NPC worker TALK hook).
 * No subscribers yet (e.g. HUD not mounted) → no-op.
 */
export function openStoreMenu(storeKey: StoreKey): void {
  for (const h of handlers) {
    try {
      h(storeKey);
    } catch {
      /* one bad subscriber must not break the others */
    }
  }
}
