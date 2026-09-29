/**
 * Builds board (#19) — community projects, with burn-to-feature.
 *
 * No dedicated board page exists yet, so the board lives here as a
 * mountable panel (DevPortal hosts it for now). Featuring burns ORBITX;
 * featured projects sort first.
 */
import { useState } from "react";
import { useOrbitxBilling } from "../useOrbitxBilling";
import { BurnButton, BillingBanner } from "./BurnButton";
import { ORBITX_PRICES, formatOrbitx, spendReason } from "../constants";

type BuildProject = {
  id: string;
  name: string;
  blurb: string;
  url?: string;
  featured: boolean;
  featureSig?: string;
  at: number;
};

const BUILDS_KEY = "orbitx.billing.builds.v1";

const SEED: BuildProject[] = [
  { id: "build-orbitx", name: "OrbitX", blurb: "Solana trading terminal + Agent MCP.", url: "https://www.orbitx.world", featured: true, at: Date.now() },
  { id: "build-agentverse", name: "AgentVerse", blurb: "Twitter-style world run 100% by AI agents.", url: "https://agentverse-theta.vercel.app", featured: false, at: Date.now() },
  { id: "build-habla", name: "Habla", blurb: "Voice Spanish tutor.", featured: false, at: Date.now() },
];

function readBuilds(): BuildProject[] {
  try {
    const raw = localStorage.getItem(BUILDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) && arr.length ? arr : SEED;
  } catch {
    return SEED;
  }
}

function writeBuilds(list: BuildProject[]): void {
  try {
    localStorage.setItem(BUILDS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function BuildsBoard(): JSX.Element {
  const { ready } = useOrbitxBilling();
  const [builds, setBuilds] = useState<BuildProject[]>(() => readBuilds());
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [url, setUrl] = useState("");

  const sorted = [...builds].sort((a, b) =>
    a.featured === b.featured ? b.at - a.at : a.featured ? -1 : 1,
  );

  const submit = () => {
    if (!name.trim()) return;
    const next = [
      { id: `bld-${Date.now()}`, name: name.trim(), blurb: blurb.trim(), url: url.trim() || undefined, featured: false, at: Date.now() },
      ...readBuilds(),
    ];
    writeBuilds(next);
    setBuilds(next);
    setName("");
    setBlurb("");
    setUrl("");
  };

  const feature = (id: string, signature: string) => {
    const next = readBuilds().map((b) =>
      b.id === id ? { ...b, featured: true, featureSig: signature } : b,
    );
    writeBuilds(next);
    setBuilds(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BillingBanner compact />
      <div style={{ border: "1px solid #374151", borderRadius: 12, padding: 14, background: "#0b0f16" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Showcase your build</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff", minWidth: 160 }} />
          <input value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="One-line blurb"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff", flex: 1, minWidth: 200 }} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #374151", background: "#030712", color: "#fff", minWidth: 160 }} />
          <button type="button" onClick={submit} disabled={!name.trim()}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Add project
          </button>
        </div>
      </div>
      {sorted.map((b) => (
        <div key={b.id} style={{ border: b.featured ? "1px solid #f59e0b66" : "1px solid #1f2937", borderRadius: 10, padding: 12, background: "#0b0f16" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <span style={{ fontWeight: 700 }}>{b.featured ? "⭐ " : ""}{b.name}</span>
              {b.url ? (
                <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#60a5fa", marginLeft: 8 }}>
                  Visit ↗
                </a>
              ) : null}
            </div>
            {!b.featured ? (
              <BurnButton
                amount={ORBITX_PRICES.buildsFeature}
                reason={spendReason.buildsFeature(b.id)}
                label={`Feature — ${formatOrbitx(ORBITX_PRICES.buildsFeature)}`}
                disabled={!ready}
                onDone={(sig) => feature(b.id, sig)}
              />
            ) : (
              <span style={{ fontSize: 12, color: "#fbbf24" }}>Featured</span>
            )}
          </div>
          {b.blurb ? <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{b.blurb}</div> : null}
        </div>
      ))}
    </div>
  );
}
