/**
 * OrbitX Market checkout UI: paper-CITY everyday items + ORBITX-burn
 * premium cosmetics. Inventory persists per device.
 * Mobile-friendly bottom sheet.
 */
import { useEffect, useState } from "react";
import type { DistrictsBilling } from "../billing";
import { premiumPriceLabel } from "../billing";
import {
  SHOP_CATALOG, shopInventory, buyShopItemPaper, buyShopItemPremium,
  type ShopItem,
} from "./Shops";
import { paperWallet } from "../paper/PaperWallet";

interface Props {
  open: boolean;
  onClose: () => void;
  billing: DistrictsBilling;
}

export default function ShopsUI({ open, onClose, billing }: Props) {
  const [city, setCity] = useState(0);
  const [inv, setInv] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCity(paperWallet.city);
    setInv(shopInventory());
    setMsg(null);
    return paperWallet.subscribe(() => setCity(paperWallet.city));
  }, [open ]);

  if (!open) return null;

  const buy = async (item: ShopItem) => {
    if (busy) return;
    setBusy(item.id);
    setMsg(null);
    try {
      const r = item.priceOrbitx > 0
        ? await buyShopItemPremium(item, billing)
        : buyShopItemPaper(item);
      setMsg(r.message);
      if (r.ok) {
        setInv(shopInventory());
        setCity(paperWallet.city);
      }
    } finally {
      setBusy(null);
    }
  };

  const live = billing.state === "live";

  return (
    <div style={sheet} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🛒 OrbitX Market</div>
          <button type="button" onClick={onClose} style={xBtn} aria-label="Close">✕</button>
        </div>
        <div style={bal}>{Math.floor(city).toLocaleString()} paper CITY</div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {SHOP_CATALOG.map((item) => {
            const premium = item.priceOrbitx > 0;
            const blocked = premium && !live;
            const count = inv[item.id] ?? 0;
            return (
              <div key={item.id} style={row}>
                <div style={{ fontSize: 30 }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {item.name}
                    {count > 0 && <span style={tag}>×{count}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{item.blurb}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: premium ? "#fbbf24" : "#34d399" }}>
                    {premium ? `🔥 ${premiumPriceLabel(item.priceOrbitx, billing)} (burned)` : `💵 ${item.priceCity.toLocaleString()} CITY`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy === item.id || blocked}
                  onClick={() => buy(item)}
                  style={{ ...buyBtn, opacity: busy === item.id || blocked ? 0.45 : 1 }}
                  title={blocked ? "ORBITX checkout needs wallet auth" : undefined}
                >
                  {busy === item.id ? "…" : blocked ? "AUTH?" : "BUY"}
                </button>
              </div>
            );
          })}
        </div>
        {msg && <div style={msgStyle}>{msg}</div>}
      </div>
    </div>
  );
}

const sheet: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "flex-end", justifyContent: "center",
};
const card: React.CSSProperties = {
  width: "min(100vw, 520px)", maxHeight: "82dvh", overflowY: "auto",
  background: "#0d0f16", borderRadius: "20px 20px 0 0",
  borderTop: "1px solid rgba(255,255,255,0.15)",
  padding: "18px 18px max(18px, env(safe-area-inset-bottom))",
  fontFamily: "system-ui, sans-serif", color: "#fff",
};
const head: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const xBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 12,
  width: 44, height: 44, color: "#fff", fontSize: 16, cursor: "pointer",
};
const bal: React.CSSProperties = { fontSize: 13, color: "#34d399", fontWeight: 700, marginTop: 6 };
const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, background: "#151824",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12,
};
const tag: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#34d399", border: "1px solid #34d399",
  borderRadius: 6, padding: "1px 6px", marginLeft: 6,
};
const buyBtn: React.CSSProperties = {
  background: "#7c3aed", border: "none", borderRadius: 12, padding: "12px 18px",
  color: "#fff", fontSize: 14, fontWeight: 800, minHeight: 48, cursor: "pointer",
};
const msgStyle: React.CSSProperties = { fontSize: 13, color: "#d1d5db", marginTop: 12, textAlign: "center" };
