/**
 * OrbitXCity — Events module: MarketPanel (the `marketPanels` mount point).
 *
 * Self-contained modal for the two nighttime markets:
 *
 *  - "night" → the pop-up night market: tonight's rotating spot, the
 *    stocked rare-cosmetics catalog, CITY or ORBITX prices.
 *  - "black" → the dock black market: rotating code-word gate first
 *    (the fixer NPC hands out tonight's code), then the rare-gadget
 *    catalog.
 *
 * Purchases honor the billing contract (BILLING_CONTRACT.md):
 * paper-CITY items debit the injected paper wallet; ORBITX items burn
 * through the injected billing provider. With no billing provider the
 * ORBITX rows render an honest "wallet auth required" state — never a
 * broken buy button, and NOTHING imports `@/tokenomics/*`.
 *
 * Mobile: bottom-sheet layout, 48px+ touch targets, `dvh` sizing.
 */

import { useState } from "react";
import type { EventsSystem } from "../system";
import { useEventsSnapshot } from "./useEventsSnapshot";
import { buyMarketItem, type MarketItem } from "../scenes/nightMarket";
import { buyBlackMarketItem } from "../scenes/blackMarket";

export interface MarketPanelProps {
  system: EventsSystem;
  mode: "night" | "black";
  onClose: () => void;
}

const RARITY_COLOR: Record<MarketItem["rarity"], string> = {
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export function MarketPanel({ system, mode, onClose }: MarketPanelProps) {
  const snap = useEventsSnapshot(system);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  const stock =
    mode === "night" ? snap.nightMarket.stock : system.getBlackMarketStock();
  const purchaseCtx = system.getPurchaseContext();
  const billingReady = purchaseCtx.billing?.ready === true;

  const heading =
    mode === "night"
      ? `🌙 Night Market${snap.nightMarket.spot ? ` — ${snap.nightMarket.spot.label}` : ""}`
      : "🕶️ Dock Black Market — Pier 9";

  function tryCode() {
    if (system.checkMarketCode(code)) {
      setUnlocked(true);
      setCodeError(null);
    } else {
      setCodeError("Wrong code. The fixer NPC knows tonight's word.");
    }
  }

  async function buy(item: MarketItem) {
    if (buying) return;
    setBuying(item.id);
    setStatus((s) => ({ ...s, [item.id]: "…" }));
    try {
      const res =
        mode === "night"
          ? await buyMarketItem(item, purchaseCtx)
          : await buyBlackMarketItem(item, purchaseCtx);
      setStatus((s) => ({ ...s, [item.id]: res.message }));
    } catch {
      setStatus((s) => ({ ...s, [item.id]: "Purchase failed — nothing was charged." }));
    } finally {
      setBuying(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100vw, 520px)",
          maxHeight: "82dvh",
          overflowY: "auto",
          background: "#0d0f16",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          padding: "18px 18px max(18px, env(safe-area-inset-bottom))",
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{heading}</div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        {mode === "black" && !unlocked && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "#d1d5db" }}>
              This market doesn't exist. Give the fixer tonight's code word to get in.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="code word"
                autoCapitalize="none"
                autoCorrect="off"
                style={{
                  flex: 1,
                  background: "#151824",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: "12px 14px",
                  color: "#fff",
                  fontSize: 15,
                  minHeight: 48,
                }}
              />
              <button type="button" onClick={tryCode} style={buyBtn}>
                ENTER
              </button>
            </div>
            {codeError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{codeError}</div>}
          </div>
        )}

        {(mode === "night" || unlocked) && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {stock.length === 0 && (
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                Nothing stocked tonight — check back tomorrow.
              </div>
            )}
            {stock.map((item) => {
              const isOrbitx = item.currency === "ORBITX";
              const blocked = isOrbitx && !billingReady;
              return (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "#151824",
                    border: `1px solid ${RARITY_COLOR[item.rarity]}55`,
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 30 }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {item.label}{" "}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: RARITY_COLOR[item.rarity],
                          border: `1px solid ${RARITY_COLOR[item.rarity]}`,
                          borderRadius: 6,
                          padding: "1px 6px",
                          marginLeft: 6,
                          textTransform: "uppercase",
                        }}
                      >
                        {item.rarity}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{item.description}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: isOrbitx ? "#fbbf24" : "#34d399" }}>
                      {isOrbitx ? `🔥 ${item.price} ORBITX (burned)` : `💵 ${item.price.toLocaleString()} CITY`}
                    </div>
                    {status[item.id] && status[item.id] !== "…" && (
                      <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 4 }}>{status[item.id]}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={blocked || buying === item.id}
                    onClick={() => buy(item)}
                    style={{
                      ...buyBtn,
                      opacity: blocked || buying === item.id ? 0.45 : 1,
                      cursor: blocked || buying === item.id ? "not-allowed" : "pointer",
                    }}
                    title={blocked ? "ORBITX checkout needs wallet auth — coming soon" : undefined}
                  >
                    {buying === item.id ? "…" : blocked ? "AUTH?" : "BUY"}
                  </button>
                </div>
              );
            })}
            {!billingReady && (
              <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 4 }}>
                🔥 ORBITX items need wallet auth (burns are backend-signed, no popups).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const closeBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "none",
  borderRadius: 12,
  width: 44,
  height: 44,
  color: "#fff",
  fontSize: 16,
  cursor: "pointer",
};

const buyBtn: React.CSSProperties = {
  background: "#7c3aed",
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  minHeight: 48,
  cursor: "pointer",
};
