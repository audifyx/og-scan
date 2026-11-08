/**
 * ScanVault — Scan History Vault (Team E, third batch).
 *
 * Lists every token the user has scanned, each expandable to its scan
 * history timeline (score then vs now, per-scan verdicts, outcome when
 * known). Persistence is localStorage-first via useScanVault — no DB, no
 * API, nothing seeded. Empty state: "No scans yet".
 *
 * Team B integration:
 *   1. In TokenScanner, after a scan completes:
 *        import { recordScan } from "../hooks/useScanVault";
 *        recordScan({ mint, name, symbol, ogScore, riskScore,
 *          bundleRisk, bundledSupplyPct, verdict, outcome, scannedAt: Date.now() });
 *      `outcome` is optional — pass "rugged" / "dead" / "alive" ONLY when
 *      the scan actually knows it; leave it out otherwise.
 *   2. Render <ScanVault /> on a vault route/section, or link to it:
 *        <a href="/intel/vault">Scan history</a>
 *
 * Design (standing user rule): black/white/gold only, high contrast,
 * custom inline SVG icons, no emoji.
 */
import { useState } from "react";
import type { CSSProperties } from "react";
import { relativeTime, scanUrl } from "../hooks/useScanSocial";
import {
  useScanVault,
  type ScanSnapshot,
  type VaultStatus,
  type VaultToken,
} from "../hooks/useScanVault";

const GOLD = "#e8b84a";
const GREEN = "#3dd68c";
const RED = "#ff5c5c";
const PANEL: CSSProperties = {
  background: "#000000",
  border: "1px solid rgba(232, 184, 74, 0.28)",
  borderRadius: "12px",
  padding: "1rem",
  color: "#ffffff",
};
const MUTED: CSSProperties = { color: "#b8b8b8", fontSize: "0.85rem" };
const GOLD_BTN: CSSProperties = {
  background: GOLD,
  color: "#000000",
  border: "none",
  borderRadius: 999,
  padding: "0.45rem 0.9rem",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
};
const GHOST_BTN: CSSProperties = {
  ...GOLD_BTN,
  background: "transparent",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.4)",
};

const STATUS_STYLE: Record<VaultStatus, { color: string; label: string }> = {
  alive: { color: GREEN, label: "Alive" },
  rugged: { color: RED, label: "Rugged" },
  dead: { color: RED, label: "Dead" },
  unknown: { color: "#b8b8b8", label: "Outcome unknown" },
};

function Icon({ d, size = 14 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const ICON_CHEVRON = "M6 9l6 6 6-6";
const ICON_TRASH = "M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6";

function fmtScore(v: number | null | undefined): string {
  return v == null ? "—" : String(v);
}

function deltaLabel(d: number | null): string {
  if (d == null) return "—";
  if (d === 0) return "±0";
  return `${d > 0 ? "+" : ""}${d}`;
}

function SnapshotRow({ snap, first }: { snap: ScanSnapshot; first: boolean }) {
  return (
    <li style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.6rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.85rem" }}>
          {relativeTime(snap.scannedAt)}
        </span>
        <span style={{ ...MUTED, fontSize: "0.8rem" }}>
          {new Date(snap.scannedAt).toLocaleString()}
        </span>
        {first && (
          <span style={{ color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
            First scan
          </span>
        )}
        {snap.outcome && (
          <span style={{
            color: STATUS_STYLE[snap.outcome].color,
            border: `1px solid ${STATUS_STYLE[snap.outcome].color}`,
            borderRadius: 999, padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700,
          }}>
            {STATUS_STYLE[snap.outcome].label}
          </span>
        )}
      </div>
      <p style={{ margin: "0.3rem 0 0", color: "#ffffff", fontSize: "0.85rem" }}>
        OG {fmtScore(snap.ogScore)}/100 · Risk {fmtScore(snap.riskScore)}/100
        {snap.bundledSupplyPct != null ? ` · ${snap.bundledSupplyPct.toFixed(1)}% bundled` : ""}
        {snap.bundleRisk ? ` · bundle ${snap.bundleRisk}` : ""}
      </p>
      {snap.verdict && <p style={{ ...MUTED, margin: "0.2rem 0 0", fontSize: "0.8rem" }}>{snap.verdict}</p>}
    </li>
  );
}

export interface ScanVaultProps {
  /** Optional controlled list (defaults to the local vault via useScanVault). */
  tokens?: VaultToken[];
  /** Called when the user taps a token (defaults to the scanner link). */
  onOpenScan?: (mint: string) => void;
}

/** Vault view: token list, each expandable to its scan timeline. */
export function ScanVault({ tokens: controlled, onOpenScan }: ScanVaultProps) {
  const vault = useScanVault();
  const tokens = controlled ?? vault.tokens;
  const totalScans = controlled
    ? controlled.reduce((n, t) => n + t.scanCount, 0)
    : vault.totalScans;
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div style={PANEL} data-testid="scan-vault">
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <h3 style={{ color: GOLD, fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Scan history vault</h3>
        <span style={MUTED}>
          {tokens.length} token{tokens.length === 1 ? "" : "s"} · {totalScans} scan{totalScans === 1 ? "" : "s"} · this device only
        </span>
        {tokens.length > 0 && !controlled && (
          <button
            type="button"
            onClick={() => {
              if (confirmClear) {
                vault.clear();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
                window.setTimeout(() => setConfirmClear(false), 4000);
              }
            }}
            style={{ ...GHOST_BTN, marginLeft: "auto", color: RED, borderColor: "rgba(255,92,92,0.5)" }}
          >
            {confirmClear ? "Tap again to clear all" : "Clear vault"}
          </button>
        )}
      </div>
      <p style={{ ...MUTED, margin: "0.5rem 0 0.75rem" }}>
        Every token you scanned, with each scan kept — score then vs now.
        Outcome shows only when a later scan actually knows it; otherwise
        it says unknown, never guessed.
      </p>

      {tokens.length === 0 ? (
        <p style={{ ...MUTED, margin: 0 }}>No scans yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
          {tokens.map((t) => {
            const st = STATUS_STYLE[t.status];
            const expanded = open === t.mint;
            const delta = t.scoreDelta;
            return (
              <li key={t.mint} style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : t.mint)}
                    aria-expanded={expanded}
                    style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.95rem", fontWeight: 800 }}
                  >
                    <Icon d={ICON_CHEVRON} size={14} />
                    {t.symbol ? `$${t.symbol}` : t.mint.slice(0, 4) + "…" + t.mint.slice(-4)}
                  </button>
                  {t.name && t.symbol && <span style={MUTED}>{t.name}</span>}
                  <span style={{
                    color: st.color, border: `1px solid ${st.color}`, borderRadius: 999,
                    padding: "0.05rem 0.5rem", fontSize: "0.7rem", fontWeight: 700,
                  }}>
                    {st.label}
                  </span>
                  <span style={{ marginLeft: "auto", ...MUTED, fontSize: "0.8rem" }}>
                    {t.scanCount} scan{t.scanCount === 1 ? "" : "s"} · last {relativeTime(t.lastScannedAt)}
                  </span>
                </div>

                <p style={{ margin: "0.35rem 0 0", color: "#ffffff", fontSize: "0.9rem" }}>
                  OG {fmtScore(t.first.ogScore)} → {fmtScore(t.latest.ogScore)}
                  {" "}
                  <span style={{ color: delta == null ? "#b8b8b8" : delta >= 0 ? GREEN : RED, fontWeight: 700 }}>
                    ({deltaLabel(delta)})
                  </span>
                  {" · "}Risk {fmtScore(t.latest.riskScore)}/100
                  {t.latest.bundledSupplyPct != null ? ` · ${t.latest.bundledSupplyPct.toFixed(1)}% bundled` : ""}
                </p>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {onOpenScan ? (
                    <button type="button" onClick={() => onOpenScan(t.mint)} style={GOLD_BTN}>Open scan</button>
                  ) : (
                    <a href={scanUrl(t.mint)} style={{ ...GOLD_BTN, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                      Open scan
                    </a>
                  )}
                  {!controlled && (
                    <button
                      type="button"
                      onClick={() => vault.removeToken(t.mint)}
                      aria-label={`Remove ${t.symbol ?? t.mint} from vault`}
                      style={{ ...GHOST_BTN, color: RED, borderColor: "rgba(255,92,92,0.5)" }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                        <Icon d={ICON_TRASH} size={13} /> Remove
                      </span>
                    </button>
                  )}
                </div>

                {expanded && (
                  <ul style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0, display: "grid", gap: "0.6rem" }}>
                    {t.scans.map((s) => (
                      <SnapshotRow key={`${s.scannedAt}-${s.ogScore}`} snap={s} first={s === t.first} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
