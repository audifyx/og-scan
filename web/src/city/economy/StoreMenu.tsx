/**
 * OrbitX City downtown — generic parody-store ordering.
 *
 * Same pattern as RamenOrder: pay real ORBITX via burnPurchase() (canonical
 * buy-and-burn → orbitx_app_burn → createBurnInstruction → signed send),
 * get a 60s buff (speed / glow) or instant CITY points. Receipt on every
 * order. Wallet not connected → "Connect your wallet to order."
 *
 * Opened from the HUD ORDER button when the player is inside a store POI,
 * or programmatically via openStoreMenu(storeKey) from
 * ./storeMenuBus (the NPC worker TALK hook).
 */
import { useState } from "react";
import { X, Zap, Sparkles, Clover, Store } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { burnPurchase, burnReason } from "@/tokenomics/burnFlow";
import { useCityWallet } from "./useCityWallet";
import ReceiptModal, { type ReceiptRow } from "./ReceiptModal";
import { addCityPoints } from "../cityState";
import "./economy.css";

export type StoreKey = "mcorbits" | "burgerkhan" | "wendas" | "pizzashack" | "coffeeshop";
export type StoreBuff = "speed" | "glow" | "lucky";

interface StoreItem {
  id: string;
  name: string;
  desc: string;
  price: number; // whole ORBITX burned
  buff: StoreBuff;
  icon: typeof Zap;
}

export interface StoreMenuDef {
  key: StoreKey;
  /** Must match the CityWorld BUILDINGS label for the POI. */
  label: string;
  tagline: string;
  items: StoreItem[];
}

export const STORE_MENUS: Record<StoreKey, StoreMenuDef> = {
  mcorbits: {
    key: "mcorbits",
    label: "McOrbit's",
    tagline: "Real ORBITX burns · buffs last 60s",
    items: [
      { id: "mcorbits-speed", name: "Big Orbit Burger", desc: "+35% move speed for 60s", price: 30, buff: "speed", icon: Zap },
      { id: "mcorbits-glow", name: "McFry Basket", desc: "Cyan glow trail for 60s", price: 20, buff: "glow", icon: Sparkles },
      { id: "mcorbits-lucky", name: "Lucky Nuggets", desc: "+50 CITY points, instant", price: 50, buff: "lucky", icon: Clover },
    ],
  },
  burgerkhan: {
    key: "burgerkhan",
    label: "Burger Khan",
    tagline: "Flame-grilled · real ORBITX burns",
    items: [
      { id: "burgerkhan-speed", name: "Khan Burger", desc: "+35% move speed for 60s", price: 30, buff: "speed", icon: Zap },
      { id: "burgerkhan-glow", name: "Flame Fries", desc: "Cyan glow trail for 60s", price: 20, buff: "glow", icon: Sparkles },
      { id: "burgerkhan-lucky", name: "Golden Crown Shake", desc: "+50 CITY points, instant", price: 50, buff: "lucky", icon: Clover },
    ],
  },
  wendas: {
    key: "wendas",
    label: "Wenda's",
    tagline: "Fresh, never frozen orbits",
    items: [
      { id: "wendas-speed", name: "Frosty Orbit", desc: "+35% move speed for 60s", price: 30, buff: "speed", icon: Zap },
      { id: "wendas-glow", name: "Square Patty Melt", desc: "Cyan glow trail for 60s", price: 20, buff: "glow", icon: Sparkles },
      { id: "wendas-lucky", name: "Chili Cheese Luck", desc: "+50 CITY points, instant", price: 50, buff: "lucky", icon: Clover },
    ],
  },
  pizzashack: {
    key: "pizzashack",
    label: "Pizza Orbit",
    tagline: "Wood-fired moon pies",
    items: [
      { id: "pizzashack-speed", name: "Moon Cheese Slice", desc: "+35% move speed for 60s", price: 30, buff: "speed", icon: Zap },
      { id: "pizzashack-glow", name: "Pepperoni Comet", desc: "Cyan glow trail for 60s", price: 20, buff: "glow", icon: Sparkles },
      { id: "pizzashack-lucky", name: "Lucky Calzone", desc: "+50 CITY points, instant", price: 50, buff: "lucky", icon: Clover },
    ],
  },
  coffeeshop: {
    key: "coffeeshop",
    label: "Moonbux",
    tagline: "Lunar-roast coffee",
    items: [
      { id: "coffeeshop-speed", name: "Lunar Latte", desc: "+35% move speed for 60s", price: 30, buff: "speed", icon: Zap },
      { id: "coffeeshop-glow", name: "Starlight Cold Brew", desc: "Cyan glow trail for 60s", price: 20, buff: "glow", icon: Sparkles },
      { id: "coffeeshop-lucky", name: "Golden Bean Jackpot", desc: "+50 CITY points, instant", price: 50, buff: "lucky", icon: Clover },
    ],
  },
};

const LABEL_TO_KEY: Record<string, StoreKey> = Object.fromEntries(
  Object.values(STORE_MENUS).map((m) => [m.label, m.key]),
) as Record<string, StoreKey>;

/** Map a HUD insidePoi label → store key (null when not inside an orderable store). */
export function storeKeyForLabel(label: string | null | undefined): StoreKey | null {
  if (!label) return null;
  return LABEL_TO_KEY[label] ?? null;
}

export function isStoreKey(k: string): k is StoreKey {
  return k in STORE_MENUS;
}

export default function StoreMenu({
  storeKey,
  onClose,
  onBuff,
}: {
  storeKey: StoreKey;
  onClose: () => void;
  onBuff: (buff: StoreBuff) => void;
}) {
  const menu = STORE_MENUS[storeKey];
  const billing = useOrbitxBilling();
  const wallet = useCityWallet();
  const [ordering, setOrdering] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ signature: string; rows: ReceiptRow[]; item: StoreItem } | null>(null);

  async function order(item: StoreItem) {
    if (ordering || !wallet.connected) return;
    setError(null);
    setOrdering(item.id);
    try {
      const res = await burnPurchase(billing, {
        amount: item.price,
        itemId: item.id,
        label: `${item.name} — ${menu.label}`,
        reason: burnReason("stores", "order", item.id),
        module: "stores",
      });
      if (res.ok && !res.dryRun) {
        if (item.buff === "lucky") addCityPoints(50);
        else onBuff(item.buff);
        setReceipt({
          signature: res.signature,
          item,
          rows: [
            { label: "Store", value: menu.label },
            { label: "Item", value: item.name },
            { label: "Burned", value: `${item.price} ORBITX` },
            { label: "Effect", value: item.desc },
          ],
        });
      } else if (res.ok && res.dryRun) {
        setError("Verification mode is on — no real burn was made.");
      } else {
        setError(res.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed.");
    } finally {
      setOrdering(null);
    }
  }

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label={menu.label}>
      <div className="oxe-sheet">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <Store className="oxe-ic" />
            <div>
              <div className="oxe-t1">{menu.label.toUpperCase()}</div>
              <div className="oxe-t2">{menu.tagline}</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label={`Close ${menu.label} menu`}>
            <X />
          </button>
        </div>

        {!wallet.connected && (
          <p className="oxe-err">Connect your wallet to order.</p>
        )}
        {menu.items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="oxe-arcade-row oxe-menu-row">
              <span><Icon size={15} /> <b>{item.name}</b><br /><small className="dim">{item.desc}</small></span>
              <button
                className="oxe-btn oxe-btn-primary"
                disabled={!wallet.connected || ordering !== null}
                onClick={() => order(item)}
              >
                {ordering === item.id ? "…" : `${item.price} ORX`}
              </button>
            </div>
          );
        })}
        {error && <p className="oxe-err">{error}</p>}
      </div>
      {receipt && (
        <ReceiptModal
          title={`${receipt.item.name} served`}
          subtitle={`Enjoy — ${menu.label}`}
          rows={receipt.rows}
          signature={receipt.signature}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
