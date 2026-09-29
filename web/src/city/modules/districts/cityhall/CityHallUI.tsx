/**
 * City hall in-person UI: pay fines, register firms, run for mayor / vote.
 * Paper-CITY actions work now; premium firm registration gates on
 * billing.state ("live" once the tokenomics useOrbitxBilling hook lands).
 * Mobile-friendly bottom sheet.
 */
import { useEffect, useState } from "react";
import type { FirmRecord, MayorCandidate } from "../types";
import type { DistrictsBilling } from "../billing";
import { premiumPriceLabel } from "../billing";
import {
  listFines, payFine, payAllFines, unpaidFinesTotal,
  listFirms, registerFirm, registerFirmPremium,
  listCandidates, registerCandidacy, voteForMayor, currentMayor, mayorTermEnds,
  FIRM_COST_CITY, FIRM_COST_PREMIUM_ORBITX, VOTE_COST_CITY, CANDIDACY_COST_CITY,
} from "./CityHall";
import { paperWallet } from "../paper/PaperWallet";

interface Props {
  open: boolean;
  onClose: () => void;
  billing: DistrictsBilling;
  /** Player display name used as firm owner / candidate name. */
  owner: string;
}

type Tab = "fines" | "firms" | "mayor";

export default function CityHallUI({ open, onClose, billing, owner }: Props) {
  const [tab, setTab] = useState<Tab>("fines");
  const [city, setCity] = useState(0);
  const [fines, setFines] = useState(() => listFines());
  const [firms, setFirms] = useState<FirmRecord[]>(() => listFirms());
  const [candidates, setCandidates] = useState<MayorCandidate[]>(() => listCandidates());
  const [firmName, setFirmName] = useState("");
  const [platform, setPlatform] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCity(paperWallet.city);
    setFines(listFines());
    setFirms(listFirms());
    setCandidates(listCandidates());
    setMsg(null);
    return paperWallet.subscribe(() => setCity(paperWallet.city));
  }, [open]);

  if (!open) return null;

  const refresh = () => {
    setFines(listFines());
    setFirms(listFirms());
    setCandidates(listCandidates());
    setCity(paperWallet.city);
  };

  const unpaid = unpaidFinesTotal();
  const mayor = currentMayor();
  const running = candidates.some((c) => c.name.toLowerCase() === owner.trim().toLowerCase());

  const regStandard = () => {
    const r = registerFirm(firmName, owner);
    setMsg(r.message);
    if (r.ok) setFirmName("");
    refresh();
  };
  const regPremium = async () => {
    try {
      const r = await registerFirmPremium(firmName, owner, billing);
      setMsg(r.message);
      if (r.ok) setFirmName("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Premium registration failed.");
    }
    refresh();
  };
  const run = () => {
    const r = registerCandidacy(owner, platform);
    setMsg(r.message);
    if (r.ok) setPlatform("");
    refresh();
  };
  const vote = (id: string) => {
    const r = voteForMayor(id);
    setMsg(r.message);
    refresh();
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#f5c518" }}>🏛 ORBITX CITY HALL</div>
          <button onClick={onClose} style={btn}>✕</button>
        </div>
        <div style={{ margin: "8px 0", fontSize: 13 }}>
          Paper CITY: <b style={{ color: "#f5c518" }}>{Math.floor(city).toLocaleString()}</b>
          {" · "}Mayor: <b>{mayor ? mayor.name : "—"}</b>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["fines", "firms", "mayor"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                ...btn, flex: 1, padding: 10, textTransform: "uppercase", fontWeight: 800,
                background: tab === t ? "#3a2f16" : "#1a222c",
                borderColor: tab === t ? "#f5c518" : "#2a3542",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "fines" && (
          <div>
            <div style={row}>
              <div><b>Unpaid fines</b><br /><span style={dim}>{unpaid} paper CITY</span></div>
              <button
                onClick={() => { const r = payAllFines(); setMsg(r.message); refresh(); }}
                disabled={unpaid === 0}
                style={btn}
              >
                Pay all
              </button>
            </div>
            {fines.filter((f) => !f.paid).map((f) => (
              <div key={f.id} style={row}>
                <div><b>{f.reason}</b><br /><span style={dim}>{f.amountCity} CITY · {new Date(f.issuedAt).toLocaleDateString()}</span></div>
                <button onClick={() => { const r = payFine(f.id); setMsg(r.message); refresh(); }} style={btn}>Pay</button>
              </div>
            ))}
            {unpaid === 0 && <div style={{ ...dim, padding: 12, textAlign: "center" }}>No unpaid fines. Model citizen.</div>}
          </div>
        )}

        {tab === "firms" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="Firm name…"
                maxLength={40}
                style={{ ...field, flex: 1 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={regStandard} style={{ ...btn, flex: 1 }}>
                Register · {FIRM_COST_CITY} CITY
              </button>
              <button
                onClick={regPremium}
                disabled={billing.state !== "live"}
                style={{ ...btn, flex: 1 }}
                title={premiumPriceLabel(FIRM_COST_PREMIUM_ORBITX, billing)}
              >
                Premium · {premiumPriceLabel(FIRM_COST_PREMIUM_ORBITX, billing)}
              </button>
            </div>
            {firms.map((f) => (
              <div key={f.id} style={row}>
                <div>
                  <b>{f.name}</b>{" "}
                  <span style={{ ...dim, fontSize: 11 }}>
                    {f.tier === "premium" ? "◆ premium" : "standard"} · {f.owner}
                  </span>
                </div>
              </div>
            ))}
            {firms.length === 0 && <div style={{ ...dim, padding: 12, textAlign: "center" }}>No firms registered yet.</div>}
          </div>
        )}

        {tab === "mayor" && (
          <div>
            <div style={{ ...dim, fontSize: 12, marginBottom: 8 }}>
              Term ends {new Date(mayorTermEnds()).toLocaleDateString()} · vote costs {VOTE_COST_CITY} CITY (anti-spam)
            </div>
            {[...candidates].sort((a, b) => b.votes - a.votes).map((c) => (
              <div key={c.id} style={row}>
                <div>
                  <b>{c.name}</b> <span style={{ color: "#f5c518" }}>({c.votes} votes)</span><br />
                  <span style={dim}>{c.platform}</span>
                </div>
                <button onClick={() => vote(c.id)} style={btn}>Vote</button>
              </div>
            ))}
            {!running && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>RUN FOR MAYOR · {CANDIDACY_COST_CITY} CITY</div>
                <input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="Your platform (140 chars)…"
                  maxLength={140}
                  style={{ ...field, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
                />
                <button onClick={run} style={{ ...btn, width: "100%", padding: 12 }}>
                  Declare candidacy as {owner || "player"}
                </button>
              </div>
            )}
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 10, padding: 8, background: "#171410", borderRadius: 6, fontSize: 13 }}>
            {msg}
          </div>
        )}
        <div style={{ ...dim, marginTop: 10, fontSize: 11 }}>
          Election state is a local prototype until a shared backend lands. Premium firm registration burns real ORBITX once billing is live.
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
  width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto",
  background: "#0e1116", color: "#e8eef5", borderTop: "2px solid #f5c518",
  borderRadius: "14px 14px 0 0", padding: 16, fontFamily: "monospace",
};
const btn: React.CSSProperties = {
  background: "#1a222c", color: "#e8eef5", border: "1px solid #2a3542",
  borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 700,
};
const row: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "10px 0", borderBottom: "1px solid #1a222c", fontSize: 13, gap: 8,
};
const field: React.CSSProperties = {
  background: "#141b24", color: "#e8eef5", border: "1px solid #2a3542",
  borderRadius: 8, padding: "10px 12px", fontFamily: "monospace",
};
const dim: React.CSSProperties = { opacity: 0.6 };
