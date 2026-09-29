/**
 * In-game hospital billing UI: pay treatment bills + clear wanted level.
 * Paper CITY path always works; premium ORBITX path gates on billing.state.
 */
import { useEffect, useState } from "react";
import type { WantedProvider } from "../types";
import type { DistrictsBilling } from "../billing";
import { premiumPriceLabel } from "../billing";
import {
  clearWantedPaper, clearWantedPremium,
  WANTED_CLEAR_COST_PER_STAR, EXPEDITED_WIPE_COST_ORBITX,
} from "./Hospital";
import { paperWallet } from "../paper/PaperWallet";

interface Props {
  open: boolean;
  onClose: () => void;
  wanted: WantedProvider;
  billing: DistrictsBilling;
  pendingBill?: number;
}

export default function HospitalBilling({ open, onClose, wanted, billing, pendingBill = 0 }: Props) {
  const [stars, setStars] = useState(0);
  const [city, setCity] = useState(paperWallet.city);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStars(wanted.getStars());
    setCity(paperWallet.city);
    setMsg(null);
    return paperWallet.subscribe(() => setCity(paperWallet.city));
  }, [open, wanted]);

  if (!open) return null;

  const payPaper = () => {
    const r = clearWantedPaper(wanted);
    setMsg(r.message);
    setStars(wanted.getStars());
    setCity(paperWallet.city);
  };
  const payPremium = async () => {
    try {
      const r = await clearWantedPremium(wanted, billing);
      setMsg(r.message);
      setStars(wanted.getStars());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Premium wipe failed.");
    }
  };
  const settleBill = () => {
    paperWallet.adjustCity(-Math.min(pendingBill, paperWallet.city));
    setMsg(`Treatment bill of ${pendingBill} paper CITY settled. Feel better.`);
    setCity(paperWallet.city);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#ff6b6b" }}>🏥 ORBITX GENERAL · BILLING</div>
          <button onClick={onClose} style={btn}>✕</button>
        </div>
        <div style={{ margin: "8px 0", fontSize: 13 }}>
          Paper CITY: <b style={{ color: "#f5c518" }}>{Math.floor(city).toLocaleString()}</b>
          {" · "}Wanted: <b style={{ color: stars > 0 ? "#ff4455" : "#22ff88" }}>
            {stars > 0 ? "★".repeat(stars) : "clean"}
          </b>
        </div>

        {pendingBill > 0 && (
          <div style={row}>
            <div><b>Treatment bill</b><br /><span style={dim}>{pendingBill} paper CITY</span></div>
            <button onClick={settleBill} style={btn}>Settle</button>
          </div>
        )}

        <div style={row}>
          <div>
            <b>Clear wanted record</b><br />
            <span style={dim}>{stars > 0 ? `${stars * WANTED_CLEAR_COST_PER_STAR} paper CITY` : "Nothing on your record"}</span>
          </div>
          <button onClick={payPaper} disabled={stars === 0} style={btn}>Pay bill</button>
        </div>

        <div style={row}>
          <div>
            <b>Expedited record wipe</b><br />
            <span style={dim}>{premiumPriceLabel(EXPEDITED_WIPE_COST_ORBITX, billing)} · instant, no questions</span>
          </div>
          <button onClick={payPremium} disabled={stars === 0 || billing.state !== "live"} style={btn}>
            {billing.state === "live" ? "Wipe" : "Soon"}
          </button>
        </div>

        {msg && <div style={{ marginTop: 10, padding: 8, background: "#1a1214", borderRadius: 6, fontSize: 13 }}>{msg}</div>}
        <div style={{ ...dim, marginTop: 10, fontSize: 11 }}>
          Premium wipes burn real ORBITX once tokenomics billing is live.
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 60, display: "flex",
  alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.55)",
};
const panel: React.CSSProperties = {
  width: "min(520px, 100%)", maxHeight: "88vh", overflowY: "auto",
  background: "#0e1116", color: "#e8eef5", borderTop: "2px solid #ff6b6b",
  borderRadius: "14px 14px 0 0", padding: 16, fontFamily: "monospace",
};
const btn: React.CSSProperties = {
  background: "#1a222c", color: "#e8eef5", border: "1px solid #2a3542",
  borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700,
};
const row: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 0", borderBottom: "1px solid #1a222c", fontSize: 13,
};
const dim: React.CSSProperties = { opacity: 0.6 };
