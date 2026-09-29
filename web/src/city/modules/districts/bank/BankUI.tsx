/**
 * ORBITX Bank in-person UI: paper-CITY balance, live ORBITX quote,
 * safe-deposit boxes (paper CITY) and vault membership (real ORBITX burn
 * through the injected billing — the integrator wires it to the
 * cityPorts burn adapter; dry-run safe, never on-chain from here).
 * Mobile-friendly bottom sheet.
 */
import { useEffect, useState } from "react";
import type { TokenQuote } from "../types";
import type { DistrictsBilling } from "../billing";
import { premiumPriceLabel } from "../billing";
import {
  VAULT_COST_ORBITX, VAULT_BURN_REASON, SAFE_BOX_COST_CITY,
  getBankState, buySafeBox, markVaultMember,
} from "./Bank";
import { paperWallet } from "../paper/PaperWallet";

interface Props {
  open: boolean;
  onClose: () => void;
  billing: DistrictsBilling;
  quotes: TokenQuote[];
}

export default function BankUI({ open, onClose, billing, quotes }: Props) {
  const [city, setCity] = useState(0);
  const [vaultMember, setVaultMember] = useState(false);
  const [boxes, setBoxes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const s = getBankState();
    setVaultMember(s.vaultMember);
    setBoxes(s.boxes);
    setCity(paperWallet.city);
    setMsg(null);
    return paperWallet.subscribe(() => setCity(paperWallet.city));
  }, [open ]);

  if (!open) return null;

  const orbitx = quotes.find((q) => q.symbol === "ORBITX");
  const live = billing.state === "live";

  const buyBox = () => {
    const r = buySafeBox();
    setMsg(r.message);
    if (r.ok) setBoxes(getBankState().boxes);
    setCity(paperWallet.city);
  };

  const buyVault = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { signature } = await billing.spendPremium({
        amount: VAULT_COST_ORBITX,
        reason: VAULT_BURN_REASON,
      });
      markVaultMember();
      setVaultMember(true);
      setMsg(`Vault membership active — burn ${signature.slice(0, 12)}… confirmed.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Vault purchase failed — nothing was charged.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={sheet} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🏦 ORBITX Bank</div>
          <button type="button" onClick={onClose} style={xBtn} aria-label="Close">✕</button>
        </div>

        <div style={row}>
          <div style={stat}><div style={statV}>{Math.floor(city).toLocaleString()}</div><div style={statL}>paper CITY</div></div>
          <div style={stat}>
            <div style={statV}>{orbitx && orbitx.price > 0 ? `$${orbitx.price < 1 ? orbitx.price.toFixed(5) : orbitx.price.toFixed(2)}` : "—"}</div>
            <div style={statL}>ORBITX · live</div>
          </div>
          <div style={stat}><div style={statV}>{boxes}</div><div style={statL}>safe boxes</div></div>
        </div>

        <div style={sec}>
          <div style={secT}>Safe-deposit box</div>
          <div style={secD}>Your own box in the vault. Paper CITY only — no chain.</div>
          <button type="button" onClick={buyBox} style={buyBtn}>BUY · {SAFE_BOX_COST_CITY} CITY</button>
        </div>

        <div style={sec}>
          <div style={secT}>Vault membership {vaultMember && <span style={tag}>ACTIVE</span>}</div>
          <div style={secD}>Priority teller lane + your name on the vault wall. Burns real ORBITX.</div>
          <button
            type="button"
            onClick={buyVault}
            disabled={vaultMember || busy || !live}
            style={{ ...buyBtn, opacity: vaultMember || busy || !live ? 0.45 : 1 }}
            title={!live ? "ORBITX checkout needs wallet auth" : undefined}
          >
            {busy ? "…" : vaultMember ? "MEMBER" : `JOIN · ${premiumPriceLabel(VAULT_COST_ORBITX, billing)}`}
          </button>
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
const row: React.CSSProperties = { display: "flex", gap: 10, marginTop: 14 };
const stat: React.CSSProperties = {
  flex: 1, background: "#151824", borderRadius: 12, padding: "10px 12px", textAlign: "center",
};
const statV: React.CSSProperties = { fontSize: 16, fontWeight: 800 };
const statL: React.CSSProperties = { fontSize: 11, color: "#9ca3af", marginTop: 2 };
const sec: React.CSSProperties = {
  marginTop: 12, background: "#151824", borderRadius: 14, padding: 14,
  border: "1px solid rgba(245,197,24,0.25)",
};
const secT: React.CSSProperties = { fontWeight: 800, fontSize: 14 };
const secD: React.CSSProperties = { fontSize: 12, color: "#9ca3af", marginTop: 4 };
const tag: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: "#22ff88", border: "1px solid #22ff88",
  borderRadius: 6, padding: "1px 6px", marginLeft: 6,
};
const buyBtn: React.CSSProperties = {
  marginTop: 10, background: "#7c3aed", border: "none", borderRadius: 12,
  padding: "12px 18px", color: "#fff", fontSize: 14, fontWeight: 800,
  minHeight: 48, cursor: "pointer", width: "100%",
};
const msgStyle: React.CSSProperties = { fontSize: 13, color: "#d1d5db", marginTop: 12, textAlign: "center" };
