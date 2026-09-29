/**
 * OrbitXCity — Gadgets module store.
 *
 * Two things live here:
 *  1. `useGadgetInventory` — React hook over a localStorage-backed inventory
 *     of owned/equipped gadgets + the ORBITX burn receipts.
 *  2. `GadgetRuntime` — a tiny pub/sub singleton the 3D controllers
 *     (`GrapplingHook`, `TokenScanner`) push live state into so the React HUD
 *     stays in sync without prop-drilling controller internals.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type {
  GadgetBurnRecord,
  GadgetId,
  GadgetInventoryState,
  GadgetRuntimeSnapshot,
  GrappleLifecycle,
  ScanHitView,
} from "./types";

const STORAGE_KEY = "orbitxcity.gadgets.inventory.v1";

const EMPTY: GadgetInventoryState = { owned: [], equipped: null, burns: [] };

function loadInventory(): GadgetInventoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<GadgetInventoryState>;
    const owned = Array.isArray(parsed.owned)
      ? parsed.owned.filter(
          (g): g is GadgetId => g === "grappling-hook" || g === "token-scanner",
        )
      : [];
    const equipped =
      parsed.equipped === "grappling-hook" || parsed.equipped === "token-scanner"
        ? parsed.equipped
        : null;
    return {
      owned,
      equipped: equipped && owned.includes(equipped) ? equipped : null,
      burns: Array.isArray(parsed.burns) ? parsed.burns : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function saveInventory(state: GadgetInventoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — inventory just won't persist */
  }
}

type InventoryListener = (state: GadgetInventoryState) => void;

let inventoryState: GadgetInventoryState = loadInventory();
const inventoryListeners = new Set<InventoryListener>();

function setInventory(next: GadgetInventoryState) {
  inventoryState = next;
  saveInventory(next);
  inventoryListeners.forEach((l) => l(next));
}

function subscribeInventory(l: InventoryListener): () => void {
  inventoryListeners.add(l);
  return () => {
    inventoryListeners.delete(l);
  };
}

function getInventorySnapshot(): GadgetInventoryState {
  return inventoryState;
}

/** Pure reducer-ish helpers — exported for tests. */
export function applyPurchase(
  state: GadgetInventoryState,
  gadgetId: GadgetId,
  burn: GadgetBurnRecord,
): GadgetInventoryState {
  if (state.owned.includes(gadgetId)) return state;
  return {
    owned: [...state.owned, gadgetId],
    equipped: state.equipped,
    burns: [...state.burns, burn],
  };
}

export function applyEquip(
  state: GadgetInventoryState,
  gadgetId: GadgetId | null,
): GadgetInventoryState {
  if (gadgetId !== null && !state.owned.includes(gadgetId)) return state;
  return { ...state, equipped: gadgetId };
}

export interface GadgetInventory {
  owned: GadgetId[];
  equipped: GadgetId | null;
  burns: GadgetBurnRecord[];
  owns: (id: GadgetId) => boolean;
  recordPurchase: (id: GadgetId, burn: GadgetBurnRecord) => void;
  equip: (id: GadgetId | null) => void;
  totalBurned: number;
}

export function useGadgetInventory(): GadgetInventory {
  const state = useSyncExternalStore(
    subscribeInventory,
    getInventorySnapshot,
    getInventorySnapshot,
  );

  const recordPurchase = useCallback((id: GadgetId, burn: GadgetBurnRecord) => {
    setInventory(applyPurchase(getInventorySnapshot(), id, burn));
  }, []);

  const equip = useCallback((id: GadgetId | null) => {
    setInventory(applyEquip(getInventorySnapshot(), id));
  }, []);

  const owns = useCallback((id: GadgetId) => state.owned.includes(id), [state.owned]);
  const totalBurned = state.burns.reduce((s, b) => s + b.amount, 0);

  return { ...state, owns, recordPurchase, equip, totalBurned };
}

// ── GadgetRuntime: live 3D state → HUD ──────────────────────────────────────

const RUNTIME_INITIAL: GadgetRuntimeSnapshot = {
  equipped: null,
  grapple: "idle",
  grappleAnchor: null,
  scannerActive: false,
  scanHit: null,
  pricesConnected: false,
};

type RuntimeListener = (snap: GadgetRuntimeSnapshot) => void;

class GadgetRuntimeStore {
  private snap: GadgetRuntimeSnapshot = { ...RUNTIME_INITIAL };
  private listeners = new Set<RuntimeListener>();

  subscribe = (l: RuntimeListener): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getSnapshot = (): GadgetRuntimeSnapshot => this.snap;

  private emit(patch: Partial<GadgetRuntimeSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l(this.snap));
  }

  setEquipped(equipped: GadgetId | null) {
    this.emit({ equipped });
  }
  setGrapple(lifecycle: GrappleLifecycle, anchor: [number, number, number] | null) {
    this.emit({ grapple: lifecycle, grappleAnchor: anchor });
  }
  setScannerActive(active: boolean) {
    this.emit({ scannerActive: active, scanHit: active ? this.snap.scanHit : null });
  }
  setScanHit(hit: ScanHitView | null) {
    this.emit({ scanHit: hit });
  }
  setPricesConnected(connected: boolean) {
    this.emit({ pricesConnected: connected });
  }
  reset() {
    this.snap = { ...RUNTIME_INITIAL };
    this.listeners.forEach((l) => l(this.snap));
  }
}

/** Singleton shared by the controllers and the HUD. */
export const GadgetRuntime = new GadgetRuntimeStore();

export function useGadgetRuntime(): GadgetRuntimeSnapshot {
  return useSyncExternalStore(
    GadgetRuntime.subscribe,
    GadgetRuntime.getSnapshot,
    GadgetRuntime.getSnapshot,
  );
}

/** Keep the runtime's equipped mirror in sync with inventory equips. */
export function useSyncRuntimeEquipped() {
  const { equipped } = useGadgetInventory();
  useEffect(() => {
    GadgetRuntime.setEquipped(equipped);
  }, [equipped]);
}
