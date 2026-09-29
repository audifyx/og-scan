/**
 * OrbitX Motors sales UI: showroom catalog, paper-CITY buys and the
 * ORBITX-burn hypercar trim. Delivery (spawning the drivable) is the
 * integrator's job via `onDeliver`.
 * Mobile-friendly bottom sheet.
 */
import { useEffect, useState } from "react";
import type { DistrictsBilling } from "../billing";
import { premiumPriceLabel } from "../billing";
import {
  SHOWROOM, ownedVehicles, buyVehiclePaper, buyVehiclePremium,
  type ShowroomVehicle,
} from "./Dealership";
import { paperWallet } from "../paper/PaperWallet";

interface Props {
  open: boolean;
  onClose: () => void;
  billing: DistrictsBilling;
  /** Integrator hook: spawn/deliver the purchased drivable (vehicles module). */
  onDeliver?: (vehicleId: string) => void;
}

export default function DealershipUI({ open, onClose, billing, onDeliver }: Props) {
  const [city, setCity] = useState(0);
  const [owned, setOwned] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCity(paperWallet.city);
    setOwned(ownedVehicles());
    setMsg(null);
    return paperWallet.subscribe(() => setCity(paperWallet.city));
  }, [open ]);

  if (!open) return null;

  const refresh = () => {
    setOwned(ownedVehicles());
    setCity(paperWallet.city);
  };

  const buy = async (v: ShowroomVehicle) => {
    if (busy) return;
    setBusy(v.id);
    setMsg(null);
    try {
      const r = v.priceOrbitx > 0
        ? await buyVehiclePremium(v, billing)
        : buyVehiclePaper(v);
      setMsg(r.message);
      if (r.ok) {
        refresh();
        onDeliver?.(v.id);
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
          <div style={{ fontSize: 17, fontWeight: 800 }}>🚗 OrbitX Motors</div>
          <button type="button" onClick={onClose} style={xBtn} aria-label="Close">✕</button>
        </div>
        <div style={bal}>{Math.floor(city).toLocaleString()} paper CITY</div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {SHOWROOM.map((v) => {
            const isOwned = owned.includes(v.id);
            const premium = v.priceOrbitx > 0;
            const blocked = premium && !live;
            return (
              <div key={v.id} style={item}>
                <div style={swatch(v.color)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {v.name} {isOwned && <span style={tag}>GARAGE</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{v.blurb}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, color: premium ? "#fbbf24" : "#34d399" }}>
                    {premium ? `🔥 ${premiumPriceLabel(v.priceOrbitx, billing)} (burned)` : `💵 ${v.priceCity.toLocaleString()} CITY`}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isOwned || busy === v.id || blocked}
                  onClick={() => buy(v)}
                  style={{ ...buyBtn, opacity: isOwned || busy === v.id || blocked ? 0.45 : 1 }}
                  title={blocked ? "ORBITX checkout needs wallet auth" : undefined}
                >
                  {busy === v.id ? "…" : isOwned ? "OWNED" : blocked ? "AUTH?" : "BUY"}
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
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 12, background: "#151824",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 12,
};
const swatch = (color: number): React.CSSProperties => ({
  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
  background: `#${color.toString(16).padStart(6, "0")}`,
  border: "1px solid rgba(255,255,255,0.25)",
});
const tag: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#22e5ff", border: "1px solid #22e5ff",
  borderRadius: 6, padding: "1px 6px", marginLeft: 6,
};
const buyBtn: React.CSSProperties = {
  background: "#7c3aed", border: "none", borderRadius: 12, padding: "12px 18px",
  color: "#fff", fontSize: 14, fontWeight: 800, minHeight: 48, cursor: "pointer",
};
const msgStyle: React.CSSProperties = { fontSize: 13, color: "#d1d5db", marginTop: 12, textAlign: "center" };
