import type { CSSProperties, ComponentType, ReactNode } from "react";
import { Suspense, lazy, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  HelpCircle,
  Link2,
  MessageCircle,
  Send,
  XCircle,
} from "lucide-react";
import type { DexPair, ForensicsPayload, ResearchPayload, SafetyPayload, TokenPayload, DevWalletIntel } from "../api/client";
import { isValidMint } from "../api/client";
import {
  adaptSourceTrace,
  ageLabel,
  authorityVerdict,
  buildContractDiff,
  bundleRiskVerdict,
  cloneVerdict,
  concentrationBand,
  devWalletVerdict,
  honeypotChecks,
  lpLockState,
  type HolderConviction,
  type OgScore,
  type SourceWalletTrace,
  type TokenDna,
  type VerdictState,
  type WashTrading,
  type WhaleLabel,
} from "../hooks/useTokenIntel";
import type { ComposedRisk } from "../risk/composeRisk";
import { AlertBuilder, SocialPanels } from "./SocialPanels";
import { HolderOverlapGraph, type OverlapWallet } from "./HolderOverlapGraph";
import { BundleVisual } from "@/components/scanner-20x/BundleVisual";
import { ShareToX } from "./ShareToX";
import {
  bundleDecayFromSnapshots,
  diffAuthorities,
  getPriorSnapshot,
  honeypotFlipFromSnapshots,
  loadVault,
  lpDrainFromSnapshots,
  rankVaultByRisk,
} from "../hooks/useScanVault";
import XIntel from "@/components/scanner-20x/XIntel";
import type {
  BundleAnalysis as RawBundleAnalysis,
  BundleCluster,
  ChartPattern,
  ExitLiquidity,
  HolderOverlapEntry,
  RugCheck,
  Token2022Extensions,
  WalletAge,
} from "../bundle";
import type { XIntel as RawXIntel } from "../xintel";

function short(addr?: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function asFinite(n: unknown): number | null {
  const v = typeof n === "number" ? n : typeof n === "string" && n.trim() !== "" ? Number(n) : NaN;
  return Number.isFinite(v) ? v : null;
}

function fmtPct(n: unknown, digits: number): string | null {
  const v = asFinite(n);
  return v == null ? null : `${v.toFixed(digits)}%`;
}

function fmtUsd(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtInt(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtSignedPct(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function fmtTime(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Terminal theme — black / white / gold / silver + Caveat display font. */
export const termPanel: CSSProperties = {
  borderColor: "rgba(232, 184, 74, 0.28)",
  background: "var(--term-bg)",
};

export const termH3: CSSProperties = {
  fontFamily: "var(--term-hand)",
  color: "var(--term-gold)",
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};

const toneColor: Record<VerdictState, string> = {
  pass: "#3dd68c",
  warn: "var(--term-gold)",
  fail: "#ff5c5c",
  unknown: "var(--term-silver-dim)",
};

export function VerdictBadge({ state, label }: { state: VerdictState; label: string }) {
  const Icon =
    state === "pass" ? CheckCircle2 : state === "warn" ? AlertTriangle : state === "fail" ? XCircle : HelpCircle;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        color: toneColor[state],
        border: `1px solid ${toneColor[state]}`,
        borderRadius: 999,
        padding: "0.1rem 0.55rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={13} strokeWidth={2.5} />
      {label}
    </span>
  );
}

export function CheckRow({
  label,
  value,
  state,
  badge,
  hint,
}: {
  label: string;
  value: ReactNode;
  state?: VerdictState;
  badge?: string;
  hint?: string;
}) {
  return (
    <div className="oxc-factor">
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</div>
        {hint ? (
          <div className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.15rem" }}>
            {hint}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
        <span style={{ fontSize: "0.85rem", textAlign: "right" }}>{value}</span>
        {state && badge ? <VerdictBadge state={state} label={badge} /> : null}
      </div>
    </div>
  );
}

export function TokenOverview({
  mint,
  token,
  safety,
  forensics,
}: {
  mint: string;
  token: TokenPayload | null;
  safety: SafetyPayload | null;
  forensics: ForensicsPayload | null;
}) {
  const symbol = (token?.symbol as string) || "TOKEN";
  const name = (token?.name as string) || "Unknown";
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  const vol = Number(token?.volume24h ?? NaN);
  const fdv = Number(token?.fdv ?? NaN);
  const holderCount = token?.holderCount ?? forensics?.concentration?.totalHolders ?? null;

  return (
    <div className="oxc-grid oxc-grid-3">
      <div className="oxc-panel" style={termPanel}>
        <h3 style={termH3}>Token overview</h3>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {token?.image ? (
            <img src={String(token.image)} alt="" width={44} height={44} style={{ borderRadius: 8 }} />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: "rgba(232, 184, 74, 0.15)",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                color: "var(--term-gold)",
              }}
            >
              {symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div style={{ fontFamily: "var(--term-hand)", fontWeight: 700, fontSize: "1.4rem", color: "var(--term-ink)" }}>
              ${symbol}
            </div>
            <div className="oxc-muted" style={{ fontSize: "0.8rem" }}>
              {name}
            </div>
          </div>
        </div>
        <div className="oxc-mono oxc-muted" style={{ marginTop: "0.75rem", wordBreak: "break-all" }}>
          {mint}
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a className="oxc-link" href={`/ORBITX_DEX/token/${mint}`} target="_blank" rel="noreferrer">
            Open in DEX →
          </a>
          <a className="oxc-link" href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer">
            Solscan →
          </a>
        </div>
      </div>

      <div className="oxc-panel" style={termPanel}>
        <h3 style={termH3}>Market</h3>
        <div className="oxc-grid oxc-grid-2">
          <div className="oxc-stat">
            <div className="label">Price</div>
            <div className="value">{Number.isFinite(price) ? `$${price < 0.01 ? price.toExponential(2) : price.toFixed(4)}` : "—"}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">Liquidity</div>
            <div className="value">{fmtUsd(Number.isFinite(liq) ? liq : null)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">MCap</div>
            <div className="value">{fmtUsd(Number.isFinite(mcap) ? mcap : null)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">Vol 24h</div>
            <div className="value">{fmtUsd(Number.isFinite(vol) ? vol : null)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">FDV</div>
            <div className="value">{fmtUsd(Number.isFinite(fdv) ? fdv : null)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">Age</div>
            <div className="value" style={{ fontSize: "0.9rem" }}>
              {ageLabel(token?.ageDays, token?.createdAt)}
            </div>
          </div>
          <div className="oxc-stat">
            <div className="label">Holders</div>
            <div className="value">{fmtInt(holderCount)}</div>
          </div>
          <div className="oxc-stat">
            <div className="label">24h change</div>
            <div className="value">{fmtSignedPct(token?.change24h)}</div>
          </div>
        </div>
      </div>

      <div className="oxc-panel" style={termPanel}>
        <h3 style={termH3}>Contract & tradeability</h3>
        <div className="oxc-factor">
          <span>Mint authority</span>
          <span>{authorityVerdict(forensics?.safetyFlags?.mintRenounced).label}</span>
        </div>
        <div className="oxc-factor">
          <span>Freeze authority</span>
          <span>{authorityVerdict(forensics?.safetyFlags?.freezeRenounced).label}</span>
        </div>
        <div className="oxc-factor">
          <span>LP locked</span>
          <span>{lpLockState(forensics?.safetyFlags?.lpLockedPct).label}</span>
        </div>
        <div className="oxc-factor">
          <span>Jupiter route</span>
          <span>{safety?.verdict || "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>Launchpad</span>
          <span>{forensics?.launchpad || "—"}</span>
        </div>
        <div className="oxc-factor">
          <span>Dev wallet</span>
          <span className="oxc-mono">{short(forensics?.dev?.wallet)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * TL;DR verdict (W3) — 2–3 plain-English lines from the real score, the
 * weakest category, caps and unknowns. Never invents a signal: missing
 * data is named as unknown.
 */
export function ogScoreTldr(ogScore: OgScore): string {
  if (ogScore.score == null) {
    const unknowns = ogScore.unknowns.length ? ` Still unknown: ${ogScore.unknowns.join(", ")}.` : "";
    return `No score could be given — not enough signals came back to judge this token.${unknowns} Treat it as unverified, not as safe.`;
  }
  const pct = Math.round(ogScore.score);
  const line1 = `This token scores ${pct}/100 — ${ogScore.band.toLowerCase()}.`;
  const weakest = [...ogScore.categories].sort((a, b) => a.points / a.max - b.points / b.max)[0];
  const line2 = weakest
    ? `Weakest area is ${weakest.label.toLowerCase()} (${weakest.points}/${weakest.max}) — ${weakest.note}`
    : "";
  const line3 = ogScore.caps[0]
    ? `Flag: ${ogScore.caps[0]}`
    : ogScore.unknowns.length
      ? `Still unknown: ${ogScore.unknowns.join(", ")}.`
      : "No major flags or unknowns left in this scan.";
  return [line1, line2, line3].filter(Boolean).join(" ");
}

export function OgScorePanel({ ogScore }: { ogScore: OgScore | null }) {
  if (!ogScore) return <p className="oxc-empty">Score pending — waiting on scan data.</p>;
  if (ogScore.score == null) {
    return (
      <div>
        <p className="oxc-empty">{ogScoreTldr(ogScore)}</p>
        {ogScore.unknowns.length ? (
          <p className="oxc-muted" style={{ fontSize: "0.8rem" }}>
            Unknown: {ogScore.unknowns.join(" · ")}
          </p>
        ) : null}
      </div>
    );
  }
  const pct = Math.round(ogScore.score);
  const bandColor =
    pct >= 70 ? "#3dd68c" : pct >= 40 ? "var(--term-gold)" : "#ff5c5c";
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center", minWidth: 96 }}>
        <div
          style={{
            fontFamily: "var(--term-hand)",
            fontSize: "3.4rem",
            lineHeight: 1,
            fontWeight: 700,
            color: bandColor,
          }}
        >
          {pct}
        </div>
        <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--term-ink)" }}>{ogScore.band}</div>
        <div className="oxc-muted" style={{ fontSize: "0.75rem" }}>OG score / 100</div>
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.5, margin: "0 0 0.75rem", color: "var(--term-ink)" }}>
          {ogScoreTldr(ogScore)}
        </p>
        {ogScore.categories.map((c) => (
          <div key={c.id} style={{ marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span className="oxc-muted">
                {c.points}/{c.max}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(201, 209, 217, 0.15)", marginTop: "0.2rem" }}>
              <div
                style={{
                  width: `${Math.round((c.points / c.max) * 100)}%`,
                  height: "100%",
                  borderRadius: 3,
                  background: "var(--term-gold)",
                }}
              />
            </div>
            <div className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.15rem" }}>
              {c.note}
            </div>
          </div>
        ))}
        {ogScore.caps.map((cap) => (
          <p key={cap} style={{ color: "#ff5c5c", fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
            {cap}
          </p>
        ))}
        {ogScore.adjustments.length ? (
          <div style={{ marginTop: "0.5rem" }}>
            {ogScore.adjustments.map((a) => (
              <p key={a.id} style={{ color: a.points < 0 ? "#ff5c5c" : "#3dd68c", fontSize: "0.8rem", margin: "0.15rem 0 0" }}>
                {a.label} ({a.points > 0 ? `+${a.points}` : a.points})
              </p>
            ))}
          </div>
        ) : null}
        {ogScore.unknowns.length ? (
          <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
            Unknown (scored 0, not invented): {ogScore.unknowns.join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ContractPanel({
  forensics,
  safety,
  token,
}: {
  forensics: ForensicsPayload | null;
  safety: SafetyPayload | null;
  token: TokenPayload | null;
}) {
  const mint = authorityVerdict(forensics?.safetyFlags?.mintRenounced);
  const freeze = authorityVerdict(forensics?.safetyFlags?.freezeRenounced);
  const checks = honeypotChecks(safety);
  const rugged = forensics?.safetyFlags?.rugged;
  return (
    <div>
      <CheckRow
        label="Mint authority"
        value={mint.label}
        state={mint.state}
        badge={mint.state === "pass" ? "Revoked" : mint.state === "fail" ? "Live" : "Unknown"}
        hint={mint.state === "fail" ? "Supply can still be inflated by the authority holder." : mint.state === "pass" ? "Supply cannot be inflated." : "Authority state not reported by any source."}
      />
      <CheckRow
        label="Freeze authority"
        value={freeze.label}
        state={freeze.state}
        badge={freeze.state === "pass" ? "Revoked" : freeze.state === "fail" ? "Live" : "Unknown"}
        hint={freeze.state === "fail" ? "Wallets can still be frozen by the authority holder." : freeze.state === "pass" ? "No wallet can be frozen." : "Authority state not reported by any source."}
      />
      <CheckRow
        label="Mutable metadata"
        value="Unknown"
        state="unknown"
        badge="Unknown"
        hint="No source in this scan reports metadata mutability — never assumed immutable."
      />
      <CheckRow
        label="Token program"
        value="Unknown"
        state="unknown"
        badge="Unknown"
        hint="Token-2022 vs classic SPL is not reported by the token, forensics, or DexScreener feeds used here."
      />
      <CheckRow
        label="Launchpad"
        value={forensics?.launchpad || "Unknown"}
        hint={forensics?.isPumpFun ? "pump.fun origin — check bonding status below." : undefined}
      />
      {forensics?.bondingComplete != null ? (
        <CheckRow
          label="Bonding curve"
          value={forensics.bondingComplete ? "Complete — migrated" : "Still bonding"}
          state={forensics.bondingComplete ? "pass" : "warn"}
          badge={forensics.bondingComplete ? "Migrated" : "Bonding"}
        />
      ) : null}
      <CheckRow
        label="Rugged flag"
        value={rugged === true ? "Flagged rugged" : rugged === false ? "Not flagged" : "Unknown"}
        state={rugged === true ? "fail" : rugged === false ? "pass" : "unknown"}
        badge={rugged === true ? "Rugged" : rugged === false ? "Clean" : "Unknown"}
      />
      {forensics?.safetyFlags?.riskScore != null ? (
        <CheckRow label="External risk score" value={`${forensics.safetyFlags.riskScore} / 100`} hint="Upstream Rugcheck-style score; higher is riskier." />
      ) : null}
      {checks.map((c) => (
        <CheckRow key={c.id} label={c.label} value="" state={c.state} badge={c.state === "pass" ? "Pass" : c.state === "fail" ? "Fail" : c.state === "warn" ? "Warn" : "Unknown"} hint={c.detail} />
      ))}
      {token?.firstPool?.id ? (
        <div className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
          First pool: <span className="oxc-mono">{short(token.firstPool.id)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function LiquidityPanel({
  token,
  forensics,
  dexPairs,
}: {
  token: TokenPayload | null;
  forensics: ForensicsPayload | null;
  dexPairs: DexPair[] | null;
}) {
  const top = dexPairs?.[0] ?? token?.pairs?.[0] ?? null;
  const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  const lock = lpLockState(forensics?.safetyFlags?.lpLockedPct);
  const pools = forensics?.concentration?.pools ?? [];
  const liqMcap = Number.isFinite(liq) && Number.isFinite(mcap) && mcap > 0 ? liq / mcap : null;
  return (
    <div>
      <CheckRow
        label="Total liquidity"
        value={fmtUsd(Number.isFinite(liq) ? liq : null)}
        hint={top?.dexId ? `Deepest pool: ${top.dexId}` : "No pair data returned."}
      />
      <CheckRow
        label="Top pool / DEX"
        value={top ? `${top.dexId || "Unknown DEX"}` : "Unknown"}
        hint={top?.pairAddress ? `Pair ${short(top.pairAddress)}${top.quoteSymbol ? ` vs ${top.quoteSymbol}` : ""}` : "No Solana pair found."}
      />
      <CheckRow
        label="LP lock / burn"
        value={lock.label}
        state={lock.state}
        badge={lock.state === "pass" ? "Locked" : lock.state === "fail" ? "Unlocked" : lock.state === "warn" ? "Partial" : "Unknown"}
        hint={
          lock.state === "unknown"
            ? "No LP lock or burn data is reported by the forensics feed for this mint — not assumed locked."
            : "Share of LP reported locked by the upstream safety feed."
        }
      />
      <CheckRow
        label="Pool vaults in holder list"
        value={pools.length ? `${pools.length} pool account(s) excluded from holder stats` : "None detected"}
        hint="Pool vaults are stripped out before concentration is computed."
      />
      <CheckRow
        label="Liquidity / mcap"
        value={liqMcap != null ? `${(liqMcap * 100).toFixed(1)}%` : "Unknown"}
        state={liqMcap == null ? "unknown" : liqMcap >= 0.12 ? "pass" : liqMcap >= 0.05 ? "pass" : liqMcap >= 0.02 ? "warn" : "fail"}
        badge={liqMcap == null ? "Unknown" : liqMcap >= 0.05 ? "Healthy" : liqMcap >= 0.02 ? "Thin" : "Very thin"}
        hint="Healthy ≥12%, ok ≥5%, thin <2% — contextual, never a scam verdict on its own."
      />
      {forensics?.dexPaid ? (
        <CheckRow
          label="DexScreener listing"
          value={forensics.dexPaid.paid ? "Paid profile / boost" : "Unpaid listing"}
          state={forensics.dexPaid.paid ? "pass" : "unknown"}
          badge={forensics.dexPaid.paid ? "Paid" : "Free"}
          hint="Whether the project's DexScreener listing was paid for."
        />
      ) : (
        <CheckRow label="DexScreener listing" value="Unknown" state="unknown" badge="Unknown" hint="Paid-listing check did not return." />
      )}
    </div>
  );
}

export function MarketPanel({
  token,
  dexPairs,
}: {
  token: TokenPayload | null;
  dexPairs: DexPair[] | null;
}) {
  // Prefer the direct DexScreener pairs (full windows); fall back to the
  // backend-mapped pairs (24h only) and the token's own change fields.
  const top = dexPairs?.[0] ?? token?.pairs?.[0] ?? null;
  const pairs = (dexPairs?.length ? dexPairs : token?.pairs ?? []).slice(0, 5);
  const vol24 = top?.volumeH24 ?? token?.volume24h ?? null;
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  return (
    <div>
      <div className="oxc-grid oxc-grid-3" style={{ marginBottom: "0.75rem" }}>
        <div className="oxc-stat">
          <div className="label">Price</div>
          <div className="value">{Number.isFinite(price) ? `$${price < 0.01 ? price.toExponential(2) : price.toFixed(4)}` : "—"}</div>
        </div>
        <div className="oxc-stat">
          <div className="label">MCap</div>
          <div className="value">{fmtUsd(Number.isFinite(mcap) ? mcap : null)}</div>
        </div>
        <div className="oxc-stat">
          <div className="label">FDV</div>
          <div className="value">{fmtUsd(token?.fdv ?? null)}</div>
        </div>
        <div className="oxc-stat">
          <div className="label">ATH price</div>
          <div className="value">{token?.athPrice != null ? `$${token.athPrice < 0.01 ? token.athPrice.toExponential(2) : token.athPrice.toFixed(4)}` : "—"}</div>
        </div>
        <div className="oxc-stat">
          <div className="label">ATH mcap</div>
          <div className="value">{fmtUsd(token?.athMcap ?? null)}</div>
        </div>
        <div className="oxc-stat">
          <div className="label">Age</div>
          <div className="value" style={{ fontSize: "0.9rem" }}>
            {ageLabel(token?.ageDays, token?.createdAt)}
          </div>
        </div>
      </div>

      <table className="oxc-table">
        <thead>
          <tr>
            <th>Window</th>
            <th>Volume</th>
            <th>Buys</th>
            <th>Sells</th>
            <th>Price chg</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>5m</td>
            <td>{fmtUsd(top?.volumeM5 ?? null)}</td>
            <td>{fmtInt(top?.txnsM5Buys ?? null)}</td>
            <td>{fmtInt(top?.txnsM5Sells ?? null)}</td>
            <td>{fmtSignedPct(top?.changeM5 ?? token?.change5m ?? null)}</td>
          </tr>
          <tr>
            <td>1h</td>
            <td>{fmtUsd(top?.volumeH1 ?? null)}</td>
            <td>{fmtInt(top?.txnsH1Buys ?? null)}</td>
            <td>{fmtInt(top?.txnsH1Sells ?? null)}</td>
            <td>{fmtSignedPct(top?.changeH1 ?? token?.change1h ?? null)}</td>
          </tr>
          <tr>
            <td>6h</td>
            <td>{fmtUsd(top?.volumeH6 ?? null)}</td>
            <td>{fmtInt(top?.txnsH6Buys ?? null)}</td>
            <td>{fmtInt(top?.txnsH6Sells ?? null)}</td>
            <td>{fmtSignedPct(top?.changeH6 ?? token?.change6h ?? null)}</td>
          </tr>
          <tr>
            <td>24h</td>
            <td>{fmtUsd(vol24)}</td>
            <td>{fmtInt(top?.txnsH24Buys ?? null)}</td>
            <td>{fmtInt(top?.txnsH24Sells ?? null)}</td>
            <td>{fmtSignedPct(top?.changeH24 ?? token?.change24h ?? null)}</td>
          </tr>
        </tbody>
      </table>
      {dexPairs === null ? (
        <p className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
          DexScreener windows loading…
        </p>
      ) : dexPairs.length === 0 && !token?.pairs?.length ? (
        <p className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
          No DexScreener pair data — 5m/1h windows are unknown, not zero.
        </p>
      ) : null}

      {pairs.length > 1 ? (
        <>
          <h4 style={{ margin: "0.9rem 0 0.4rem", fontSize: "0.85rem" }}>All pools</h4>
          <table className="oxc-table">
            <thead>
              <tr>
                <th>DEX</th>
                <th>Liquidity</th>
                <th>Vol 24h</th>
                <th>Buys / sells</th>
                <th>24h chg</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p.pairAddress || p.dexId}>
                  <td>{p.dexId || "—"}</td>
                  <td>{fmtUsd(p.liquidityUsd ?? null)}</td>
                  <td>{fmtUsd(p.volumeH24 ?? null)}</td>
                  <td>
                    {p.txnsH24Buys != null || p.txnsH24Sells != null
                      ? `${fmtInt(p.txnsH24Buys ?? null)} / ${fmtInt(p.txnsH24Sells ?? null)}`
                      : "—"}
                  </td>
                  <td>{fmtSignedPct(p.changeH24 ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

export function HolderTable({
  token,
  forensics,
}: {
  token: TokenPayload | null;
  forensics: ForensicsPayload | null;
}) {
  const holders = token?.holders || [];
  const band = concentrationBand(forensics?.concentration?.top10Pct);
  const devWallet = forensics?.dev?.wallet;
  const topHolderPct = holders.length ? holders[0]?.pct ?? null : null;
  return (
    <div>
      <div className="oxc-muted" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
        Top 10 concentration: {fmtPct(forensics?.concentration?.top10Pct, 1) ?? "—"}
        {" · "}
        Whales (≥1%): {forensics?.concentration?.whales ?? "—"}
        {" · "}
        Holders: {fmtInt(forensics?.concentration?.totalHolders ?? token?.holderCount ?? null)}
        {" · "}
        Top wallet: {fmtPct(topHolderPct, 2) ?? "—"}
      </div>
      <div style={{ marginBottom: "0.75rem" }}>
        <VerdictBadge state={band.state} label={`${band.label} — top 10 ${fmtPct(forensics?.concentration?.top10Pct, 1) ?? "unknown"}`} />
      </div>
      {holders.length === 0 ? (
        <p className="oxc-empty">Holder list unavailable for this mint.</p>
      ) : (
        <table className="oxc-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>%</th>
              <th>Track</th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 10).map((h, i) => {
              const isDev = !!devWallet && h.owner === devWallet;
              return (
                <tr key={h.owner || i} style={isDev ? { background: "rgba(232, 184, 74, 0.08)" } : undefined}>
                  <td>{h.rank ?? i + 1}</td>
                  <td className="oxc-mono">
                    {short(h.owner)}{" "}
                    {isDev ? (
                      <span style={{ color: "var(--term-gold)", fontWeight: 700, fontSize: "0.7rem" }}>DEV</span>
                    ) : null}
                  </td>
                  <td>{fmtPct(h.pct, 2) ?? "—"}</td>
                  <td>
                    {h.owner ? (
                      <a className="oxc-link" href={`/intel/wallet/${h.owner}`}>
                        Track
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Top 10 only — pool vaults are excluded from concentration. Full holder count comes from the upstream feed, never the sample length.
      </p>
    </div>
  );
}

export function DevHistoryPanel({ forensics }: { forensics: ForensicsPayload | null }) {
  const dev = forensics?.dev;
  const first = forensics?.firstBuyer;
  return (
    <div>
      {!dev ? (
        <p className="oxc-empty">No deployer attribution yet.</p>
      ) : (
        <>
          <div className="oxc-factor">
            <span>Creator</span>
            <a className="oxc-link oxc-mono" href={`/intel/wallet/${dev.wallet}`}>
              {short(dev.wallet)}
            </a>
          </div>
          <div className="oxc-factor">
            <span>Previous launches</span>
            <span>{dev.tokensCreated ?? "—"}</span>
          </div>
          <div className="oxc-factor">
            <span>Serial deployer</span>
            <span>{dev.serial ? "Yes" : "No"}</span>
          </div>
          <div className="oxc-factor">
            <span>Dev holding</span>
            <span>{fmtPct(dev.holding?.pct, 2) ?? (dev.sold ? "Exited" : "—")}</span>
          </div>
          <div className="oxc-factor">
            <span>Dev sold</span>
            <span>{dev.sold == null ? "—" : dev.sold ? "Likely" : "Still holding"}</span>
          </div>
          {dev.rank != null ? (
            <div className="oxc-factor">
              <span>Dev holder rank</span>
              <span>#{dev.rank}</span>
            </div>
          ) : null}
        </>
      )}
      <h4 style={{ margin: "0.9rem 0 0.4rem", fontSize: "0.85rem" }}>First buyer — OG proof</h4>
      {!first ? (
        <p className="oxc-empty">First-buyer trace not run or not returned for this mint.</p>
      ) : first.traced && first.wallet ? (
        <>
          <div className="oxc-factor">
            <span>First buyer</span>
            <a className="oxc-link oxc-mono" href={`/intel/wallet/${first.wallet}`}>
              {short(first.wallet)}
            </a>
          </div>
          <div className="oxc-factor">
            <span>First buyer is dev</span>
            <span>{first.isDev ? "Yes" : "No"}</span>
          </div>
          {first.solSpent != null ? (
            <div className="oxc-factor">
              <span>SOL spent</span>
              <span>{first.solSpent.toFixed(4)} SOL</span>
            </div>
          ) : null}
          {first.time ? (
            <div className="oxc-factor">
              <span>When</span>
              <span>{fmtTime(first.time)}</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className="oxc-empty">{first.note || "Could not trace the first buyer."}</p>
      )}
    </div>
  );
}

export function LinksPanel({
  token,
  research,
  mint,
}: {
  token: TokenPayload | null;
  research: ResearchPayload | null;
  mint: string;
}) {
  const socials = token?.socials;
  const links = research?.links;
  const website = socials?.website || links?.website;
  const twitter = socials?.twitter || links?.twitter;
  const telegram = socials?.telegram || links?.telegram;
  const discord = socials?.discord;
  const rows: Array<{ label: string; url: string; Icon: typeof Globe }> = [];
  if (website) rows.push({ label: "Website", url: website, Icon: Globe });
  if (twitter) rows.push({ label: "Twitter / X", url: twitter, Icon: Link2 });
  if (telegram) rows.push({ label: "Telegram", url: telegram, Icon: Send });
  if (discord) rows.push({ label: "Discord", url: discord, Icon: MessageCircle });
  return (
    <div>
      {rows.length === 0 ? (
        <p className="oxc-empty">
          No website or social links reported for this token — DexScreener pair info and the research feed both came back empty. Nothing invented here.
        </p>
      ) : (
        rows.map((r) => (
          <div key={r.label} className="oxc-factor">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <r.Icon size={14} /> {r.label}
            </span>
            <a className="oxc-link" href={r.url} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", textAlign: "right" }}>
              {r.url.replace(/^https?:\/\//, "").slice(0, 48)}
              <ExternalLink size={12} style={{ marginLeft: 4, verticalAlign: "-1px" }} />
            </a>
          </div>
        ))
      )}
      <div className="oxc-factor">
        <span>DexScreener</span>
        <a className="oxc-link" href={links?.dex || `https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer">
          Open pair →
        </a>
      </div>
      <div className="oxc-factor">
        <span>Birdeye</span>
        <a className="oxc-link" href={links?.birdeye || `https://birdeye.so/token/${mint}?chain=solana`} target="_blank" rel="noreferrer">
          Open token →
        </a>
      </div>
      <div className="oxc-factor">
        <span>Solscan</span>
        <a className="oxc-link" href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer">
          Open token →
        </a>
      </div>
      {research?.description ? (
        <p className="oxc-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
          {research.description.slice(0, 300)}
        </p>
      ) : null}
    </div>
  );
}

export function ClonesPanel({
  research,
  ownMcap,
  mint,
}: {
  research: ResearchPayload | null;
  ownMcap: number | null;
  mint: string;
}) {
  if (!research) {
    return <p className="oxc-empty">Clone check loading — searching DexScreener for same-name tokens…</p>;
  }
  const clones = research.clones ?? [];
  const verdict = cloneVerdict(clones, ownMcap);
  return (
    <div>
      <div style={{ marginBottom: "0.75rem" }}>
        <VerdictBadge state={verdict.state} label={verdict.label} />
      </div>
      {clones.length === 0 ? (
        <p className="oxc-empty">No other Solana token shares this name or symbol on DexScreener.</p>
      ) : (
        <table className="oxc-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>MCap</th>
              <th>Vol 24h</th>
              <th>Launched</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clones.slice(0, 5).map((c) => (
              <tr key={c.mint}>
                <td>
                  <div style={{ fontWeight: 600 }}>${c.symbol || "?"}</div>
                  <div className="oxc-muted" style={{ fontSize: "0.72rem" }}>
                    {c.name || ""} · <span className="oxc-mono">{short(c.mint)}</span>
                  </div>
                </td>
                <td>{fmtUsd(c.mcap ?? null)}</td>
                <td>{fmtUsd(c.volume24h ?? null)}</td>
                <td>{fmtTime(c.launchTime)}</td>
                <td>
                  <a className="oxc-link" href={c.dexUrl || `/intel/scan/${c.mint}`} target={c.dexUrl ? "_blank" : undefined} rel="noreferrer">
                    {c.mint === mint ? "This token" : "Scan →"}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Same name/symbol is not proof of a copy — check launch order and liquidity before calling a clone.
      </p>
    </div>
  );
}
/** ── OG scanner upgrade (2026-11-08): bundle detection, X intel, dev wallet ── */

// Bundle detection — live server-side RPC clustering (W1). Unknown/partial
// states render honestly; the card never claims "no bundles" on missing data.
export function BundlePanel({ bundle, loading }: { bundle: RawBundleAnalysis | null; loading: boolean }) {
  if (loading && !bundle) return <p className="oxc-empty oxc-pulse">Scanning bundles — tracing holder funding…</p>;
  if (!bundle) {
    return (
      <div>
        <CheckRow label="Bundle scan" value="Unknown" state="unknown" badge="Unknown" hint="The bundle scan did not return data. Nothing is assumed clean." />
      </div>
    );
  }
  const verdict = bundleRiskVerdict(
    bundle.state === "unknown"
      ? null
      : {
          available: true,
          bundledSupplyPct: bundle.bundledSupplyPct,
          clusterCount: bundle.clusterCount,
          largestClusterPct: null,
          bundleRisk: bundle.risk === "high" ? "high" : bundle.risk === "medium" ? "moderate" : bundle.risk === "low" || bundle.risk === "none" ? "low" : null,
        },
  );
  return (
    <div>
      <CheckRow label="Bundled supply" value={bundle.bundledSupplyPct != null ? `${bundle.bundledSupplyPct.toFixed(1)}%` : "Unknown"} state={verdict.state} badge={verdict.label} hint={verdict.detail} />
      <CheckRow label="Clusters" value={bundle.clusterCount != null ? `${bundle.clusterCount} cluster${bundle.clusterCount === 1 ? "" : "s"}` : "Unknown"} hint="Groups of holders funded from a common source or buying in the same tight window." />
      <CheckRow label="Dev-linked supply" value={bundle.devLinkedPct != null ? `${bundle.devLinkedPct.toFixed(1)}%` : "Unknown"} hint="Supply in wallets funded by the creator or mint authority." />
      <CheckRow label="Holders traced" value={`${bundle.holdersTraced} / ${bundle.holdersAnalyzed}`} hint={bundle.state === "partial" ? "Partial scan — bundled % is a lower bound." : "Top holders traced to their funding source."} />
      <div style={{ marginTop: "0.75rem" }}>
        <BundleVisual bundles={[]} totalBundlePct={0} analysis={bundle} />
      </div>
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Analyzed {bundle.analyzedAt ? new Date(bundle.analyzedAt).toLocaleTimeString() : "—"} · server-side RPC, cached 3 min per mint.
      </p>
    </div>
  );
}

// X / Twitter intel — real data only (W2). Linked handle comes from DexScreener
// + GeckoTerminal; profile enrichment needs an X Bearer token server-side.
// Mentions, KOL activity and sentiment have no real source — always unavailable.
export function XPanel({ x, loading, onRetry }: { x: RawXIntel | null; loading: boolean; onRetry?: () => void }) {
  return <XIntel intel={x} loading={loading} onRetry={onRetry} />;
}

// Dev wallet — forensics attribution + live position from the wallet route.
export function DevWalletPanel({
  forensics,
  devWallet,
}: {
  forensics: ForensicsPayload | null;
  devWallet: DevWalletIntel | null;
}) {
  const verdict = devWalletVerdict(forensics?.dev, devWallet);
  const wallet = forensics?.dev?.wallet ?? devWallet?.wallet ?? null;
  return (
    <div>
      <CheckRow label="Deployer" value={wallet ? <span className="oxc-mono">{short(wallet)}</span> : "Unknown"} state={verdict.state} badge={verdict.label} hint={verdict.detail} />
      {devWallet?.available ? (
        <>
          <CheckRow label="SOL balance" value={devWallet.solBalance != null ? `${devWallet.solBalance.toFixed(2)} SOL` : "Unknown"} hint={devWallet.solUnknown ? "Balance fetch failed — shown as unknown, not zero." : "Live balance from the wallet route."} />
          <CheckRow label="Portfolio value" value={fmtUsd(devWallet.totalUsd)} />
          <CheckRow label="Tokens held" value={devWallet.tokenCount != null ? `${devWallet.tokenCount}` : "Unknown"} />
          <CheckRow label="Recent trades" value={devWallet.tradeCount != null ? `${devWallet.tradeCount}` : "Unknown"} />
          <CheckRow label="Holding of this token" value={devWallet.holdingPctOfToken != null ? `${devWallet.holdingPctOfToken.toFixed(2)}%` : "Unknown"} />
        </>
      ) : (
        <CheckRow label="Live position" value="Unknown" state="unknown" badge="Unknown" hint="The wallet route did not return a live position — the deployer's current holdings could not be confirmed." />
      )}
      {forensics?.dev?.tokensCreated != null ? (
        <CheckRow label="Tokens launched by dev" value={`${forensics.dev.tokensCreated}`} hint="Serial deployers launch many tokens — repeat launches, repeat risk." />
      ) : null}
    </div>
  );
}

/** ── Scanner v2 (2026-11-08): live risk, funding chain, same-dev, trade ──
 *  tape, whale alerts, holder graph, sandbox replay, social scan.
 *
 *  Team A (useTokenIntel extensions: fundingChain / devHistory / sameDev /
 *  tradeTape / whaleAlerts / riskLive), Team C (holder graph / bundle map),
 *  Team E (social panels) and Team F (sandbox replay) land in parallel.
 *  Every panel below reads their data / components DEFENSIVELY: when a
 *  field or a teammate component is not in the tree yet it renders an
 *  honest "Unavailable — reason" state, never a fake zero. When the
 *  teammate's work lands, the same panel lights up with no further edit
 *  here. Teammate components are resolved by filename through
 *  import.meta.glob so a missing file is a runtime fallback, not a build
 *  break. ─────────────────────────────────────────────────────────────── */

// ── Loose parsers for Team A fields (shape lands with Team A) ─────────────
function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}
function asStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function asObj(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function asTime(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return new Date(v < 1e12 ? v * 1000 : v).toLocaleTimeString();
  if (typeof v === "string" && v.trim() !== "") {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toLocaleTimeString() : v;
  }
  return null;
}
/** Pull a list of mints / addresses out of whatever shape Team A ships. */
function pickMintList(v: unknown, keys: string[]): string[] {
  const out: string[] = [];
  const pushOne = (x: unknown) => {
    const s = asStr(x);
    if (s) {
      if (!out.includes(s)) out.push(s);
      return;
    }
    const o = asObj(x);
    if (o) {
      for (const k of ["mint", "address", "token", "id", "symbol"]) {
        const s2 = asStr(o[k]);
        if (s2) {
          if (!out.includes(s2)) out.push(s2);
          return;
        }
      }
    }
  };
  if (Array.isArray(v)) v.forEach(pushOne);
  else {
    const o = asObj(v);
    if (o) for (const k of keys) {
      const val = o[k];
      if (Array.isArray(val)) val.forEach(pushOne);
      else pushOne(val);
    }
  }
  return out;
}
function pickFlag(v: unknown, keys: string[]): boolean | null {
  const o = asObj(v);
  if (typeof v === "boolean") return v;
  if (!o) return null;
  for (const k of keys) if (typeof o[k] === "boolean") return o[k] as boolean;
  return null;
}

/** Honest "not here yet" row — used by every v2 panel below. */
function Unavailable({ what, reason }: { what: string; reason: string }) {
  return (
    <CheckRow
      label={what}
      value="Unavailable"
      state="unknown"
      badge="Unknown"
      hint={reason}
    />
  );
}

// ── Optional teammate components (Team C / E / F) ──────────────────────────
// Resolved by filename at runtime; a teammate file that has not landed yet
// simply resolves to null and the panel renders its honest fallback.
const teamScanner20x = import.meta.glob("../../components/scanner-20x/*.tsx");
const teamIntel = import.meta.glob("../../components/intel/*.tsx");
// Team C/E/F components live beside TokenPanels (BundleMap, HolderGraph,
// SandboxReplay, SocialPanels) — without this glob they never resolve and
// their sections fall back to "Unavailable" even though the code is in-tree.
const teamCrypto = import.meta.glob("./*.tsx");
const teamComponentCache = new Map<string, ComponentType<any> | null>();
function teamComponent(names: string[]): ComponentType<any> | null {
  const cacheKey = names.join("|");
  if (teamComponentCache.has(cacheKey)) return teamComponentCache.get(cacheKey) ?? null;
  let found: ComponentType<any> | null = null;
  for (const dir of [teamScanner20x, teamIntel, teamCrypto]) {
    for (const name of names) {
      const key = Object.keys(dir).find((k) => k.endsWith(`/${name}.tsx`));
      if (key) {
        found = lazy(dir[key] as () => Promise<{ default: ComponentType<any> }>);
        break;
      }
    }
    if (found) break;
  }
  teamComponentCache.set(cacheKey, found);
  return found;
}

// ── LIVE risk score ─────────────────────────────────────────────────────────
type ParsedRiskLive = { score: number; label: string | null; updatedAt: string | null; streaming: boolean };
function parseRiskLive(v: unknown): ParsedRiskLive | null {
  const o = asObj(v);
  if (!o) return null;
  const score = asNum(o.score ?? o.riskScore ?? o.value);
  if (score == null) return null;
  return {
    score,
    label: asStr(o.label ?? o.band ?? o.rating),
    updatedAt: asTime(o.updatedAt ?? o.updated ?? o.at),
    streaming: o.streaming === true || o.updating === true || o.live === true,
  };
}

export function LiveRiskPanel({
  risk,
  riskLive,
  loading,
}: {
  risk: ComposedRisk | null;
  riskLive?: unknown;
  loading: boolean;
}) {
  if (loading && !risk) return <p className="oxc-empty oxc-pulse">Composing live risk…</p>;
  const live = parseRiskLive(riskLive);
  if (live) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
          <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--term-gold)", lineHeight: 1 }}>
            {Math.round(live.score)}
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>/ 100{live.label ? ` — ${live.label}` : ""}</span>
          {live.streaming && <span className="oxc-empty oxc-pulse" style={{ fontSize: "0.75rem" }}>updating…</span>}
        </div>
        <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
          Live risk score — streams in as new intel lands.
          {live.updatedAt ? ` Last update ${live.updatedAt}.` : " Update time unknown."}
        </p>
      </div>
    );
  }
  if (risk) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
          <span style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--term-gold)", lineHeight: 1 }}>
            {Math.round(risk.score)}
          </span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>/ 100 — {risk.label}</span>
        </div>
        <CheckRow label="Rating" value={risk.rating} hint={risk.summary || undefined} />
        <CheckRow
          label="Estimated rug probability"
          value={Number.isFinite(risk.rugProbability) ? `${Math.round(risk.rugProbability)}%` : "Unknown"}
        />
        <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
          Live streaming risk (Team A feed) is not connected yet — showing the composed score from the full intel pass.
        </p>
      </div>
    );
  }
  return (
    <Unavailable
      what="Live risk score"
      reason="No risk signal returned for this mint — nothing scored, nothing assumed safe."
    />
  );
}

// ── Dev wallet lineage / funding chain ──────────────────────────────────────
export function FundingChainPanel({
  bundle,
  forensics,
}: {
  bundle: RawBundleAnalysis | null;
  forensics: ForensicsPayload | null;
}) {
  const trace: SourceWalletTrace | null = adaptSourceTrace(bundle);
  const devWallet = forensics?.dev?.wallet ?? trace?.devWallet ?? null;
  const chains: string[][] = [];
  if (trace?.fundedBy) {
    const chain = [devWallet, trace.fundedBy, trace.sourceWallet].filter((w): w is string => !!w);
    if (chain.length > 1) chains.push([...new Set(chain)]);
  }
  const devClusters: BundleCluster[] = (bundle?.clusters ?? []).filter(
    (c) => c.devLinked && c.fundingChain && c.fundingChain.length > 0,
  );
  for (const c of devClusters) {
    const chain = [...new Set(c.fundingChain)];
    if (chain.length > 1 && !chains.some((x) => x.join() === chain.join())) chains.push(chain);
  }

  if (!trace && !bundle) {
    return (
      <Unavailable
        what="Funding chain"
        reason="No bundle scan or forensics data for this mint yet — the funding walk cannot run on nothing."
      />
    );
  }
  if (chains.length === 0) {
    return (
      <div>
        <CheckRow
          label="Dev wallet"
          value={devWallet ? <span className="oxc-mono">{short(devWallet)}</span> : "Unknown"}
          hint="Every fresh wallet was funded from a source wallet — the chain is what links a 'new' dev wallet to its history."
        />
        <Unavailable
          what="Funding source"
          reason={
            trace
              ? "No dev-linked funding cluster detected — the dev wallet's funding source could not be traced."
              : "The bundle scan did not return — the funding walk needs its cluster data."
          }
        />
      </div>
    );
  }
  const launches = trace?.sourceTokensCreated;
  return (
    <div>
      {chains.map((chain, i) => (
        <div key={i} style={{ marginBottom: "0.6rem" }}>
          <div className="oxc-mono" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>
            {chain.map((w, j) => (
              <span key={j}>
                {j > 0 && <span style={{ color: "var(--term-gold)" }}> → </span>}
                <span title={w}>{short(w)}</span>
              </span>
            ))}
          </div>
          <p className="oxc-muted" style={{ fontSize: "0.72rem", margin: "0.25rem 0 0" }}>
            {i === 0 ? "Dev wallet → funded by → root source wallet." : "Dev-linked bundle cluster funding chain."}
          </p>
        </div>
      ))}
      {trace?.note ? <p className="oxc-muted" style={{ fontSize: "0.8rem" }}>{trace.note}</p> : null}
      {launches != null && launches >= 2 ? (
        <CheckRow
          label="Source behind other launches"
          value={`${launches} other launch${launches === 1 ? "" : "es"}`}
          state="warn"
          badge="Serial source"
          hint="The wallet that funded this dev is also behind other token launches — a fresh dev wallet on an old source."
        />
      ) : (
        <CheckRow
          label="Source behind other launches"
          value={launches === 0 ? "None known" : launches == null ? "Unknown" : `${launches}`}
          hint="How many other tokens trace back to the same funding source."
        />
      )}
    </div>
  );
}

// ── Same-dev flag + dev history ─────────────────────────────────────────────
export function SameDevPanel({
  forensics,
  sameDev,
  devHistory,
}: {
  forensics: ForensicsPayload | null;
  sameDev?: unknown;
  devHistory?: unknown;
}) {
  const flagged = pickFlag(sameDev, ["flagged", "isSameDev", "match", "sameDev"]);
  const otherMints = pickMintList(sameDev, ["otherMints", "matches", "tokens", "launches", "mints"]);
  const history = pickMintList(devHistory, ["launches", "tokens", "mints", "history"]);
  const serial = forensics?.dev?.serial;
  const tokensCreated = forensics?.dev?.tokensCreated;

  if (otherMints.length > 0 || flagged === true) {
    return (
      <div>
        <CheckRow
          label="Same-dev flag"
          value={flagged === true ? "Flagged — same dev" : "Linked launches found"}
          state="warn"
          badge="Same dev"
          hint="This deployer (or its funding source) has launched other tokens."
        />
        {otherMints.map((m) => (
          <CheckRow key={m} label="Other launch" value={<span className="oxc-mono">{short(m)}</span>} hint={m} />
        ))}
        {history.length > 0 && otherMints.length === 0 ? (
          history.map((m) => (
            <CheckRow key={m} label="Dev history" value={<span className="oxc-mono">{short(m)}</span>} hint={m} />
          ))
        ) : null}
      </div>
    );
  }
  if (serial === true) {
    return (
      <div>
        <CheckRow
          label="Same-dev flag"
          value="Serial deployer"
          state="warn"
          badge="Serial dev"
          hint={`This wallet has launched ${tokensCreated ?? "multiple"} tokens — repeat launches, repeat risk.`}
        />
        <Unavailable
          what="Other launches by this dev"
          reason="The same-dev walk returned no other mints for this wallet — none listed, not assumed absent."
        />
      </div>
    );
  }
  if (serial === false) {
    return (
      <div>
        <CheckRow
          label="Same-dev flag"
          value="No serial pattern"
          state="pass"
          badge="First-time dev"
          hint="Forensics sees no repeat-launch pattern for this wallet."
        />
        <Unavailable
          what="Dev history feed"
          reason="The dev-history walk returned no prior launches for this wallet — the full launch history is unknown beyond forensics."
        />
      </div>
    );
  }
  return (
    <Unavailable
      what="Same-dev / dev history"
      reason="No deployer history returned for this mint — the dev wallet could not be attributed."
    />
  );
}

// ── Live trade tape ─────────────────────────────────────────────────────────
type TapeRow = { side: string | null; price: number | null; amount: number | null; time: string | null };
function parseTradeTape(v: unknown): TapeRow[] {
  let arr: unknown[] = [];
  if (Array.isArray(v)) arr = v;
  else {
    const o = asObj(v);
    if (o) for (const k of ["trades", "events", "tape"]) if (Array.isArray(o[k])) { arr = o[k] as unknown[]; break; }
  }
  return arr.slice(0, 10).map((item) => {
    const o = asObj(item) ?? {};
    return {
      side: asStr(o.side ?? o.type ?? o.direction),
      price: asNum(o.price ?? o.priceUsd),
      amount: asNum(o.amountUsd ?? o.amount ?? o.valueUsd ?? o.size),
      time: asTime(o.time ?? o.timestamp ?? o.at),
    };
  });
}

export function TradeTapePanel({
  dexPairs,
  tradeTape,
}: {
  dexPairs: DexPair[] | null;
  tradeTape?: unknown;
}) {
  const tape = parseTradeTape(tradeTape);
  if (tape.length > 0) {
    return (
      <div>
        {tape.map((t, i) => (
          <CheckRow
            key={i}
            label={`${t.side ? `${t.side.toUpperCase()} ` : "Trade "}${t.time ?? ""}`}
            value={`${t.amount != null ? fmtUsd(t.amount) : "—"}${t.price != null ? ` @ $${t.price}` : ""}`}
          />
        ))}
        <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
          Live trade tape — latest trades as they stream in.
        </p>
      </div>
    );
  }
  if (dexPairs && dexPairs.length > 0) {
    return (
      <div>
        {dexPairs.slice(0, 2).map((p, i) => (
          <div key={p.pairAddress ?? i} style={{ marginBottom: "0.5rem" }}>
            <CheckRow
              label={`${p.dexId ?? "DEX"} pair`}
              value={p.priceUsd != null ? `$${p.priceUsd}` : "Unknown"}
              hint={`24h volume ${fmtUsd(p.volumeH24)} · buys ${p.txnsH24Buys ?? "—"} / sells ${p.txnsH24Sells ?? "—"}`}
            />
          </div>
        ))}
        <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
          Live streaming tape (Team A) is not connected yet — snapshot from DexScreener pair activity, not a live feed.
        </p>
      </div>
    );
  }
  return (
    <Unavailable
      what="Trade tape"
      reason="No pair data returned for this mint — no trades to show."
    />
  );
}

// ── Whale alerts ────────────────────────────────────────────────────────────
type WhaleRow = { wallet: string | null; action: string | null; amount: number | null; pct: number | null; time: string | null };
function parseWhaleAlerts(v: unknown): WhaleRow[] {
  let arr: unknown[] = [];
  if (Array.isArray(v)) arr = v;
  else {
    const o = asObj(v);
    if (o) for (const k of ["alerts", "events", "whales"]) if (Array.isArray(o[k])) { arr = o[k] as unknown[]; break; }
  }
  return arr.slice(0, 8).map((item) => {
    const o = asObj(item) ?? {};
    return {
      wallet: asStr(o.wallet ?? o.address ?? o.owner),
      action: asStr(o.action ?? o.type ?? o.side),
      amount: asNum(o.amountUsd ?? o.amount ?? o.valueUsd),
      pct: asNum(o.pct ?? o.pctOfSupply ?? o.supplyPct),
      time: asTime(o.time ?? o.timestamp ?? o.at),
    };
  });
}

export function WhaleAlertsPanel({
  forensics,
  token,
  whaleAlerts,
}: {
  forensics: ForensicsPayload | null;
  token: TokenPayload | null;
  whaleAlerts?: unknown;
}) {
  const alerts = parseWhaleAlerts(whaleAlerts);
  if (alerts.length > 0) {
    return (
      <div>
        {alerts.map((a, i) => (
          <CheckRow
            key={i}
            label={`${a.action ? `${a.action.toUpperCase()} ` : "Whale "}${a.wallet ? short(a.wallet) : ""}${a.time ? ` · ${a.time}` : ""}`}
            value={`${a.amount != null ? fmtUsd(a.amount) : "—"}${a.pct != null ? ` (${a.pct.toFixed(1)}% of supply)` : ""}`}
          />
        ))}
        <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
          Live whale alerts — large moves as they happen.
        </p>
      </div>
    );
  }
  const holders = (token?.holders ?? [])
    .filter((h) => h.pct != null && Number.isFinite(h.pct))
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))
    .slice(0, 5);
  const whaleCount = forensics?.concentration?.whales;
  if (holders.length > 0 || whaleCount != null) {
    return (
      <div>
        {whaleCount != null ? (
          <CheckRow label="Whale wallets" value={`${whaleCount}`} hint="Wallets holding a whale-sized share (forensics threshold)." />
        ) : null}
        {holders.map((h, i) => (
          <CheckRow
            key={h.owner ?? i}
            label={`Largest holder #${h.rank ?? i + 1}`}
            value={`${(h.pct ?? 0).toFixed(2)}% of supply`}
            hint={h.owner ?? undefined}
          />
        ))}
        <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
          Live whale alerts (Team A) are not connected yet — showing the largest current holders instead. No alert has fired that we know of — unknown, not zero.
        </p>
      </div>
    );
  }
  return (
    <Unavailable
      what="Whale alerts"
      reason="No holder or concentration data returned for this mint — whale activity is unknown."
    />
  );
}

// ── Holder graph (Team C) ───────────────────────────────────────────────────
export function HolderGraphPanel({
  bundle,
  token,
}: {
  bundle: RawBundleAnalysis | null;
  token: TokenPayload | null;
}) {
  // BundleMap first: it renders straight from the live bundle `analysis`.
  // HolderGraph takes holders/traces instead, which this wrapper does not
  // derive — mounting it with bundle/analysis props would draw an empty graph.
  const Graph = teamComponent(["BundleMap", "HolderGraph", "HolderGraphPanel"]);
  if (Graph) {
    return (
      <Suspense fallback={<p className="oxc-empty oxc-pulse">Loading holder graph…</p>}>
        <Graph bundle={bundle} analysis={bundle} token={token} />
      </Suspense>
    );
  }
  if (!bundle) {
    return (
      <Unavailable
        what="Holder graph"
        reason="Team C's holder-graph component has not landed yet, and no bundle scan is available to draw from."
      />
    );
  }
  const clusters = [...(bundle.clusters ?? [])].sort((a, b) => b.supplyPct - a.supplyPct).slice(0, 5);
  return (
    <div>
      <Unavailable
        what="Holder graph visual"
        reason="Team C's holder-graph component has not landed yet — cluster data below comes from the live bundle scan."
      />
      {clusters.length > 0 ? (
        <div style={{ marginTop: "0.5rem" }}>
          {clusters.map((c) => (
            <CheckRow
              key={c.id}
              label={`Cluster ${c.id.slice(0, 8)}`}
              value={`${c.supplyPct.toFixed(1)}% of supply`}
              state={c.devLinked ? "warn" : undefined}
              badge={c.devLinked ? "Dev-linked" : undefined}
              hint={`${c.members.length} wallet${c.members.length === 1 ? "" : "s"}${c.fundingSource ? ` · funded by ${short(c.fundingSource)}` : ""}`}
            />
          ))}
        </div>
      ) : (
        <p className="oxc-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
          No holder clusters detected in the bundle scan.
        </p>
      )}
    </div>
  );
}

// ── Sandbox launch replay (Team F) ──────────────────────────────────────────
export function SandboxReplayPanel({ mint, token }: { mint: string; token: TokenPayload | null }) {
  const Replay = teamComponent(["SandboxReplay", "LaunchReplay"]);
  if (Replay) {
    return (
      <Suspense fallback={<p className="oxc-empty oxc-pulse">Loading launch replay…</p>}>
        <Replay mint={mint} token={token} />
      </Suspense>
    );
  }
  return (
    <Unavailable
      what="Sandbox launch replay"
      reason="Team F's replay component has not landed yet — there is no simulated launch to replay for this token."
    />
  );
}

// ── Shareable scan card + community notes + signal voting (Team E) ─────────
export function SocialScanPanel({
  mint,
  token,
  ogScore,
  riskScore,
  riskLabel,
  flags,
}: {
  mint: string;
  token: TokenPayload | null;
  ogScore: OgScore | null;
  /** Composed risk 0–100 from the live scan (null = unknown). */
  riskScore?: number | null;
  riskLabel?: string | null;
  /** Top real flags from this scan, e.g. bundle / LP-lock / authority. */
  flags?: string[];
}) {
  // SocialPanels is wired directly (CommunityNotes + SignalVoting live in
  // ./SocialPanels, backed by useScanSocial on this device). No invented
  // values: unknown score → unknown verdict.
  const score = ogScore?.score ?? null;
  const verdict =
    score == null
      ? "Scan complete — OG score unknown"
      : score >= 70
        ? `OG score ${Math.round(score)}/100 — looks reasonable`
        : score >= 40
          ? `OG score ${Math.round(score)}/100 — mixed signals, check bundles and holders`
          : `OG score ${Math.round(score)}/100 — high risk, trade with caution`;
  const verdictState = score == null ? "unknown" : score >= 70 ? "pass" : score >= 40 ? "warn" : "fail";
  return (
    <div>
      <SocialPanels
        mint={mint}
        scanCard={{
          name: token?.name ?? "Unknown token",
          symbol: token?.symbol ?? "?",
          ogScore: score,
          verdict,
          verdictState,
          scannedAt: Date.now(),
        }}
      />
      <div style={{ marginTop: "0.75rem" }}>
        <ShareToX
          mint={mint}
          symbol={token?.symbol ?? null}
          name={token?.name ?? null}
          ogScore={score}
          ogBand={ogScore?.band ?? null}
          riskScore={riskScore ?? null}
          riskLabel={riskLabel ?? null}
          flags={flags ?? []}
          verdict={verdict}
        />
      </div>
    </div>
  );
}

/** ── Scanner v2 batch B2 (2026-11-08): sniper radar, liquidity health, ──
 *  dev fingerprint, rug timeline, alert builder. Same honesty rule as B1:
 *  every row is loading / available / "Unavailable — reason", never a fake
 *  zero. Team A liquidity-health verdict (when it lands) is rendered
 *  VERBATIM, not paraphrased. ─────────────────────────────────────────── */

function healthBar(pct: number | null, label: string) {
  const p = pct == null ? null : Math.max(0, Math.min(100, pct));
  return (
    <div style={{ margin: "0.5rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>{p == null ? "Unknown" : `${p.toFixed(0)}%`}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#1c1c1c", border: "1px solid #333", marginTop: 4, overflow: "hidden" }}>
        <div style={{ width: `${p ?? 0}%`, height: "100%", background: p == null ? "#555" : p >= 80 ? "#e8b84a" : p >= 40 ? "#4a90e8" : "#ff5c5c" }} />
      </div>
    </div>
  );
}

// ── B2 · Sniper radar ─────────────────────────────────────────────────────
export function SniperRadarPanel({
  forensics,
  token,
}: {
  forensics: ForensicsPayload | null;
  token: TokenPayload | null;
}) {
  const devWallet = forensics?.dev?.wallet ?? null;
  const holders = (token?.holders ?? []).filter((h) => h.owner);
  const first = forensics?.firstBuyer;
  return (
    <div>
      {first ? (
        <CheckRow
          label="First buyer"
          value={first.wallet ? <span className="oxc-mono">{short(first.wallet)}</span> : "Unknown"}
          state={first.isDev ? "fail" : "unknown"}
          badge={first.isDev ? "Dev-linked" : "Unknown"}
          hint={
            first.note ??
            (first.solSpent != null
              ? `Spent ${first.solSpent.toFixed(2)} SOL on first buy${first.time ? ` · ${fmtTime(first.time)}` : ""}.`
              : "First buyer traced — buy size and timing partially observed.")
          }
        />
      ) : (
        <Unavailable what="First buyer" reason="No first-buyer trace returned — early buys cannot be attributed." />
      )}
      {holders.length ? (
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: "0.5rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
              <th style={{ padding: "0.25rem 0" }}>Wallet</th>
              <th style={{ textAlign: "right" }}>Supply</th>
              <th style={{ textAlign: "right" }}>Flag</th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 10).map((h, i) => (
              <tr key={h.owner ?? i} style={{ borderTop: "1px solid #222" }}>
                <td className="oxc-mono" style={{ padding: "0.25rem 0" }}>{short(h.owner)}</td>
                <td style={{ textAlign: "right" }}>{h.pct != null ? `${h.pct.toFixed(2)}%` : "Unknown"}</td>
                <td style={{ textAlign: "right" }}>{devWallet && h.owner === devWallet ? "Dev wallet" : h.pct != null && h.pct >= 1 ? "Whale" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <Unavailable what="Early holder table" reason="No holder list returned for this mint." />
      )}
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Sniper timing (which wallets bought in the first blocks) is not observed — no block-level sniper feed is
        wired. The table above is the holder list, not a sniper feed.
      </p>
    </div>
  );
}

// ── B2 · Liquidity health meter ───────────────────────────────────────────
export function LiquidityHealthPanel({
  token,
  forensics,
  dexPairs,
  safety,
  liquidityHealth,
}: {
  token: TokenPayload | null;
  forensics: ForensicsPayload | null;
  dexPairs: DexPair[] | null;
  safety: SafetyPayload | null;
  liquidityHealth?: unknown;
}) {
  const deepest = (dexPairs ?? []).reduce<DexPair | null>(
    (best, p) => ((p.liquidityUsd ?? 0) > (best?.liquidityUsd ?? 0) ? p : best),
    null,
  );
  const depth = deepest?.liquidityUsd ?? Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const locked = forensics?.safetyFlags?.lpLockedPct ?? null;
  const rugged = forensics?.safetyFlags?.rugged ?? null;
  // Team A verdict, rendered VERBATIM when present.
  const teamVerdict = asStr(asObj(liquidityHealth)?.verdict ?? asObj(liquidityHealth)?.canDevPullIt);
  const mintRenounced = forensics?.safetyFlags?.mintRenounced ?? null;
  const freezeRenounced = forensics?.safetyFlags?.freezeRenounced ?? null;
  const derivedVerdict =
    rugged === true
      ? "Rugged — LP was removed."
      : locked != null && locked >= 90
        ? "LP mostly locked — the dev cannot pull most of the liquidity."
        : locked != null && locked > 0
          ? "LP partly locked — the dev can still pull the unlocked share."
          : locked === 0
            ? "LP not locked — the dev can pull the liquidity."
            : "LP lock state unknown — do not assume the liquidity is safe.";
  return (
    <div>
      <CheckRow label="Liquidity depth" value={Number.isFinite(depth) ? fmtUsd(depth) : "Unknown"} hint={deepest ? `Deepest pair: ${deepest.dexId ?? "unknown DEX"}.` : "No pair reported liquidity."} />
      {healthBar(locked, "LP locked")}
      <CheckRow label="LP burned" value="Unknown" state="unknown" badge="Unknown" hint="No burn figure is returned by the intel feed — burn % is not guessed." />
      <CheckRow label="Lock expiry" value="Unknown" state="unknown" badge="Unknown" hint="No lock expiry timestamp is returned — the lock could be short-lived." />
      <CheckRow
        label="Can the dev pull it?"
        value={teamVerdict ?? derivedVerdict}
        state={rugged === true ? "fail" : locked != null && locked >= 90 ? "pass" : locked != null && locked > 0 ? "warn" : "unknown"}
        badge={rugged === true ? "Yes — rugged" : locked != null && locked >= 90 ? "Mostly no" : locked != null && locked > 0 ? "Partly" : "Unknown"}
        hint={teamVerdict ? "Verdict verbatim from the liquidity-health feed (Team A)." : "Derived from LP lock % and authority state — no lock expiry observed."}
      />
      <CheckRow label="Mint authority" value={mintRenounced == null ? "Unknown" : mintRenounced ? "Renounced" : "Live"} hint={mintRenounced === false ? "A live mint authority can inflate supply." : undefined} />
      <CheckRow label="Freeze authority" value={freezeRenounced == null ? "Unknown" : freezeRenounced ? "Renounced" : "Live"} hint={freezeRenounced === false ? "A live freeze authority can freeze holder wallets." : undefined} />
      {safety?.roundTripLossPct != null ? (
        <CheckRow label="Round-trip loss (simulated)" value={`${safety.roundTripLossPct.toFixed(1)}%`} hint="Buy + sell simulation from the safety check." />
      ) : null}
    </div>
  );
}

// ── B2 · Dev fingerprint ──────────────────────────────────────────────────
export function DevFingerprintPanel({
  forensics,
  sameDev,
  devHistory,
}: {
  forensics: ForensicsPayload | null;
  sameDev?: unknown;
  devHistory?: unknown;
}) {
  const devWallet = forensics?.dev?.wallet ?? null;
  const sd = asObj(sameDev);
  const dh = asObj(devHistory);
  const flagged = sd ? pickFlag(sd, ["flagged", "isSameDev", "match"]) : null;
  const sdState = asStr(sd?.state);
  const priorTokens = Array.isArray(dh?.tokens) ? (dh?.tokens as unknown[]) : Array.isArray(sd?.priorTokens) ? (sd?.priorTokens as unknown[]) : [];
  const ruggedPriors = priorTokens.filter((t) => asStr(asObj(t)?.outcome) === "rugged").length;
  const tokensCreated = forensics?.dev?.tokensCreated ?? asNum(dh?.count ?? dh?.total) ?? null;
  const evidence: string[] = [];
  if (tokensCreated != null) evidence.push(`${tokensCreated} token${tokensCreated === 1 ? "" : "s"} launched by this dev wallet`);
  if (ruggedPriors > 0) evidence.push(`${ruggedPriors} prior rugged token${ruggedPriors === 1 ? "" : "s"} linked to this dev`);
  if (forensics?.dev?.serial) evidence.push("Serial deployer flag set by forensics");
  if (forensics?.dev?.sold) evidence.push("Dev has sold from this token");
  const confidence =
    sdState === "unknown" && priorTokens.length === 0 && tokensCreated == null
      ? { label: "Unknown", state: "unknown" as VerdictState }
      : flagged === true || ruggedPriors > 0
        ? { label: "High confidence — risky", state: "fail" as VerdictState }
        : flagged === false && tokensCreated != null
          ? { label: "Checked — no match", state: "pass" as VerdictState }
          : { label: "Low confidence", state: "warn" as VerdictState };
  return (
    <div>
      <CheckRow
        label="Dev wallet"
        value={devWallet ? <span className="oxc-mono">{short(devWallet)}</span> : "Unknown"}
        hint="Fingerprint = this wallet's launch history + funding-source matches, not a name or identity."
      />
      <CheckRow label="Confidence" value={confidence.label} state={confidence.state} badge={confidence.label} hint={sdState === "unknown" ? "Same-dev walk returned unknown — unchecked is not clean." : "Confidence is a heuristic over observed on-chain evidence, not an identity check."} />
      {evidence.length ? (
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
          {evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <Unavailable what="Fingerprint evidence" reason="No launch history, prior-token or funding-match evidence was returned for this dev wallet." />
      )}
      {priorTokens.length > 0 ? (
        <div style={{ marginTop: "0.5rem" }}>
          {priorTokens.slice(0, 5).map((t) => {
            const o = asObj(t);
            const mint = asStr(o?.mint) ?? asStr(o?.address);
            const outcome = asStr(o?.outcome) ?? "unknown";
            return mint ? (
              <p key={mint} style={{ margin: "0.15rem 0", fontSize: "0.8rem" }}>
                <a href={`/intel/scanner-v2/${mint}`} className="oxc-mono">{short(mint)}</a> — {outcome}
              </p>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── B2 · Rug timeline ─────────────────────────────────────────────────────
export function RugTimelinePanel({
  forensics,
  token,
  devHistory,
}: {
  forensics: ForensicsPayload | null;
  token: TokenPayload | null;
  devHistory?: unknown;
}) {
  type Ev = { at: number | null; label: string; detail: string };
  const events: Ev[] = [];
  const created = token?.createdAt ? Date.parse(token.createdAt) : NaN;
  if (Number.isFinite(created)) events.push({ at: created, label: "Token created", detail: token?.name ?? token?.symbol ?? "Unknown token" });
  else if (token?.ageDays != null) events.push({ at: null, label: "Token created", detail: `About ${token.ageDays} day${token.ageDays === 1 ? "" : "s"} ago (exact time unknown)` });
  const fb = forensics?.firstBuyer;
  if (fb) events.push({ at: fb.time ?? null, label: "First buy", detail: fb.isDev ? "First buyer is dev-linked" : fb.solSpent != null ? `${fb.solSpent.toFixed(2)} SOL first buy` : "First buy traced" });
  for (const s of forensics?.dexPaid?.services ?? []) {
    events.push({ at: s.at ?? null, label: `DEX ${s.type ?? "service"}`, detail: s.status ?? "observed" });
  }
  if (forensics?.bondingComplete) events.push({ at: null, label: "Bonding curve complete", detail: "Pump.fun graduation reached" });
  if (forensics?.safetyFlags?.rugged === true) events.push({ at: null, label: "LP removed — rugged", detail: "Liquidity pull observed by forensics" });
  const dh = asObj(devHistory);
  if (Array.isArray(dh?.tokens)) {
    for (const t of dh.tokens as unknown[]) {
      if (asStr(asObj(t)?.outcome) === "rugged") {
        events.push({ at: null, label: "Prior token rugged", detail: `Dev's earlier launch ${short(asStr(asObj(t)?.mint) ?? "")} rugged` });
      }
    }
  }
  const dated = events.filter((e) => e.at != null).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  const dateless = events.filter((e) => e.at == null);
  if (!events.length) {
    return <Unavailable what="Rug timeline" reason="No dated events were observed for this token — nothing to place on a timeline." />;
  }
  return (
    <ol style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
      {dated.map((e, i) => (
        <li key={i} style={{ marginBottom: "0.4rem" }}>
          <strong>{e.label}</strong> — {new Date(e.at as number).toLocaleString()}
          <br />
          <span className="oxc-muted">{e.detail}</span>
        </li>
      ))}
      {dateless.map((e, i) => (
        <li key={`u-${i}`} style={{ marginBottom: "0.4rem" }}>
          <strong>{e.label}</strong> — time unknown
          <br />
          <span className="oxc-muted">{e.detail}</span>
        </li>
      ))}
    </ol>
  );
}

// ── B2 · Alert builder (Team E) ───────────────────────────────────────────
export function AlertBuilderPanel({ mint, devWallet }: { mint: string; devWallet?: string | null }) {
  return (
    <Suspense fallback={<p className="oxc-empty oxc-pulse">Loading alert builder…</p>}>
      <AlertBuilder mint={mint} devWallet={devWallet ?? null} />
    </Suspense>
  );
}

/** ── Scanner v2 batch B3 (2026-11-08): token DNA, graduation tracker, ──
 *  dev wallet age tags, contract diff, copycat, holder conviction,
 *  whale labels, rug radar leaderboard. ─────────────────────────────── */

/** Shared props for panels that only need the scan's core payloads. */
export type ScanCore = {
  token: TokenPayload | null;
  forensics: ForensicsPayload | null;
  dexPairs: DexPair[] | null;
  research: ResearchPayload | null;
  mint: string;
};

// ── B3 · Token DNA ────────────────────────────────────────────────────────
export function TokenDnaPanel({ token, research, mint, tokenDna }: { token: TokenPayload | null; research: ResearchPayload | null; mint: string; tokenDna?: TokenDna | null }) {
  const clones = research?.clones ?? [];
  const name = token?.name ?? null;
  const symbol = token?.symbol ?? null;
  const matches = tokenDna?.templateMatches ?? [];
  const hasEvidence = clones.length > 0 || (name != null && symbol != null) || matches.length > 0;
  if (!hasEvidence) {
    return (
      <Unavailable
        what="Token DNA"
        reason="Insufficient data — no name/symbol match evidence and no clone scan returned for this mint."
      />
    );
  }
  return (
    <div>
      <CheckRow label="Name" value={name ?? "Unknown"} hint={name ? "As reported by the token feed." : undefined} />
      <CheckRow label="Symbol" value={symbol ?? "Unknown"} />
      <CheckRow label="Mint" value={<span className="oxc-mono">{short(mint)}</span>} />
      {tokenDna ? (
        <>
          <CheckRow
            label="Best template match"
            value={tokenDna.verdict}
            state={tokenDna.verdict === "insufficient data" ? "unknown" : "unknown"}
            badge={tokenDna.verdict === "insufficient data" ? "Unknown" : "Match"}
            hint="Template match from observed signals only (launchpad, serial dev, bundle %, concentration, sell route). A template with no observed signal is omitted, never scored 0."
          />
          {matches.length ? (
            <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {matches.map((m) => (
                <li key={m.template}>
                  <strong>{m.template}</strong> — {m.matchPct}% match
                  {m.evidence.length ? (
                    <span className="oxc-muted" style={{ display: "block", fontSize: "0.8rem" }}>{m.evidence.join(" · ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Unavailable what="DNA template matches" reason="Insufficient data — no launch template had an observed signal to score." />
          )}
        </>
      ) : (
        <Unavailable what="DNA template matches" reason="Token-DNA builder returned nothing for this scan — template matching needs forensics, bundle and safety data." />
      )}
      {clones.length ? (
        <>
          <CheckRow label="Name/symbol matches" value={`${clones.length} similar token${clones.length === 1 ? "" : "s"}`} hint="Clone scan matches — same or near-identical name/ticker seen on other mints." />
          {clones.slice(0, 5).map((c) => (
            <p key={c.mint ?? c.name} style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>
              <span className="oxc-mono">{short(c.mint ?? "")}</span> — {c.name ?? "?"} ({c.symbol ?? "?"})
              {c.mcap != null ? ` · ${fmtUsd(c.mcap)}` : ""}
            </p>
          ))}
        </>
      ) : (
        <Unavailable what="DNA matches" reason="Insufficient data — the clone scan returned no name/symbol matches for this token." />
      )}
    </div>
  );
}

// ── B3 · Graduation tracker (pump.fun bonding curve) ─────────────────────
export function GraduationTrackerPanel({ forensics, token }: { forensics: ForensicsPayload | null; token: TokenPayload | null }) {
  if (forensics?.isPumpFun === false) {
    return (
      <div>
        <CheckRow label="Graduation" value="Not a pump.fun token" state="unknown" badge="Unknown" hint="Graduation only applies to pump.fun bonding-curve tokens. This token is not one." />
      </div>
    );
  }
  if (forensics?.bondingComplete === true) {
    return (
      <div>
        <CheckRow label="Graduation" value="Graduated" state="pass" badge="Graduated" hint="Bonding curve complete — the token migrated to a DEX pool." />
      </div>
    );
  }
  if (forensics?.isPumpFun !== true) {
    return (
      <Unavailable
        what="Graduation tracker"
        reason="Launchpad not confirmed — the intel feed did not say whether this is a pump.fun token."
      />
    );
  }
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  // Pump.fun graduates near ~$69k mcap (85 SOL curve). Progress is an
  // ESTIMATE from mcap only — labelled as such, never presented as exact.
  const pct = Number.isFinite(mcap) ? Math.min(100, (mcap / 69000) * 100) : null;
  return (
    <div>
      {healthBar(pct, "Bonding curve progress (estimate)")}
      <CheckRow label="Status" value="Still bonding" state="warn" badge="Bonding" hint="Curve not complete yet — the token has not migrated to a DEX pool." />
      <CheckRow
        label="Migration countdown"
        value={pct != null && pct >= 100 ? "Due — mcap past the graduation line" : "Unknown"}
        state="unknown"
        badge="Unknown"
        hint="No live curve-progress feed: the bar above is a rough mcap-based estimate, and no countdown can be computed from it."
      />
    </div>
  );
}

// ── B3 · Dev wallet age tags ──────────────────────────────────────────────
export function DevWalletAgePanel({ forensics, token, walletAges, walletAgesLoading }: { forensics: ForensicsPayload | null; token: TokenPayload | null; walletAges?: WalletAge[] | null; walletAgesLoading?: boolean }) {
  const devWallet = forensics?.dev?.wallet ?? null;
  const tokenAge = token?.ageDays;
  const devAge = (walletAges ?? []).find((w) => devWallet && w.wallet === devWallet) ?? null;
  const ages = walletAges ?? [];
  return (
    <div>
      <CheckRow
        label="Dev wallet"
        value={devWallet ? <span className="oxc-mono">{short(devWallet)}</span> : "Unknown"}
        hint="Age tags describe how long the wallet / token have been observed — a fresh dev wallet behind a fresh token is the classic rug setup."
      />
      <CheckRow label="Token age" value={tokenAge != null ? ageLabel(tokenAge, token?.createdAt ?? null) : "Unknown"} />
      {walletAgesLoading ? (
        <p className="oxc-empty oxc-pulse">Checking wallet ages…</p>
      ) : devAge ? (
        <>
          <CheckRow
            label="Dev wallet age"
            value={devAge.ageDays != null ? ageLabel(devAge.ageDays, null) : "Unknown"}
            state={devAge.label === "fresh" ? "warn" : devAge.label === "aged" ? "pass" : "unknown"}
            badge={devAge.label === "fresh" ? "Fresh" : devAge.label === "aged" ? "Aged" : "Unknown"}
            hint={devAge.firstSeenAt != null ? `Oldest sampled signature: ${fmtTime(devAge.firstSeenAt)} — a lower bound on wallet age, not the wallet's first transaction.` : "No observed transactions for this wallet — age unknown."}
          />
          <CheckRow
            label="Age tag"
            value={devAge.label === "fresh" ? "Fresh dev wallet" : devAge.label === "aged" ? "Aged dev wallet" : "Unknown"}
            state={devAge.label === "fresh" ? "warn" : devAge.label === "aged" ? "pass" : "unknown"}
            badge={devAge.label === "fresh" ? "Fresh" : devAge.label === "aged" ? "Aged" : "Unknown"}
          />
        </>
      ) : ages.length ? (
        <>
          <CheckRow
            label="Dev wallet age"
            value="Unknown"
            state="unknown"
            badge="Unknown"
            hint="The dev wallet was not among the sampled top-holder wallets, so its age was not observed in this scan."
          />
          <CheckRow label="Age tag" value={tokenAge != null && tokenAge < 1 ? "Fresh token (< 1 day)" : tokenAge != null && tokenAge < 7 ? "New token (< 1 week)" : tokenAge != null ? "Established token" : "Unknown"} state={tokenAge != null && tokenAge < 1 ? "warn" : "unknown"} badge={tokenAge != null && tokenAge < 1 ? "Fresh" : "Unknown"} />
        </>
      ) : (
        <>
          <CheckRow
            label="Dev wallet age"
            value="Unknown"
            state="unknown"
            badge="Unknown"
            hint="No wallet ages returned for this scan — the wallet-age walk needs the bundle scan's top holders, and it returned none."
          />
          <CheckRow
            label="Age tag"
            value={tokenAge != null && tokenAge < 1 ? "Fresh token (< 1 day)" : tokenAge != null && tokenAge < 7 ? "New token (< 1 week)" : tokenAge != null ? "Established token" : "Unknown"}
            state={tokenAge != null && tokenAge < 1 ? "warn" : "unknown"}
            badge={tokenAge != null && tokenAge < 1 ? "Fresh" : "Unknown"}
          />
        </>
      )}
      {ages.length > 1 ? (
        <div style={{ marginTop: "0.5rem" }}>
          <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.25rem" }}>Top-holder wallet ages (oldest sampled signature — lower bound):</p>
          {ages.slice(0, 10).map((w) => (
            <CheckRow key={w.wallet} label={short(w.wallet)} value={w.ageDays != null ? ageLabel(w.ageDays, null) : "Unknown"} state={w.label === "fresh" ? "warn" : w.label === "aged" ? "pass" : "unknown"} badge={w.label === "fresh" ? "Fresh" : w.label === "aged" ? "Aged" : "Unknown"} hint={w.firstSeenAt != null ? `First seen ${fmtTime(w.firstSeenAt)}` : "No observed transactions."} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── B3 · Contract diff ────────────────────────────────────────────────────
export function ContractDiffPanel({ forensics, mint }: { forensics: ForensicsPayload | null; mint?: string }) {
  const mintRenounced = forensics?.safetyFlags?.mintRenounced ?? null;
  const freezeRenounced = forensics?.safetyFlags?.freezeRenounced ?? null;
  // Snapshot-powered diff: prior vault snapshot for this mint (the scan
  // before the one that just recorded). No mint / no prior snapshot →
  // honest "no prior observation", never a diff against nothing.
  const prior = mint ? getPriorSnapshot(mint) : null;
  const changes = diffAuthorities({ mintRenounced, freezeRenounced }, prior);
  const templateDiff = buildContractDiff(forensics);
  if (mintRenounced == null && freezeRenounced == null) {
    return (
      <Unavailable
        what="Contract diff"
        reason="No contract snapshot exists to diff against — the authority state was never observed for this mint."
      />
    );
  }
  return (
    <div>
      <CheckRow label="Mint authority" value={mintRenounced == null ? "Unknown" : mintRenounced ? "Renounced" : "Live"} />
      <CheckRow label="Freeze authority" value={freezeRenounced == null ? "Unknown" : freezeRenounced ? "Renounced" : "Live"} />
      {templateDiff.diffs.length > 0 && (
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
          {templateDiff.diffs.map((d) => (
            <li key={d.area}>{d.detail}</li>
          ))}
        </ul>
      )}
      {prior == null ? (
        <Unavailable
          what="Authority changes"
          reason="No prior observation — this is the first recorded scan of this mint in the vault, so there is no earlier authority state to diff against. Re-scan later to compare."
        />
      ) : changes.length > 0 ? (
        <>
          {changes.map((c) => (
            <CheckRow
              key={c.field}
              label={`${c.field} changed`}
              value={`${c.from} → ${c.to}`}
              state="fail"
              badge="Changed"
              hint={`Since the previous scan on ${new Date(c.priorAt).toLocaleString()}.`}
            />
          ))}
        </>
      ) : (
        <CheckRow
          label="Authority changes"
          value="None since last scan"
          state="pass"
          badge="Unchanged"
          hint={`Mint and freeze authorities match the previous scan on ${new Date(prior.scannedAt).toLocaleString()}.`}
        />
      )}
    </div>
  );
}

// ── B3 · Copycat panel ────────────────────────────────────────────────────
export function CopycatPanel({ research }: { research: ResearchPayload | null }) {
  const clones = research?.clones ?? [];
  return (
    <div>
      <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>
        Searched sources: DexScreener token search + the research feed's clone scan. No X or Telegram search is
        wired — copycats named only off-chain are not covered.
      </p>
      {clones.length ? (
        <>
          <CheckRow label="Copycats found" value={`${clones.length}`} state="warn" badge="Copycat" hint="Other mints reusing this name or ticker." />
          {clones.slice(0, 8).map((c) => (
            <p key={c.mint ?? c.name} style={{ margin: "0.2rem 0", fontSize: "0.8rem" }}>
              <a href={`/intel/scanner-v2/${c.mint ?? ""}`} className="oxc-mono">{short(c.mint ?? "")}</a>
              {" — "}{c.name ?? "?"} ({c.symbol ?? "?"}){c.mcap != null ? ` · ${fmtUsd(c.mcap)}` : ""}
            </p>
          ))}
        </>
      ) : (
        <Unavailable
          what="Copycats"
          reason="The clone scan returned no matching mints in the searched sources — that is 'none found in these sources', not proof no copycat exists."
        />
      )}
    </div>
  );
}

// ── B3 · Holder conviction ───────────────────────────────────────────────
export function HolderConvictionPanel({ dexPairs, token, holderConviction }: { dexPairs: DexPair[] | null; token: TokenPayload | null; holderConviction?: HolderConviction | null }) {
  const pair = (dexPairs ?? [])[0] ?? null;
  const buys = (pair?.txnsH24Buys ?? 0) + (pair?.txnsH6Buys ?? 0);
  const sells = (pair?.txnsH24Sells ?? 0) + (pair?.txnsH6Sells ?? 0);
  const holders = token?.holders ?? [];
  const big = holders.filter((h) => (h.pct ?? 0) >= 1).length;
  const conviction = holderConviction ?? null;
  const convHolders = conviction?.holders ?? [];
  const diamond = convHolders.filter((h) => h.label === "diamond").length;
  const paper = convHolders.filter((h) => h.label === "paper").length;
  const unknownHold = convHolders.filter((h) => h.label === "unknown").length;
  if (!pair || (buys === 0 && sells === 0 && holders.length === 0)) {
    if (convHolders.length === 0) {
      return (
        <Unavailable
          what="Holder conviction"
          reason="No trade windows or holder list returned — conviction cannot be measured from nothing."
        />
      );
    }
  }
  const buyShare = buys + sells > 0 ? (buys / (buys + sells)) * 100 : null;
  return (
    <div>
      {convHolders.length ? (
        <>
          <CheckRow
            label="Mean hold time"
            value={conviction?.avgHoldDays != null ? `${conviction.avgHoldDays} days` : "Unknown"}
            hint="Mean days since first buy across holders with a known first buy (bundle traces). Diamond = first buy ≥ 30 days ago; paper = < 30 days."
          />
          <CheckRow label="Diamond hands (≥ 30d)" value={`${diamond} holder${diamond === 1 ? "" : "s"}`} state={diamond > 0 ? "pass" : "unknown"} badge={diamond > 0 ? "Diamond" : "None"} />
          <CheckRow label="Paper hands (< 30d)" value={`${paper} holder${paper === 1 ? "" : "s"}`} state={paper > 0 ? "warn" : "unknown"} badge={paper > 0 ? "Paper" : "None"} />
          {unknownHold > 0 ? <CheckRow label="Hold time unknown" value={`${unknownHold} holder${unknownHold === 1 ? "" : "s"}`} hint="First-buy time unobserved for these holders — not counted as diamond or paper." /> : null}
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: "0.5rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
                <th style={{ padding: "0.25rem 0" }}>Wallet</th>
                <th style={{ textAlign: "right" }}>First buy</th>
                <th style={{ textAlign: "right" }}>Hold</th>
                <th style={{ textAlign: "right" }}>Label</th>
              </tr>
            </thead>
            <tbody>
              {convHolders.slice(0, 10).map((h) => (
                <tr key={h.wallet} style={{ borderTop: "1px solid #222" }}>
                  <td className="oxc-mono" style={{ padding: "0.25rem 0" }}>{short(h.wallet)}</td>
                  <td style={{ textAlign: "right" }}>{h.firstBuyAt != null ? fmtTime(h.firstBuyAt) : "Unknown"}</td>
                  <td style={{ textAlign: "right" }}>{h.holdDays != null ? `${h.holdDays}d` : "Unknown"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: h.label === "diamond" ? "#3dd68c" : h.label === "paper" ? "#e8b84a" : "#ffffff" }}>{h.label}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      ) : (
        <Unavailable what="Holder conviction (wallet-level)" reason="No holder first-buy times returned — wallet-level hold durations cannot be measured from this scan." />
      )}
      <CheckRow label="24h buys vs sells" value={buys + sells > 0 ? `${buys} buys / ${sells} sells` : "Unknown"} hint="DexScreener 24h + 6h transaction windows on the deepest pair." />
      <CheckRow
        label="Buy share"
        value={buyShare != null ? `${buyShare.toFixed(0)}% buys` : "Unknown"}
        state={buyShare == null ? "unknown" : buyShare >= 60 ? "pass" : buyShare <= 40 ? "warn" : "unknown"}
        badge={buyShare == null ? "Unknown" : buyShare >= 60 ? "Buying" : buyShare <= 40 ? "Selling" : "Mixed"}
        hint="Share of counted transactions that are buys. A window, not a wallet-level conviction read."
      />
      <CheckRow label="Holders at 1%+ supply" value={`${big}`} hint="Large holders still holding is weak conviction evidence — their entry price is unknown." />
      <CheckRow label="24h price change" value={pair?.changeH24 != null ? fmtSignedPct(pair.changeH24) : "Unknown"} />
    </div>
  );
}

// ── B3 · Whale labels on holders ──────────────────────────────────────────
export function WhaleLabelsPanel({ token, forensics, whaleLabels }: { token: TokenPayload | null; forensics: ForensicsPayload | null; whaleLabels?: WhaleLabel[] | null }) {
  const devWallet = forensics?.dev?.wallet ?? null;
  const holders = (token?.holders ?? []).filter((h) => h.owner);
  if (whaleLabels && whaleLabels.length > 0) {
    const labelText: Record<string, string> = {
      whale: "Whale — ≥1% of supply or a ≥$5k tape trade",
      "bundle-member": "Bundle member — in a detected coordinated cluster",
      "dev-linked": "Dev-linked — creator wallet or funded by creator",
      sniper: "Sniper — first buy within 60s of pair creation",
    };
    return (
      <div>
        <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0 0 0.5rem" }}>
          Evidence-only labels — a label is attached only when its evidence was observed. No evidence, no label.
        </p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
              <th style={{ padding: "0.25rem 0" }}>Wallet</th>
              <th style={{ textAlign: "right" }}>Labels</th>
            </tr>
          </thead>
          <tbody>
            {whaleLabels.slice(0, 12).map((w) => (
              <tr key={w.wallet} style={{ borderTop: "1px solid #222" }}>
                <td className="oxc-mono" style={{ padding: "0.3rem 0" }}>{short(w.wallet)}{devWallet && w.wallet === devWallet ? " (dev)" : ""}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>
                  {w.labels.map((l) => (
                    <span key={l} title={labelText[l] ?? l} style={{ display: "inline-block", marginLeft: "0.35rem", padding: "0.1rem 0.5rem", borderRadius: 999, border: "1px solid #e8b84a", color: "#e8b84a", fontSize: "0.75rem" }}>{l}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8rem" }} className="oxc-muted">
          {[...new Set(whaleLabels.flatMap((w) => w.labels))].map((l) => (
            <li key={l}>{labelText[l] ?? l}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (!holders.length) {
    return <Unavailable what="Whale labels" reason="No holder list returned for this mint." />;
  }
  if (whaleLabels && whaleLabels.length === 0) {
    return (
      <div>
        <CheckRow label="Whale labels" value="None met the evidence bar" state="unknown" badge="None" hint="No holder was a ≥1% top holder with a ≥$5k tape trade, a bundle member, dev-linked, or a ≤60s sniper — so no evidence-based label was attached. Supply-% labels below are size only, not evidence." />
        {/** Fall through to the size-only table below via the shared render — kept as a plain list. */}
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: "0.5rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
              <th style={{ padding: "0.25rem 0" }}>Wallet</th>
              <th style={{ textAlign: "right" }}>Supply</th>
              <th style={{ textAlign: "right" }}>Size label</th>
            </tr>
          </thead>
          <tbody>
            {holders.slice(0, 12).map((h, i) => (
              <tr key={h.owner ?? i} style={{ borderTop: "1px solid #222" }}>
                <td className="oxc-mono" style={{ padding: "0.25rem 0" }}>{short(h.owner)}</td>
                <td style={{ textAlign: "right" }}>{h.pct != null ? `${h.pct.toFixed(2)}%` : "Unknown"}</td>
                <td style={{ textAlign: "right" }}>{devWallet && h.owner === devWallet ? "DEV" : h.pct != null && h.pct >= 5 ? "Mega whale" : h.pct != null && h.pct >= 1 ? "Whale" : h.pct != null && h.pct >= 0.1 ? "Large holder" : "Holder"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    );
  }
  const label = (pct: number | null | undefined, owner?: string): string => {
    if (devWallet && owner === devWallet) return "DEV";
    if (pct == null) return "Unknown";
    if (pct >= 5) return "Mega whale";
    if (pct >= 1) return "Whale";
    if (pct >= 0.1) return "Large holder";
    return "Holder";
  };
  return (
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
          <th style={{ padding: "0.25rem 0" }}>Wallet</th>
          <th style={{ textAlign: "right" }}>Supply</th>
          <th style={{ textAlign: "right" }}>Label</th>
        </tr>
      </thead>
      <tbody>
        {holders.slice(0, 12).map((h, i) => (
          <tr key={h.owner ?? i} style={{ borderTop: "1px solid #222" }}>
            <td className="oxc-mono" style={{ padding: "0.25rem 0" }}>{short(h.owner)}</td>
            <td style={{ textAlign: "right" }}>{h.pct != null ? `${h.pct.toFixed(2)}%` : "Unknown"}</td>
            <td style={{ textAlign: "right", fontWeight: 700, color: label(h.pct, h.owner) === "DEV" ? "#ff5c5c" : label(h.pct, h.owner).includes("whale") ? "#e8b84a" : "#ffffff" }}>
              {label(h.pct, h.owner)}
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

// ── B3 · Rug radar leaderboard ────────────────────────────────────────────
export function RugRadarLeaderboardPanel() {
  // Built from the scan vault on this device: recorded scans ranked by
  // risk (highest risk score / lowest OG score first). No vault scans →
  // honest empty state, never a leaderboard invented from thin air.
  const ranked = rankVaultByRisk(loadVault());
  const unscorable = ranked.filter((t) => t.latest.riskScore == null && t.latest.ogScore == null).length;
  if (ranked.length === 0) {
    return (
      <div>
        <Unavailable
          what="Rug radar leaderboard"
          reason="No scans recorded yet — the leaderboard ranks tokens you have actually scanned, and the vault is empty. Scan a mint above and it will appear here, riskiest first."
        />
        <p className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
          Unscorable tokens: unknown — with no recorded scans there is nothing to count.
        </p>
      </div>
    );
  }
  return (
    <div>
      <p className="oxc-muted" style={{ fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
        Ranked by risk from your scan vault (this device only) — riskiest first.{" "}
        <a href="/intel/vault" style={{ color: "var(--term-gold)" }}>Open the vault</a>
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
              <th style={{ padding: "0.25rem 0" }}>#</th>
              <th>Token</th>
              <th style={{ textAlign: "right" }}>OG</th>
              <th style={{ textAlign: "right" }}>Risk</th>
              <th style={{ textAlign: "right" }}>Score Δ</th>
              <th style={{ textAlign: "right" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {ranked.slice(0, 10).map((t, i) => (
              <tr key={t.mint} style={{ borderTop: "1px solid #222" }}>
                <td style={{ padding: "0.3rem 0", color: "#ffffff", fontWeight: 700 }}>{i + 1}</td>
                <td>
                  <a href={`/intel/scanner-v2/${t.mint}`} style={{ color: "#ffffff", fontWeight: 700 }}>
                    {t.symbol ? `$${t.symbol}` : `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}`}
                  </a>
                  {t.scanCount > 1 && <span style={{ color: "#9a9a9a", fontSize: "0.75rem" }}> · {t.scanCount} scans</span>}
                </td>
                <td style={{ textAlign: "right", color: "#ffffff" }}>{t.latest.ogScore ?? "—"}</td>
                <td style={{ textAlign: "right", color: t.latest.riskScore != null && t.latest.riskScore >= 70 ? "#ff5c5c" : "#ffffff", fontWeight: 700 }}>
                  {t.latest.riskScore ?? "—"}
                </td>
                <td style={{ textAlign: "right", color: t.scoreDelta == null ? "#9a9a9a" : t.scoreDelta >= 0 ? "#3dd68c" : "#ff5c5c" }}>
                  {t.scoreDelta == null ? "—" : `${t.scoreDelta > 0 ? "+" : ""}${t.scoreDelta}`}
                </td>
                <td style={{ textAlign: "right", color: t.status === "unknown" ? "#9a9a9a" : t.status === "alive" ? "#3dd68c" : "#ff5c5c" }}>
                  {t.status === "unknown" ? "Outcome unknown" : t.status === "alive" ? "Alive" : t.status === "rugged" ? "Rugged" : "Dead"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
        Unscorable tokens: {unscorable} — recorded scans with neither an OG nor a risk score. Status shows
        only when a scan actually knew the outcome; otherwise it says unknown, never guessed.
      </p>
    </div>
  );
}

/** ── Scanner v2 batch B4 (2026-11-08): dev sell simulator, bundle ──
 *  decay, fresh wallet radar, liquidity migration, metadata audit,
 *  holder overlap, entry/exit planner, rug autopsy. ─────────────────── */

/** Constant-product price-impact model, named wherever it is used:
 *  selling `sellUsd` into a pool of `liqUsd` moves price by roughly
 *  sellUsd / (liqUsd + sellUsd). Estimate only — real AMM curves, fees
 *  and MEV differ. */
export const PRICE_IMPACT_MODEL = "Constant-product estimate (x·y=k) from pool liquidity — model estimate, not a quote";

export function priceImpactPct(sellUsd: number, liqUsd: number): number | null {
  if (!Number.isFinite(sellUsd) || !Number.isFinite(liqUsd) || liqUsd <= 0 || sellUsd < 0) return null;
  return (sellUsd / (liqUsd + sellUsd)) * 100;
}

// ── B4 · Dev sell simulator ───────────────────────────────────────────────
export function DevSellSimulatorPanel({
  token,
  devWallet,
  dexPairs,
}: {
  token: TokenPayload | null;
  devWallet: DevWalletIntel | null;
  dexPairs: DexPair[] | null;
}) {
  const [sellPct, setSellPct] = useState(50);
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  const liq = Number((dexPairs ?? [])[0]?.liquidityUsd ?? token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const devHoldingPct = devWallet?.holdingPctOfToken ?? null;
  if (devHoldingPct == null || !Number.isFinite(mcap) || !Number.isFinite(price)) {
    return (
      <Unavailable
        what="Dev sell simulator"
        reason={
          devHoldingPct == null
            ? "The dev's current holding of this token is unknown — a sell cannot be sized without it."
            : "No live price / market cap for this token — the simulation needs both."
        }
      />
    );
  }
  const devHoldingUsd = (devHoldingPct / 100) * mcap;
  const sellUsd = (sellPct / 100) * devHoldingUsd;
  const impact = Number.isFinite(liq) ? priceImpactPct(sellUsd, liq) : null;
  return (
    <div>
      <CheckRow label="Dev holding" value={`${devHoldingPct.toFixed(2)}% of supply (${fmtUsd(devHoldingUsd)})`} hint="Live position from the wallet route." />
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginTop: "0.5rem" }}>
        Dev sells
        <select
          value={sellPct}
          onChange={(e) => setSellPct(Number(e.target.value))}
          style={{ marginLeft: "0.5rem", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.25rem 0.5rem" }}
        >
          {[10, 25, 50, 75, 100].map((p) => (
            <option key={p} value={p}>{p}%</option>
          ))}
        </select>
        {" "}of their bag
      </label>
      <CheckRow label="Sell size" value={fmtUsd(sellUsd)} />
      <CheckRow label="Est. price impact" value={impact != null ? `-${impact.toFixed(1)}%` : "Unknown — no liquidity figure"} state={impact != null && impact >= 20 ? "fail" : impact != null && impact >= 5 ? "warn" : "unknown"} badge={impact != null && impact >= 20 ? "Severe" : impact != null && impact >= 5 ? "Heavy" : "Unknown"} />
      <CheckRow label="Est. price after" value={impact != null ? `$${(price * (1 - impact / 100)).toFixed(6)}` : "Unknown"} />
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>Model: {PRICE_IMPACT_MODEL}.</p>
    </div>
  );
}

// ── B4 · Bundle decay ─────────────────────────────────────────────────────
export function BundleDecayPanel({ bundle, mint }: { bundle: RawBundleAnalysis | null; mint?: string }) {
  const prior = mint ? getPriorSnapshot(mint) : null;
  const decay = bundleDecayFromSnapshots(bundle?.bundledSupplyPct ?? null, prior);
  if (!bundle) {
    return <Unavailable what="Bundle decay" reason="No bundle scan returned — there is no baseline snapshot to decay from." />;
  }
  return (
    <div>
      <CheckRow label="Bundled supply now" value={bundle.bundledSupplyPct != null ? `${bundle.bundledSupplyPct.toFixed(1)}%` : "Unknown"} hint={`Snapshot from ${bundle.analyzedAt ? new Date(bundle.analyzedAt).toLocaleTimeString() : "an unknown time"}.`} />
      {decay == null ? (
        <Unavailable
          what="Bundle decay"
          reason={
            prior == null
              ? "No prior observation — this is the first recorded scan of this mint in the vault, so there is no earlier bundled % to compare against. Re-scan later to track decay."
              : "The prior scan did not record a bundled % — decay cannot be computed without two bundled-% observations."
          }
        />
      ) : (
        <>
          <CheckRow label="Bundled supply then" value={`${decay.priorPct.toFixed(1)}%`} hint={`Previous scan on ${new Date(decay.priorAt).toLocaleString()}.`} />
          <CheckRow
            label="Bundle change"
            value={`${decay.deltaPct >= 0 ? "+" : ""}${decay.deltaPct.toFixed(1)} pts`}
            state={decay.trend === "rising" ? "warn" : decay.trend === "falling" ? "pass" : "unknown"}
            badge={decay.trend === "rising" ? "Bundling up" : decay.trend === "falling" ? "Unwinding" : "Stable"}
            hint="Rising = more supply moving into bundle clusters since the last scan; falling = bundles unwinding."
          />
        </>
      )}
    </div>
  );
}

// ── B4 · Fresh wallet radar ───────────────────────────────────────────────
export function FreshWalletRadarPanel({ bundle }: { bundle: RawBundleAnalysis | null }) {
  const clusters = bundle?.clusters ?? [];
  const fresh = clusters.filter((c) => c.devLinked || (c.fundingChain?.length ?? 0) > 0);
  if (!bundle) {
    return <Unavailable what="Fresh wallet radar" reason="No bundle scan returned — fresh wallets cannot be detected without holder funding traces." />;
  }
  return (
    <div>
      <CheckRow label="Clusters traced" value={`${clusters.length}`} hint="Groups of holders funded from a common source or buying in the same tight window." />
      <CheckRow label="Dev-linked clusters" value={`${clusters.filter((c) => c.devLinked).length}`} hint="Clusters funded by the creator or mint authority — the fresh-wallet signal that matters most." />
      {fresh.length ? (
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
          {fresh.slice(0, 6).map((c, i) => (
            <li key={i}>
              {c.supplyPct != null ? `${c.supplyPct.toFixed(1)}% of supply` : "Cluster"} — funded via{" "}
              <span className="oxc-mono">{short(c.fundingSource ?? c.fundingChain?.[0] ?? "")}</span>
              {c.sourceBehindOtherLaunches ? " · source behind other launches" : ""}
            </li>
          ))}
        </ul>
      ) : (
        <Unavailable what="Fresh wallets" reason="No dev-linked or funding-traced clusters were found — no fresh-wallet pattern observed in this scan." />
      )}
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Freshness here means funded-from-a-common-source, not wallet age — wallet creation times are not observed.
      </p>
    </div>
  );
}

// ── B4 · Liquidity migration ──────────────────────────────────────────────
export function LiquidityMigrationPanel({ forensics, token }: { forensics: ForensicsPayload | null; token: TokenPayload | null }) {
  const checkedAt = new Date().toLocaleTimeString();
  if (forensics?.isPumpFun === false) {
    return (
      <div>
        <CheckRow label="Migration" value="Not a pump.fun token" hint="Only pump.fun tokens migrate from bonding curve to DEX pool." />
        <CheckRow label="Last checked" value={checkedAt} hint="This scan's check time." />
      </div>
    );
  }
  return (
    <div>
      <CheckRow label="Bonding curve" value={forensics?.bondingComplete === true ? "Complete — migrated" : forensics?.bondingComplete === false ? "Still bonding" : "Unknown"} state={forensics?.bondingComplete === true ? "pass" : "unknown"} badge={forensics?.bondingComplete === true ? "Migrated" : "Unknown"} />
      <CheckRow label="Liquidity" value={Number.isFinite(Number(token?.liquidityUsd ?? token?.liquidity)) ? fmtUsd(Number(token?.liquidityUsd ?? token?.liquidity)) : "Unknown"} />
      <CheckRow label="Last checked" value={checkedAt} hint="Migration state as of this scan — re-scan to refresh." />
      {forensics?.bondingComplete !== true ? (
        <Unavailable what="Migration destination" reason="The token has not graduated yet — there is no destination pool to show." />
      ) : null}
    </div>
  );
}

// ── B4 · Metadata audit ───────────────────────────────────────────────────

/** W5 · Metadata update authority — the address that can change the token's
 *  name / symbol / image. Read defensively: no feed in this stack returns a
 *  Metaplex metadata account today, so this is null until one does. Never
 *  invented — absence renders as "not observed". */
export function metadataUpdateAuthority(token: TokenPayload | null): string | null {
  if (!token) return null;
  const direct = token.metadataUpdateAuthority ?? token.updateAuthority;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const meta = token.metadata;
  if (meta && typeof meta === "object") {
    const v = (meta as Record<string, unknown>).updateAuthority;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function MetadataAuditPanel({ token }: { token: TokenPayload | null }) {
  if (!token) return <Unavailable what="Metadata audit" reason="No token data returned for this mint." />;
  const updateAuthority = metadataUpdateAuthority(token);
  const rows: Array<{ label: string; value: string; ok: boolean | null }> = [
    { label: "Name", value: token.name ?? "Missing", ok: token.name ? true : false },
    { label: "Symbol", value: token.symbol ?? "Missing", ok: token.symbol ? true : false },
    { label: "Image / logo", value: token.image ? "Present" : "Missing", ok: token.image ? true : false },
    { label: "Website", value: token.socials?.website ?? "Not listed", ok: token.socials?.website ? true : null },
    { label: "X / Twitter", value: token.socials?.twitter ?? "Not listed", ok: token.socials?.twitter ? true : null },
    { label: "Telegram", value: token.socials?.telegram ?? "Not listed", ok: token.socials?.telegram ? true : null },
  ];
  return (
    <div>
      {rows.map((r) => (
        <CheckRow
          key={r.label}
          label={r.label}
          value={r.value}
          state={r.ok === true ? "pass" : r.ok === false ? "warn" : "unknown"}
          badge={r.ok === true ? "OK" : r.ok === false ? "Missing" : "Unknown"}
        />
      ))}
      <CheckRow
        label="Metadata update authority"
        value={updateAuthority ? <span className="oxc-mono">{short(updateAuthority)}</span> : "Not observed"}
        state={updateAuthority ? "warn" : "unknown"}
        badge={updateAuthority ? "Mutable" : "Unknown"}
        hint={
          updateAuthority
            ? "This address can change the name, symbol and image — metadata is mutable while it holds that power. No feed confirms whether it is the deployer."
            : "Update authority not observed — no metadata account is read in this stack, so mutability cannot be confirmed."
        }
      />
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Audit covers the metadata the feed returned. Mint / freeze authority on the token program is covered by the
        Contract panel — this panel does not re-check it.
      </p>
    </div>
  );
}

// ── B4 · Holder overlap (Team C taste graph) ──────────────────────────────
export function HolderOverlapPanel({ token, holderOverlap, holderOverlapLoading }: { token: TokenPayload | null; holderOverlap?: HolderOverlapEntry[] | null; holderOverlapLoading?: boolean }) {
  const holders = token?.holders ?? [];
  const wallets: OverlapWallet[] | null =
    holderOverlap == null
      ? null
      : holderOverlap.map((e) => ({
          address: e.wallet,
          supplyPct: holders.find((h) => h.owner === e.wallet)?.pct ?? null,
          holdings:
            e.otherHoldings == null
              ? null
              : e.otherHoldings.map((h) => ({ mint: h.mint, symbol: h.symbol ?? null, valueUsd: null })),
        }));
  return (
    <div>
      <HolderOverlapGraph
        wallets={wallets}
        loading={holderOverlapLoading ?? false}
        unavailableReason={
          holderOverlapLoading
            ? "Holder-overlap feed is still loading."
            : holderOverlap == null
              ? "Holder-overlap feed returned nothing for this scan — the overlap graph needs each top holder's other tokens, and no wallet-holdings result came back."
              : holders.length === 0
                ? "No holder list returned for this mint — the overlap graph has no wallets to start from."
                : "Holder-overlap feed returned no wallets — no top-holder portfolios were observed."
        }
      />
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Taste graph: when the wallet-holdings feed returns data, the graph shows which other tokens this token's
        holders also hold. Holdings are read from each wallet's SPL token accounts — unreadable wallets are drawn
        dashed, never filled in.
      </p>
    </div>
  );
}

// ── B4 · Entry / exit planner ─────────────────────────────────────────────

/** W5 · Entry ladder — pure arithmetic on the user's own inputs. Rung 1 buys
 *  at the entry price; each later rung buys a fixed dip lower (5 / 10 / 15%).
 *  Equal dollar split across rungs. Take-profit levels are 2x / 3x / 5x off
 *  the ladder's average entry. Your plan, not a prediction. */
export const LADDER_DIP_STEPS_PCT = [0, 5, 10, 15];
export const LADDER_TP_MULTIPLES = [2, 3, 5];
export const MAX_LADDER_RUNGS = 4;

export type EntryLadderRung = { rung: number; dipPct: number; price: number; sizeUsd: number; tokens: number };
export type EntryLadder = {
  rungs: EntryLadderRung[];
  avgEntry: number;
  totalUsd: number;
  totalTokens: number;
  takeProfits: Array<{ multiple: number; price: number; proceedsUsd: number }>;
};

export function buildEntryLadder(entryPrice: number, totalUsd: number, rungs: number): EntryLadder | null {
  const n = Math.max(2, Math.min(MAX_LADDER_RUNGS, Math.floor(rungs) || 0));
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(totalUsd) || totalUsd <= 0 || n < 2) return null;
  const sizeUsd = totalUsd / n;
  const built: EntryLadderRung[] = LADDER_DIP_STEPS_PCT.slice(0, n).map((dipPct, i) => {
    const price = entryPrice * (1 - dipPct / 100);
    return { rung: i + 1, dipPct, price, sizeUsd, tokens: sizeUsd / price };
  });
  const totalTokens = built.reduce((s, r) => s + r.tokens, 0);
  const avgEntry = totalUsd / totalTokens;
  return {
    rungs: built,
    avgEntry,
    totalUsd,
    totalTokens,
    takeProfits: LADDER_TP_MULTIPLES.map((multiple) => ({
      multiple,
      price: avgEntry * multiple,
      proceedsUsd: totalTokens * avgEntry * multiple,
    })),
  };
}

/** W5 · Risk:reward split for the visual bar — shares of (risk + reward). */
export function riskRewardSplit(riskPct: number, rewardPct: number): { riskShare: number; rewardShare: number } | null {
  if (!Number.isFinite(riskPct) || !Number.isFinite(rewardPct) || riskPct <= 0 || rewardPct <= 0) return null;
  const total = riskPct + rewardPct;
  return { riskShare: (riskPct / total) * 100, rewardShare: (rewardPct / total) * 100 };
}

export function EntryExitPlannerPanel({ token }: { token: TokenPayload | null }) {
  const live = Number(token?.priceUsd ?? token?.price ?? NaN);
  const [entry, setEntry] = useState("");
  const [targetPct, setTargetPct] = useState("100");
  const [stopPct, setStopPct] = useState("20");
  const [totalUsd, setTotalUsd] = useState("100");
  const [ladderRungs, setLadderRungs] = useState(3);
  if (!Number.isFinite(live)) {
    return <Unavailable what="Entry / exit planner" reason="No live price for this token — the planner needs a current price to plan from." />;
  }
  const entryPrice = Number(entry) > 0 ? Number(entry) : live;
  const t = Number(targetPct) || 0;
  const s = Number(stopPct) || 0;
  const targetPrice = entryPrice * (1 + t / 100);
  const stopPrice = entryPrice * (1 - s / 100);
  const rr = s > 0 ? t / s : null;
  const rrSplit = riskRewardSplit(s, t);
  const ladder = buildEntryLadder(entryPrice, Number(totalUsd) || 0, ladderRungs);
  return (
    <div>
      <CheckRow label="Live price" value={`$${live.toFixed(6)}`} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
        <label style={{ fontSize: "0.8rem" }}>
          Entry $ (blank = live)
          <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" placeholder={live.toFixed(6)} style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Target +%
          <input value={targetPct} onChange={(e) => setTargetPct(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Stop -%
          <input value={stopPct} onChange={(e) => setStopPct(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
        </label>
      </div>
      <CheckRow label="Target price" value={`$${targetPrice.toFixed(6)}`} hint={`+${t}% from entry.`} />
      <CheckRow label="Stop price" value={`$${stopPrice.toFixed(6)}`} hint={`-${s}% from entry.`} />
      <CheckRow label="Risk : reward" value={rr != null ? `1 : ${rr.toFixed(2)}` : "Unknown"} hint="Target gain divided by stop loss — your plan, not a prediction." />
      {rrSplit ? (
        <div style={{ marginTop: "0.5rem" }} aria-label={`Risk reward visual: risk ${s}% versus reward ${t}%`}>
          <div style={{ display: "flex", height: "1.4rem", borderRadius: 6, overflow: "hidden", border: "1px solid #444" }}>
            <div style={{ width: `${rrSplit.riskShare}%`, background: "#ff5c5c", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
              Risk -{s}%
            </div>
            <div style={{ width: `${rrSplit.rewardShare}%`, background: "#3dd68c", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
              Reward +{t}%
            </div>
          </div>
          <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.25rem" }}>
            Bar width is proportional to the risk and reward you entered — the same numbers as the ratio above.
          </p>
        </div>
      ) : null}
      <div style={{ borderTop: "1px solid #222", marginTop: "0.75rem", paddingTop: "0.5rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>Entry ladder — your plan, not a prediction</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
          <label style={{ fontSize: "0.8rem" }}>
            Total size (USD)
            <input value={totalUsd} onChange={(e) => setTotalUsd(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
          </label>
          <label style={{ fontSize: "0.8rem" }}>
            Ladder rungs
            <select value={ladderRungs} onChange={(e) => setLadderRungs(Number(e.target.value))} style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} entries</option>
              ))}
            </select>
          </label>
        </div>
        {ladder ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: "0.5rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
                  <th style={{ padding: "0.25rem 0" }}>Rung</th>
                  <th style={{ textAlign: "right" }}>Entry price</th>
                  <th style={{ textAlign: "right" }}>Size</th>
                  <th style={{ textAlign: "right" }}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {ladder.rungs.map((r) => (
                  <tr key={r.rung} style={{ borderTop: "1px solid #222" }}>
                    <td style={{ padding: "0.3rem 0" }}>{r.rung === 1 ? "1 — now" : `${r.rung} — -${r.dipPct}% dip`}</td>
                    <td style={{ textAlign: "right" }}>${r.price.toFixed(6)}</td>
                    <td style={{ textAlign: "right" }}>{fmtUsd(r.sizeUsd)}</td>
                    <td style={{ textAlign: "right" }}>{r.tokens.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "1px solid #222" }}>
                  <td style={{ padding: "0.3rem 0", fontWeight: 700 }}>Average entry</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>${ladder.avgEntry.toFixed(6)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtUsd(ladder.totalUsd)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{ladder.totalTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: "0.5rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
                  <th style={{ padding: "0.25rem 0" }}>Take profit</th>
                  <th style={{ textAlign: "right" }}>Price</th>
                  <th style={{ textAlign: "right" }}>Proceeds (full exit)</th>
                </tr>
              </thead>
              <tbody>
                {ladder.takeProfits.map((tp) => (
                  <tr key={tp.multiple} style={{ borderTop: "1px solid #222" }}>
                    <td style={{ padding: "0.3rem 0" }}>{tp.multiple}x</td>
                    <td style={{ textAlign: "right" }}>${tp.price.toFixed(6)}</td>
                    <td style={{ textAlign: "right" }}>{fmtUsd(tp.proceedsUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Unavailable what="Entry ladder" reason="Enter a total size above zero — the ladder splits it equally across the rungs." />
        )}
        <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
          Rungs buy lower on dips; take-profits are multiples of your average entry. Arithmetic on your inputs and
          the live price only — not a prediction.
        </p>
      </div>
    </div>
  );
}

// ── B4 · Rug autopsy ──────────────────────────────────────────────────────
export function RugAutopsyPanel({ forensics, token }: { forensics: ForensicsPayload | null; token: TokenPayload | null }) {
  const rugged = forensics?.safetyFlags?.rugged ?? null;
  if (rugged !== true) {
    return (
      <div>
        <CheckRow
          label="Rug status"
          value="Not rugged"
          state="pass"
          badge="Alive"
          hint="No LP removal was observed for this token. 'Not rugged' means no rug observed — it is not a guarantee."
        />
        <CheckRow label="LP locked" value={forensics?.safetyFlags?.lpLockedPct != null ? `${forensics.safetyFlags.lpLockedPct.toFixed(0)}%` : "Unknown"} />
        <CheckRow label="Liquidity" value={Number.isFinite(Number(token?.liquidityUsd ?? token?.liquidity)) ? fmtUsd(Number(token?.liquidityUsd ?? token?.liquidity)) : "Unknown"} />
      </div>
    );
  }
  return (
    <div>
      <CheckRow label="Rug status" value="Rugged" state="fail" badge="Rugged" hint="LP removal was observed by forensics." />
      <CheckRow label="Mint authority" value={forensics?.safetyFlags?.mintRenounced == null ? "Unknown" : forensics.safetyFlags.mintRenounced ? "Renounced" : "Live"} />
      <CheckRow label="Freeze authority" value={forensics?.safetyFlags?.freezeRenounced == null ? "Unknown" : forensics.safetyFlags.freezeRenounced ? "Renounced" : "Live"} />
      <CheckRow label="Dev sold" value={forensics?.dev?.sold == null ? "Unknown" : forensics.dev.sold ? "Yes" : "No"} />
      <Unavailable what="Rug timeline detail" reason="The exact removal transaction and time were not returned — see the Rug timeline panel for the dated events that were observed." />
    </div>
  );
}

/** ── Scanner v2 batch B5 (2026-11-08): dev wallet watch, insiders, ──
 *  unlock schedule, wash trading, chart pattern, slippage estimator,
 *  cross-scan compare. ─────────────────────────────────────────────── */

// ── B5 · Live dev wallet watch ────────────────────────────────────────────
export function DevWalletWatchPanel({
  forensics,
  devWallet,
}: {
  forensics: ForensicsPayload | null;
  devWallet: DevWalletIntel | null;
}) {
  const devWalletAddr = forensics?.dev?.wallet ?? devWallet?.wallet ?? null;
  if (!devWallet || !devWallet.available) {
    return (
      <div>
        <CheckRow label="Dev wallet" value={devWalletAddr ? <span className="oxc-mono">{short(devWalletAddr)}</span> : "Unknown"} />
        <Unavailable
          what="Live dev wallet watch"
          reason="The wallet route did not return a live position — there is nothing to watch yet. Re-scan to retry."
        />
      </div>
    );
  }
  return (
    <div>
      <CheckRow label="Dev wallet" value={devWalletAddr ? <span className="oxc-mono">{short(devWalletAddr)}</span> : "Unknown"} hint="Watched wallet — its moves are the earliest rug signal." />
      <CheckRow label="SOL balance" value={devWallet.solBalance != null ? `${devWallet.solBalance.toFixed(2)} SOL` : "Unknown"} />
      <CheckRow label="Holding of this token" value={devWallet.holdingPctOfToken != null ? `${devWallet.holdingPctOfToken.toFixed(2)}%` : "Unknown"} hint={devWallet.holdingPctOfToken != null && devWallet.holdingPctOfToken >= 5 ? "Large dev holding — a dev sell moves this token." : undefined} />
      <CheckRow label="Recent trades" value={devWallet.tradeCount != null ? `${devWallet.tradeCount}` : "Unknown"} />
      <CheckRow label="Portfolio value" value={fmtUsd(devWallet.totalUsd)} />
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Watch is a snapshot from this scan — it does not stream. Re-scan (Refresh) for a fresh read.
      </p>
    </div>
  );
}

// ── B5 · Insiders ─────────────────────────────────────────────────────────
export function InsidersPanel({ bundle, forensics }: { bundle: RawBundleAnalysis | null; forensics: ForensicsPayload | null }) {
  const devLinked = bundle?.devLinkedPct ?? null;
  const devWallets = bundle?.devLinkedWallets ?? [];
  return (
    <div>
      <CheckRow label="Dev-linked supply" value={devLinked != null ? `${devLinked.toFixed(1)}%` : "Unknown"} hint="Supply in wallets funded by the creator or mint authority — the insider share." />
      {devWallets.length ? (
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
          {devWallets.slice(0, 6).map((w) => (
            <li key={w.address}>
              <span className="oxc-mono">{short(w.address)}</span> — {w.supplyPct != null ? `${w.supplyPct.toFixed(2)}%` : "share unknown"} ({w.via === "creator" ? "creator wallet" : "funded by creator"})
            </li>
          ))}
        </ul>
      ) : null}
      <Unavailable
        what="Insider announcement time"
        reason="No announcement time established — no insider allocation, vesting announcement or team statement was observed for this token."
      />
    </div>
  );
}

// ── B5 · Unlock schedule ──────────────────────────────────────────────────
export function UnlockSchedulePanel({ forensics }: { forensics: ForensicsPayload | null }) {
  const locked = forensics?.safetyFlags?.lpLockedPct ?? null;
  return (
    <div>
      <CheckRow label="LP locked" value={locked != null ? `${locked.toFixed(0)}%` : "Unknown"} />
      <Unavailable
        what="Unlock schedule"
        reason="No unlock schedule was published or observed — no cliff dates, vesting tranches or lock expiry are known for this token."
      />
    </div>
  );
}

// ── B5 · Wash trading ─────────────────────────────────────────────────────
export function WashTradingPanel({ dexPairs, washTrading, tapeLoaded }: { dexPairs: DexPair[] | null; washTrading?: WashTrading | null; tapeLoaded?: boolean }) {
  const pair = (dexPairs ?? [])[0] ?? null;
  if (!pair && !washTrading) {
    return <Unavailable what="Wash trading" reason="No pair data returned — wash signals need trade windows." />;
  }
  const buys = pair?.txnsH24Buys ?? null;
  const sells = pair?.txnsH24Sells ?? null;
  const vol = pair?.volumeH24 ?? null;
  const liq = pair?.liquidityUsd ?? null;
  const ratio = buys != null && sells != null && buys + sells > 0 ? buys / (buys + sells) : null;
  const volLiq = vol != null && liq != null && liq > 0 ? vol / liq : null;
  const verdictState: VerdictState =
    washTrading == null ? "unknown" : washTrading.score >= 50 ? "fail" : washTrading.score > 0 ? "warn" : "pass";
  return (
    <div>
      <CheckRow label="24h volume / liquidity" value={volLiq != null ? `${volLiq.toFixed(1)}×` : "Unknown"} hint="Volume many times the pool size can mean wash churn — or a genuinely hot token. Ratio alone proves neither." />
      <CheckRow label="24h buys" value={buys != null ? `${buys}` : "Unknown"} />
      <CheckRow label="24h sells" value={sells != null ? `${sells}` : "Unknown"} />
      <CheckRow label="Buy share" value={ratio != null ? `${(ratio * 100).toFixed(0)}%` : "Unknown"} hint="Near-50/50 with huge volume is the classic wash shape; lopsided flow is not." />
      {washTrading ? (
        tapeLoaded === false ? (
          <Unavailable
            what="Wash verdict"
            reason="Trade tape not loaded yet — the wash detector needs the tape, and it has not returned for this scan."
          />
        ) : (
          <>
            <CheckRow
              label="Wash verdict"
              value={washTrading.verdict}
              state={verdictState}
              badge={washTrading.score >= 50 ? "Strong wash" : washTrading.score > 0 ? "Possible wash" : "No wash pattern"}
              hint="Round-trip detector over the live trade tape: same wallet buying and selling near-equal size within 10 minutes. Score = round-trip volume / total tape volume × 100."
            />
            <CheckRow label="Wash score" value={`${washTrading.score}/100`} state={verdictState} badge={washTrading.score >= 50 ? "High" : washTrading.score > 0 ? "Low" : "Clean"} />
            {washTrading.pairs.length ? (
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
                {washTrading.pairs.slice(0, 5).map((p) => (
                  <li key={p.a}>
                    <span className="oxc-mono">{short(p.a)}</span> — {p.roundTrips} round-trip{p.roundTrips === 1 ? "" : "s"} · {fmtUsd(p.volumeUsd)} wash volume
                  </li>
                ))}
              </ul>
            ) : (
              <p className="oxc-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>No wallet round-tripped on the observed tape.</p>
            )}
          </>
        )
      ) : (
        <Unavailable
          what="Wash verdict"
          reason="No wash-trading result was computed for this scan — the numbers above are raw windows, and any wash call from them alone would be a guess."
        />
      )}
    </div>
  );
}

// ── B5 · Chart pattern ────────────────────────────────────────────────────
export function ChartPatternPanel({ dexPairs, chartPatterns, deepIntelLoading }: { dexPairs: DexPair[] | null; chartPatterns?: ChartPattern[] | null; deepIntelLoading?: boolean }) {
  const pair = (dexPairs ?? [])[0] ?? null;
  const patterns = chartPatterns ?? [];
  if (!pair || (pair.changeM5 == null && pair.changeH1 == null && pair.changeH6 == null && pair.changeH24 == null)) {
    if (patterns.length === 0) {
      return <Unavailable what="Chart pattern" reason="No price-change windows returned for this pair." />;
    }
  }
  const rows: Array<{ label: string; v: number | null }> = [
    { label: "5 min", v: pair?.changeM5 ?? null },
    { label: "1 hour", v: pair?.changeH1 ?? null },
    { label: "6 hours", v: pair?.changeH6 ?? null },
    { label: "24 hours", v: pair?.changeH24 ?? null },
  ];
  const known = rows.filter((r) => r.v != null);
  const ups = known.filter((r) => (r.v ?? 0) > 0).length;
  const pattern = known.length === 0 ? "Unknown" : ups === known.length ? "Uptrend — every window green" : ups === 0 ? "Downtrend — every window red" : "Mixed — windows disagree";
  return (
    <div>
      {rows.map((r) => (
        <CheckRow key={r.label} label={r.label} value={r.v != null ? fmtSignedPct(r.v) : "Unknown"} />
      ))}
      <CheckRow label="Pattern" value={pattern} state={pattern.startsWith("Up") ? "pass" : pattern.startsWith("Down") ? "warn" : "unknown"} badge={pattern.startsWith("Up") ? "Up" : pattern.startsWith("Down") ? "Down" : "Mixed"} hint="Read from DexScreener price-change windows only — a window trend, not a technical-analysis signal, and never a prediction." />
      {deepIntelLoading ? (
        <p className="oxc-empty oxc-pulse">Detecting chart patterns from daily candles…</p>
      ) : patterns.length ? (
        <>
          <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0.75rem 0 0.25rem" }}>
            Detected patterns — real GeckoTerminal daily candles (doji / hammer / engulfing / three-soldiers / three-crows):
          </p>
          {patterns.map((p) => (
            <CheckRow
              key={p.type}
              label={p.type}
              value={p.confidence}
              state={p.type.includes("bearish") || p.type.includes("crows") ? "warn" : p.type.includes("bullish") || p.type.includes("soldiers") ? "pass" : "unknown"}
              badge={p.confidence}
              hint={`${p.detail}${p.detectedAt != null ? ` Detected ${fmtTime(p.detectedAt)}.` : ""}`}
            />
          ))}
        </>
      ) : chartPatterns != null ? (
        <Unavailable
          what="Detected chart patterns"
          reason="No pattern fired on the latest daily candles — either no doji / hammer / engulfing / three-soldiers / three-crows pattern formed, or no candles were returned for this pair."
        />
      ) : null}
    </div>
  );
}

// ── B5 · Slippage estimator ───────────────────────────────────────────────

/** W5 · Liquidity-impact preset sizes (USD) — same CPAMM model as the free
 *  input, one tap instead of typing. */
export const SLIPPAGE_PRESET_SIZES_USD = [100, 500, 1000, 5000];

export function SlippageEstimatorPanel({ token, dexPairs }: { token: TokenPayload | null; dexPairs: DexPair[] | null }) {
  const [sizeUsd, setSizeUsd] = useState("100");
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const liq = Number((dexPairs ?? [])[0]?.liquidityUsd ?? token?.liquidityUsd ?? token?.liquidity ?? NaN);
  if (!Number.isFinite(price) || !Number.isFinite(liq) || liq <= 0) {
    return (
      <Unavailable
        what="Slippage estimator"
        reason={
          !Number.isFinite(price)
            ? "No live price for this token — slippage needs a price."
            : "No liquidity figure for this token — slippage cannot be estimated without pool depth."
        }
      />
    );
  }
  const size = Number(sizeUsd) || 0;
  const impact = priceImpactPct(size, liq);
  const tokensOut = size / price;
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>
        Buy size (USD)
        <input
          value={sizeUsd}
          onChange={(e) => setSizeUsd(e.target.value)}
          inputMode="decimal"
          style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.5rem", marginTop: 4 }}
        />
      </label>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }} role="group" aria-label="Preset buy sizes">
        {SLIPPAGE_PRESET_SIZES_USD.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSizeUsd(String(p))}
            aria-pressed={sizeUsd === String(p)}
            style={{ background: sizeUsd === String(p) ? "#e8b84a" : "#111", color: sizeUsd === String(p) ? "#000" : "#fff", border: "1px solid #444", borderRadius: 999, padding: "0.3rem 0.8rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}
          >
            ${p >= 1000 ? `${p / 1000}k` : p}
          </button>
        ))}
      </div>
      <CheckRow label="Pool liquidity" value={fmtUsd(liq)} />
      <CheckRow label="Est. slippage" value={impact != null ? `${impact.toFixed(2)}%` : "Unknown"} state={impact != null && impact >= 5 ? "warn" : impact != null && impact >= 1 ? "unknown" : "pass"} badge={impact != null && impact >= 5 ? "High" : impact != null && impact >= 1 ? "Noticeable" : "Low"} />
      <CheckRow label="Tokens received (est.)" value={size > 0 ? tokensOut.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"} hint={`At $${price.toFixed(6)} per token, before slippage.`} />
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>Model: {PRICE_IMPACT_MODEL}.</p>
    </div>
  );
}

// ── B5 · Cross-scan compare ───────────────────────────────────────────────
export type CompareSummary = {
  mint: string;
  name: string | null;
  symbol: string | null;
  priceUsd: number | null;
  mcap: number | null;
  liquidityUsd: number | null;
  ogScore: number | null;
  riskScore: number | null;
  top10Pct: number | null;
  lpLockedPct: number | null;
  bundledPct: number | null;
  holders: number | null;
  loading: boolean;
  error: string | null;
};

/** W5 · Compare up to 4 tokens — `?compare=` takes a comma-separated list of
 *  up to 3 extra mints (4 tokens total, each with a full intel pass). */
export const MAX_COMPARE_TOKENS = 4;

export function parseCompareMints(param: string | null | undefined, maxExtra = MAX_COMPARE_TOKENS - 1): string[] {
  if (!param) return [];
  const out: string[] = [];
  for (const part of param.split(",")) {
    const m = part.trim();
    if (m && isValidMint(m) && !out.includes(m)) out.push(m);
    if (out.length >= maxExtra) break;
  }
  return out;
}

export type CompareRow = { label: string; values: string[]; bestIndex: number | null };

/** Pure compare-table builder: same metrics as the old 2-token table, now
 *  across N summaries. `bestIndex` is the best column per metric (gold);
 *  unknowns stay "Unknown" and never win. Market cap and price have no best. */
export function buildCompareRows(summaries: CompareSummary[]): CompareRow[] {
  const num = (v: number | null, fmt: (n: number) => string) => (v == null ? "Unknown" : fmt(v));
  const best = (vals: Array<number | null>, highBetter: boolean | null): number | null => {
    if (highBetter == null) return null;
    let bi: number | null = null;
    vals.forEach((v, i) => {
      if (v == null) return;
      if (bi == null) {
        bi = i;
        return;
      }
      const cur = vals[bi] as number;
      if ((highBetter && v > cur) || (!highBetter && v < cur)) bi = i;
    });
    return bi;
  };
  const metrics: Array<{ label: string; get: (s: CompareSummary) => number | null; fmt: (n: number) => string; highBetter: boolean | null }> = [
    { label: "OG score", get: (s) => s.ogScore, fmt: (n) => `${Math.round(n)}/100`, highBetter: true },
    { label: "Risk score", get: (s) => s.riskScore, fmt: (n) => `${Math.round(n)}/100`, highBetter: true },
    { label: "Market cap", get: (s) => s.mcap, fmt: fmtUsd, highBetter: null },
    { label: "Liquidity", get: (s) => s.liquidityUsd, fmt: fmtUsd, highBetter: true },
    { label: "Price", get: (s) => s.priceUsd, fmt: (n) => `$${n.toFixed(6)}`, highBetter: null },
    { label: "Top-10 holders", get: (s) => s.top10Pct, fmt: (n) => `${n.toFixed(1)}%`, highBetter: false },
    { label: "LP locked", get: (s) => s.lpLockedPct, fmt: (n) => `${n.toFixed(0)}%`, highBetter: true },
    { label: "Bundled supply", get: (s) => s.bundledPct, fmt: (n) => `${n.toFixed(1)}%`, highBetter: false },
    { label: "Holders", get: (s) => s.holders, fmt: (n) => `${n}`, highBetter: true },
  ];
  return metrics.map((m) => {
    const vals = summaries.map(m.get);
    return { label: m.label, values: vals.map((v) => num(v, m.fmt)), bestIndex: best(vals, m.highBetter) };
  });
}

export function CrossScanComparePanel({
  a,
  b,
  c,
  d,
  summaries,
  onSecondMint,
  onAddMint,
  onRemoveMint,
}: {
  a?: CompareSummary | null;
  b?: CompareSummary | null;
  c?: CompareSummary | null;
  d?: CompareSummary | null;
  /** Preferred: full list (up to 4). When omitted, built from a/b/c/d. */
  summaries?: CompareSummary[] | null;
  /** Legacy add-mint callback (kept for existing call sites). */
  onSecondMint?: (mint: string) => void;
  /** Preferred add-mint callback. */
  onAddMint?: (mint: string) => void;
  onRemoveMint?: (mint: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const list = (summaries ?? [a, b, c, d].filter((s): s is CompareSummary => s != null)).slice(0, MAX_COMPARE_TOKENS);
  const addMint = onAddMint ?? onSecondMint;
  const rows = list.length >= 2 ? buildCompareRows(list) : [];
  const canAdd = list.length < MAX_COMPARE_TOKENS && !!addMint;
  const addPlaceholder =
    list.length === 0 ? "First mint to compare…" : list.length === 1 ? "Second mint to compare…" : "Add another mint to compare…";
  return (
    <div>
      {canAdd ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValidMint(draft.trim())) {
              addMint?.(draft.trim());
              setDraft("");
            }
          }}
          style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={addPlaceholder}
            spellCheck={false}
            aria-label="Mint address to add to the comparison"
            style={{ flex: 1, minWidth: 0, background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 8, padding: "0.5rem 0.65rem", fontSize: "0.85rem" }}
          />
          <button type="submit" disabled={!isValidMint(draft.trim())} style={{ background: "#e8b84a", color: "#000", border: "none", borderRadius: 8, padding: "0.5rem 0.9rem", fontWeight: 800, fontSize: "0.85rem", cursor: isValidMint(draft.trim()) ? "pointer" : "default", opacity: isValidMint(draft.trim()) ? 1 : 0.5 }}>
            Compare
          </button>
        </form>
      ) : null}
      {list.length < 2 ? (
        <Unavailable
          what="Cross-scan compare"
          reason={list.length === 1 ? "Enter another mint above to compare it side by side with this token — up to 4 total." : "No tokens loaded to compare yet."}
        />
      ) : (
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
              <th style={{ padding: "0.25rem 0" }}>Metric</th>
              {list.map((s) => (
                <th key={s.mint} style={{ textAlign: "right" }}>
                  {s.symbol ?? short(s.mint)}
                  {onRemoveMint && list.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveMint(s.mint)}
                      aria-label={`Remove ${s.symbol ?? s.mint} from comparison`}
                      title="Remove from comparison"
                      style={{ background: "transparent", color: "#ffffff", border: "1px solid #444", borderRadius: 6, marginLeft: "0.35rem", padding: "0 0.35rem", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      ×
                    </button>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid #222" }}>
                <td style={{ padding: "0.3rem 0" }}>{r.label}</td>
                {r.values.map((v, i) => (
                  <td key={i} style={{ textAlign: "right", fontWeight: r.bestIndex === i ? 800 : 400, color: r.bestIndex === i ? "#e8b84a" : "#ffffff" }}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      {list.length >= 2 ? (
        <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
          Gold = best on that metric across all {list.length} tokens (higher OG/risk score, deeper liquidity, more
          holders, more LP locked, less concentration, less bundling). Market cap and price have no "best" — they are
          shown, not judged. Each token gets a full intel pass; unknowns stay Unknown.
        </p>
      ) : null}
    </div>
  );
}

/** ── W5 · Pool program + address verification ────────────────────────── */

/** Known Solana pool programs — canonical program addresses only. Anything
 *  not in this map renders "Unknown", never guessed. */
export const KNOWN_POOL_PROGRAMS: Record<string, string> = {
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "Raydium AMM v4",
  CPMMoo8L3F4NbTegBCKVNtunBZhdEz3iMR5FfC5x6fM2y: "Raydium CPMM",
  CAMMCzo5yl8w4VFF8KVHrK22GGUQ3W5Nfqg8QYqjvXxZ: "Raydium CLMM",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uMJ9Jv": "pump.fun",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca Whirlpool",
};

export function verifyPoolProgram(poolProgram: string | null | undefined): {
  state: VerdictState;
  label: string;
  programName: string | null;
} {
  if (!poolProgram) {
    return { state: "unknown", label: "Unknown — pool program not observed in this scan", programName: null };
  }
  const name = KNOWN_POOL_PROGRAMS[poolProgram] ?? null;
  if (!name) {
    return {
      state: "unknown",
      label: `Unknown program ${short(poolProgram)} — not a recognised Raydium / pump.fun / Orca program`,
      programName: null,
    };
  }
  return { state: "pass", label: `Verified — ${name}`, programName: name };
}

export function checkMintMatch(
  scannedMint: string | null | undefined,
  tokenMint: string | null | undefined,
  pairCount: number,
): { state: VerdictState; label: string; detail: string } {
  if (!scannedMint) {
    return { state: "unknown", label: "Unknown", detail: "No scanned mint to check against." };
  }
  if (!tokenMint) {
    return {
      state: "unknown",
      label: "Unknown",
      detail: "The token payload carries no mint — it cannot be checked against the scanned mint.",
    };
  }
  if (tokenMint !== scannedMint) {
    return {
      state: "fail",
      label: "MISMATCH — payload mint differs from scanned mint",
      detail: `Scanned ${short(scannedMint)} but the payload is for ${short(tokenMint)} — do not trust this scan.`,
    };
  }
  return {
    state: "pass",
    label: "Matches scanned mint",
    detail:
      pairCount > 0
        ? `${pairCount} DexScreener pair${pairCount === 1 ? "" : "s"} returned for this mint (pair base token = scanned mint).`
        : "No DexScreener pairs returned for this mint, so the pair side could not be cross-checked.",
  };
}

export function PoolVerificationPanel({
  mint,
  token,
  forensics,
  dexPairs,
}: {
  mint: string | null;
  token: TokenPayload | null;
  forensics: ForensicsPayload | null;
  dexPairs: DexPair[] | null;
}) {
  const programs = Array.from(
    new Set(
      (forensics?.concentration?.pools ?? [])
        .map((p) => p.poolProgram)
        .filter((p): p is string => !!p),
    ),
  );
  const program = programs[0] ?? null;
  const verified = verifyPoolProgram(program);
  const dexId = (dexPairs ?? [])[0]?.dexId ?? null;
  const mintCheck = checkMintMatch(mint, token?.mint ?? null, (dexPairs ?? []).length);
  const dexFamily =
    dexId === "raydium" ? "Raydium" : dexId === "pumpfun" ? "pump.fun" : dexId === "orca" ? "Orca" : null;
  const programFamily = verified.programName?.startsWith("Raydium")
    ? "Raydium"
    : verified.programName === "pump.fun"
      ? "pump.fun"
      : verified.programName?.startsWith("Orca")
        ? "Orca"
        : null;
  const disagree = dexFamily != null && programFamily != null && dexFamily !== programFamily;
  return (
    <div>
      <CheckRow
        label="Pool program"
        value={verified.label}
        state={verified.state}
        badge={verified.state === "pass" ? "Verified" : "Unknown"}
        hint={
          programs.length > 1
            ? `Multiple pools observed — showing the first of ${programs.length} distinct programs.`
            : "From the forensics concentration pools; the program id is the on-chain program that owns the pool."
        }
      />
      {program ? (
        <CheckRow label="Program id" value={<span className="oxc-mono">{program}</span>} />
      ) : null}
      <CheckRow
        label="DEX (pair feed)"
        value={dexId ?? "Unknown"}
        state={disagree ? "warn" : undefined}
        badge={disagree ? "Disagrees" : undefined}
        hint={
          disagree
            ? `Pair feed says ${dexId} but the pool program is ${verified.programName} — treat the pool with suspicion.`
            : "DEX label from the DexScreener pair feed."
        }
      />
      <CheckRow
        label="Contract address check"
        value={mintCheck.label}
        state={mintCheck.state}
        badge={mintCheck.state === "pass" ? "Match" : mintCheck.state === "fail" ? "Mismatch" : "Unknown"}
        hint={mintCheck.detail}
      />
      <CheckRow label="Scanned mint" value={mint ? <span className="oxc-mono">{short(mint)}</span> : "—"} />
      <CheckRow
        label="Payload mint"
        value={token?.mint ? <span className="oxc-mono">{short(token.mint)}</span> : "Not returned"}
      />
      <CheckRow
        label="First pair address"
        value={
          (dexPairs ?? [])[0]?.pairAddress ? (
            <span className="oxc-mono">{short((dexPairs ?? [])[0]?.pairAddress)}</span>
          ) : (
            "Unknown — no pair returned"
          )
        }
      />
    </div>
  );
}

/** ── Scanner v2 batch B6 (2026-11-08): exit liquidity / sell stress ──
 *  test, LP drain alert, position size calculator, Token-2022 audit,
 *  top-holder cost basis, RugCheck import, CEX deposit monitoring. ── */

// ── B6 · Exit liquidity / sell stress test ────────────────────────────────
export function ExitLiquidityPanel({ token, dexPairs, exitLiquidity }: { token: TokenPayload | null; dexPairs: DexPair[] | null; exitLiquidity?: ExitLiquidity | null }) {
  const [sizeUsd, setSizeUsd] = useState("1000");
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const liq = Number((dexPairs ?? [])[0]?.liquidityUsd ?? token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const mcap = Number(token?.marketCap ?? token?.mcap ?? NaN);
  if (!Number.isFinite(price) || !Number.isFinite(liq) || liq <= 0) {
    return (
      <Unavailable
        what="Exit liquidity — sell stress test"
        reason={!Number.isFinite(price) ? "No live price for this token." : "No liquidity figure for this token — exit depth cannot be tested without pool depth."}
      />
    );
  }
  const size = Number(sizeUsd) || 0;
  const drops = [0, 10, 25, 50];
  const tenPctSupplyUsd = Number.isFinite(mcap) ? mcap * 0.1 : null;
  const tenPctImpact = tenPctSupplyUsd != null ? priceImpactPct(tenPctSupplyUsd, liq) : null;
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600 }}>
        Your position to exit (USD)
        <input value={sizeUsd} onChange={(e) => setSizeUsd(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.5rem", marginTop: 4 }} />
      </label>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: "0.5rem" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
            <th style={{ padding: "0.25rem 0" }}>Sell if price drops</th>
            <th style={{ textAlign: "right" }}>You receive (est.)</th>
          </tr>
        </thead>
        <tbody>
          {drops.map((d) => {
            const impact = priceImpactPct(size, liq) ?? 0;
            const received = size * (1 - d / 100) * (1 - impact / 100);
            return (
              <tr key={d} style={{ borderTop: "1px solid #222" }}>
                <td style={{ padding: "0.3rem 0" }}>{d === 0 ? "Now" : `After -${d}%`}</td>
                <td style={{ textAlign: "right" }}>${received.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <p className="oxc-muted" style={{ fontSize: "0.72rem", margin: "0.5rem 0" }}>
        Model: {PRICE_IMPACT_MODEL}. "You receive" applies the drop first, then the model slippage.
      </p>
      {exitLiquidity == null ? (
        <Unavailable
          what="Jupiter sell quotes"
          reason="Exit-liquidity feed returned nothing for this scan — no live Jupiter quotes, so no real sell sim is available."
        />
      ) : (
        <>
          <CheckRow
            label="Jupiter sim — 1 SOL worth"
            value={exitLiquidity.sell1Sol ? `${fmtUsd(exitLiquidity.sell1Sol.receivedUsd)} (slippage ${exitLiquidity.sell1Sol.slippagePct.toFixed(2)}%)` : "Cannot compute"}
            state={exitLiquidity.sell1Sol == null ? "unknown" : exitLiquidity.sell1Sol.slippagePct >= 20 ? "fail" : exitLiquidity.sell1Sol.slippagePct >= 5 ? "warn" : "pass"}
            badge={exitLiquidity.sell1Sol == null ? "Unknown" : exitLiquidity.sell1Sol.slippagePct >= 20 ? "Heavy slip" : exitLiquidity.sell1Sol.slippagePct >= 5 ? "Slippage" : "Clean"}
            hint={exitLiquidity.sell1Sol ? "Real Jupiter lite quote (token → SOL, 50bps slippage), converted at the live SOL price — not a model estimate." : (exitLiquidity.reason ?? "Jupiter returned no sell route for this size.")}
          />
          <CheckRow
            label="Jupiter sim — 5 SOL worth"
            value={exitLiquidity.sell5Sol ? `${fmtUsd(exitLiquidity.sell5Sol.receivedUsd)} (slippage ${exitLiquidity.sell5Sol.slippagePct.toFixed(2)}%)` : "Cannot compute"}
            state={exitLiquidity.sell5Sol == null ? "unknown" : exitLiquidity.sell5Sol.slippagePct >= 20 ? "fail" : exitLiquidity.sell5Sol.slippagePct >= 5 ? "warn" : "pass"}
            badge={exitLiquidity.sell5Sol == null ? "Unknown" : exitLiquidity.sell5Sol.slippagePct >= 20 ? "Heavy slip" : exitLiquidity.sell5Sol.slippagePct >= 5 ? "Slippage" : "Clean"}
            hint={exitLiquidity.sell5Sol ? "Real Jupiter lite quote (token → SOL, 50bps slippage), converted at the live SOL price — not a model estimate." : (exitLiquidity.reason ?? "Jupiter returned no sell route for this size.")}
          />
          <CheckRow
            label="Jupiter sim — 10% of supply"
            value={exitLiquidity.sell10PctSupply ? `${fmtUsd(exitLiquidity.sell10PctSupply.receivedUsd)} (slippage ${exitLiquidity.sell10PctSupply.slippagePct.toFixed(2)}%)` : tenPctSupplyUsd != null && tenPctImpact != null ? `${fmtUsd(tenPctSupplyUsd * (1 - tenPctImpact / 100))} (est. -${tenPctImpact.toFixed(1)}% impact)` : "Cannot compute"}
            state={exitLiquidity.sell10PctSupply ? "warn" : tenPctSupplyUsd != null ? "warn" : "unknown"}
            badge={exitLiquidity.sell10PctSupply ? "Live quote" : tenPctSupplyUsd != null ? "Model only" : "Unknown"}
            hint={exitLiquidity.sell10PctSupply ? "Real Jupiter lite quote for selling 10% of supply — not a model estimate." : tenPctSupplyUsd != null ? "No Jupiter route for this size — model estimate shown instead of a quote." : "Cannot compute — no market cap for this token."}
          />
          {exitLiquidity.reason ? (
            <p className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>{exitLiquidity.reason}</p>
          ) : null}
        </>
      )}
      <CheckRow label="Sell size to drop price 10%" value={exitLiquidity?.drop10PctUsd != null ? fmtUsd(exitLiquidity.drop10PctUsd) : "Unknown"} hint="Constant-product depth threshold from live LP depth — the sell size that moves price ~10%." />
      <CheckRow label="Sell size to drop price 25%" value={exitLiquidity?.drop25PctUsd != null ? fmtUsd(exitLiquidity.drop25PctUsd) : "Unknown"} hint="Constant-product depth threshold from live LP depth." />
      <CheckRow label="Sell size to drop price 50%" value={exitLiquidity?.drop50PctUsd != null ? fmtUsd(exitLiquidity.drop50PctUsd) : "Unknown"} hint="Constant-product depth threshold from live LP depth." />
    </div>
  );
}

// ── B6 · LP drain alert ───────────────────────────────────────────────────
export function LpDrainAlertPanel({ forensics, token, mint }: { forensics: ForensicsPayload | null; token: TokenPayload | null; mint?: string }) {
  const rugged = forensics?.safetyFlags?.rugged ?? null;
  const locked = forensics?.safetyFlags?.lpLockedPct ?? null;
  const liq = Number(token?.liquidityUsd ?? token?.liquidity ?? NaN);
  const liqUsd = Number.isFinite(liq) ? liq : null;
  // Snapshot-powered drain: current liquidity vs the prior vault snapshot.
  const prior = mint ? getPriorSnapshot(mint) : null;
  const drain = lpDrainFromSnapshots(liqUsd, prior);
  const drainNode =
    drain == null ? (
      <Unavailable
        what="Liquidity vs last scan"
        reason={
          prior == null
            ? "No prior observation — this is the first recorded scan of this mint in the vault, so there is no earlier liquidity figure to compare against. Re-scan later to track drains."
            : "The prior scan did not record a liquidity figure — a drain % cannot be computed without two liquidity observations."
        }
      />
    ) : (
      <CheckRow
        label="Liquidity vs last scan"
        value={`${fmtUsd(drain.priorLiq)} → ${fmtUsd(drain.currentLiq)} (${drain.dropPct >= 0 ? "−" : "+"}${Math.abs(drain.dropPct).toFixed(1)}%)`}
        state={drain.dropPct >= 50 ? "fail" : drain.dropPct >= 10 ? "warn" : "pass"}
        badge={drain.dropPct >= 50 ? "Draining" : drain.dropPct >= 10 ? "Dropping" : "Stable"}
        hint={`Previous scan on ${new Date(drain.priorAt).toLocaleString()}. A drop here is observed liquidity leaving, not a model estimate.`}
      />
    );
  if (rugged === true) {
    return (
      <div style={{ border: "1px solid #ff5c5c", borderRadius: 10, padding: "0.75rem", background: "#1c0505" }}>
        <strong style={{ color: "#ff5c5c" }}>LP DRAINED — this token rugged.</strong>
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#ffffff" }}>Liquidity was pulled. Do not buy.</p>
      </div>
    );
  }
  if (locked != null && locked < 50) {
    return (
      <div style={{ border: "1px solid #e8b84a", borderRadius: 10, padding: "0.75rem", background: "#1c1505" }}>
        <strong style={{ color: "#e8b84a" }}>LP drain risk — only {locked.toFixed(0)}% of LP is locked.</strong>
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#ffffff" }}>The unlocked share can be pulled at any time. Current liquidity: {Number.isFinite(liq) ? fmtUsd(liq) : "unknown"}.</p>
        <div style={{ marginTop: "0.5rem" }}>{drainNode}</div>
      </div>
    );
  }
  return (
    <div>
      <CheckRow label="LP drain" value={locked != null ? `No drain detected — ${locked.toFixed(0)}% locked` : "No drain detected"} state="pass" badge="No drain" hint={locked == null ? "Lock % itself is unknown, so 'no drain detected' means no removal was observed — not that the LP is locked." : "Liquidity removal was not observed in this scan."} />
      <CheckRow label="Current liquidity" value={Number.isFinite(liq) ? fmtUsd(liq) : "Unknown"} />
      {drainNode}
    </div>
  );
}

// ── B6 · Position size calculator ─────────────────────────────────────────
export function PositionSizePanel({ token }: { token: TokenPayload | null }) {
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const [account, setAccount] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [stopPct, setStopPct] = useState("20");
  const vol = token?.change24h ?? null;
  if (!Number.isFinite(price)) {
    return <Unavailable what="Position size calculator" reason="No live price for this token — position size needs a price." />;
  }
  const acct = Number(account) || 0;
  const risk = Number(riskPct) || 0;
  const stop = Number(stopPct) || 0;
  const riskUsd = (acct * risk) / 100;
  const positionUsd = stop > 0 ? riskUsd / (stop / 100) : null;
  const tokens = positionUsd != null ? positionUsd / price : null;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
        <label style={{ fontSize: "0.8rem" }}>
          Account size (USD)
          <input value={account} onChange={(e) => setAccount(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Risk per trade %
          <input value={riskPct} onChange={(e) => setRiskPct(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Stop distance %
          <input value={stopPct} onChange={(e) => setStopPct(e.target.value)} inputMode="decimal" style={{ width: "100%", boxSizing: "border-box", background: "#111", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "0.4rem", marginTop: 4 }} />
        </label>
      </div>
      <CheckRow label="Live price" value={`$${price.toFixed(6)}`} />
      <CheckRow label="24h volatility (price change)" value={vol != null ? fmtSignedPct(vol) : "Unknown"} hint="24h change is a rough volatility read — it is not a volatility model." />
      <CheckRow label="Risk amount" value={fmtUsd(riskUsd)} hint={`${risk}% of a ${fmtUsd(acct)} account.`} />
      <CheckRow label="Position size" value={positionUsd != null ? fmtUsd(positionUsd) : "Unknown — stop distance must be above 0"} />
      <CheckRow label="Tokens to buy" value={tokens != null ? tokens.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "Unknown"} />
      <CheckRow label="Position in SOL" value="Cannot compute" state="unknown" badge="Unknown" hint="Cannot compute — no SOL/USD price in this scan to convert USD to SOL." />
      <p className="oxc-muted" style={{ fontSize: "0.72rem", marginTop: "0.5rem" }}>
        Position size = risk amount ÷ stop distance. Sizing math, not financial advice.
      </p>
    </div>
  );
}

// ── B6 · Token-2022 extensions audit ──────────────────────────────────────
export function Token2022Panel({ token, token2022Extensions }: { token: TokenPayload | null; token2022Extensions?: Token2022Extensions | null }) {
  const t22 = token2022Extensions ?? null;
  if (t22 == null) {
    return (
      <Unavailable
        what="Token-2022 extensions audit"
        reason="Mint account unreadable — the token program and its extensions could not be observed for this scan."
      />
    );
  }
  const programId =
    t22.isToken2022 === true
      ? "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
      : t22.isToken2022 === false
        ? "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        : null;
  const hasTransferHook = t22.extensions.some((e) => e.name === "transferHook" || e.name === "transfer-hook");
  const hasPermanentDelegate = t22.extensions.some((e) => e.name === "permanentDelegate");
  const hasNonTransferable = t22.extensions.some((e) => e.name === "nonTransferable");
  const hasTransferFee = t22.extensions.some((e) => e.name === "transferFeeConfig" || e.name === "transferFee");
  return (
    <div>
      <CheckRow
        label="Token program"
        value={t22.isToken2022 === true ? "Token-2022" : t22.isToken2022 === false ? "Standard SPL Token" : "Unknown"}
        state={t22.isToken2022 === true ? "warn" : t22.isToken2022 === false ? "pass" : "unknown"}
        badge={t22.isToken2022 === true ? "Token-2022" : t22.isToken2022 === false ? "SPL" : "Unknown"}
        hint={programId ? `Program id ${short(programId)} — decided by the mint account owner, never guessed from the mint.` : "Program owner could not be read from the mint account."}
      />
      {t22.isToken2022 === false ? (
        <p className="oxc-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
          Standard SPL Token program (Tokenkeg) — no Token-2022 extensions apply.
        </p>
      ) : t22.extensions.length ? (
        <>
          <p className="oxc-muted" style={{ fontSize: "0.75rem", margin: "0.5rem 0 0.25rem" }}>
            Extensions on the mint account ({t22.extensions.length}):
          </p>
          {t22.extensions.map((e) => (
            <CheckRow
              key={e.name}
              label={e.name}
              value={e.risk}
              state={e.risk === "high" ? "fail" : e.risk === "medium" ? "warn" : "pass"}
              badge={e.risk}
              hint={e.detail}
            />
          ))}
        </>
      ) : (
        <CheckRow label="Extensions" value="None" state="pass" badge="None" hint="Token-2022 mint with no extensions on the mint account." />
      )}
      {hasTransferHook ? (
        <CheckRow
          label="Transfer-hook drain check"
          value="Transfer hook present — audit the hook program"
          state="fail"
          badge="Hook risk"
          hint="Every transfer invokes an external hook program. A malicious or buggy hook can block transfers, tax them, or move funds — the hook program itself was not audited by this scan, so do not assume it is safe."
        />
      ) : null}
      {hasPermanentDelegate ? (
        <CheckRow label="Permanent delegate" value="Present — delegate can transfer or freeze any holder's tokens" state="fail" badge="High risk" hint="A permanent delegate is a standing drain/freeze power over every holder." />
      ) : null}
      {hasNonTransferable ? (
        <CheckRow label="Non-transferable" value="Tokens cannot be transferred at all" state="fail" badge="High risk" hint="A non-transferable mint cannot be sold onward — exit is impossible." />
      ) : null}
      {hasTransferFee ? (
        <CheckRow label="Transfer fee" value="Transfers can be taxed up to the configured fee" state="warn" badge="Fee" hint="Transfer-fee extension present — selling may cost more than the quoted price." />
      ) : null}
      {t22.reason ? <p className="oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>{t22.reason}</p> : null}
      {token?.mint ? <p className="oxc-mono oxc-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", wordBreak: "break-all" }}>{token.mint}</p> : null}
    </div>
  );
}

// ── B6 · Top-holder cost basis ────────────────────────────────────────────
export function CostBasisPanel({ token, forensics }: { token: TokenPayload | null; forensics: ForensicsPayload | null }) {
  const price = Number(token?.priceUsd ?? token?.price ?? NaN);
  const holders = (token?.holders ?? []).filter((h) => h.owner);
  const devWallet = forensics?.dev?.wallet ?? null;
  if (!holders.length) {
    return <Unavailable what="Top-holder cost basis" reason="No holder list returned for this mint." />;
  }
  return (
    <div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9a9a9a" }}>
            <th style={{ padding: "0.25rem 0" }}>Wallet</th>
            <th style={{ textAlign: "right" }}>Supply</th>
            <th style={{ textAlign: "right" }}>Avg entry</th>
            <th style={{ textAlign: "right" }}>Unrealized PnL</th>
          </tr>
        </thead>
        <tbody>
          {holders.slice(0, 8).map((h, i) => (
            <tr key={h.owner ?? i} style={{ borderTop: "1px solid #222" }}>
              <td className="oxc-mono" style={{ padding: "0.3rem 0" }}>{short(h.owner)}{devWallet && h.owner === devWallet ? " (dev)" : ""}</td>
              <td style={{ textAlign: "right" }}>{h.pct != null ? `${h.pct.toFixed(2)}%` : "Unknown"}</td>
              <td style={{ textAlign: "right" }}>Unknown</td>
              <td style={{ textAlign: "right" }}>Unknown</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <Unavailable
        what="Cost basis"
        reason="Cannot compute — no entry-price feed exists for top holders, so average entry and unrealized PnL (including who is 50× up) cannot be calculated. Current price is shown for reference only."
      />
      {Number.isFinite(price) ? <CheckRow label="Current price (reference)" value={`$${price.toFixed(6)}`} /> : null}
    </div>
  );
}

// ── B6 · RugCheck import ──────────────────────────────────────────────────
export function RugCheckPanel({ rugCheck, safety, mint }: { rugCheck?: unknown; safety?: SafetyPayload | null; mint?: string }) {
  const rc = asObj(rugCheck);
  const score = rc ? asNum(rc.score ?? rc.riskScore ?? rc.rugScore) : null;
  const warnings = rc && Array.isArray(rc.warnings) ? (rc.warnings as unknown[]).map((w) => asStr(w)).filter((w): w is string => !!w) : [];
  const reportUrl = rc ? asStr(rc.reportUrl ?? rc.url ?? rc.link) : null;
  // Snapshot-powered honeypot flip: current honeypot state (buys work but
  // sells blocked) vs the prior vault snapshot for this mint. The
  // useTokenIntel builder always returns flips: [] (no history feed), so
  // the vault snapshots are the history here.
  const honeypotNow =
    safety?.canBuy === true && safety?.canSell === false
      ? true
      : safety?.canSell === true
        ? false
        : null;
  const prior = mint ? getPriorSnapshot(mint) : null;
  const flip = honeypotFlipFromSnapshots(honeypotNow, prior);
  const flipNode =
    flip == null ? (
      <Unavailable
        what="Honeypot flips"
        reason={
          prior == null
            ? "No prior observation — this is the first recorded scan of this mint in the vault, so there is no earlier honeypot state to compare against. Re-scan later to catch flips."
            : "The prior scan did not record a honeypot state — a flip cannot be detected without two honeypot observations."
        }
      />
    ) : flip.flipped ? (
      <CheckRow
        label="Honeypot flip"
        value={flip.from ? "Honeypot → tradable" : "Tradable → honeypot"}
        state="fail"
        badge="Flipped"
        hint={`Honeypot state changed since the previous scan on ${new Date(flip.priorAt).toLocaleString()}.`}
      />
    ) : (
      <CheckRow
        label="Honeypot flip"
        value={flip.to ? "Still honeypot — no flip" : "Still tradable — no flip"}
        state={flip.to ? "fail" : "pass"}
        badge="No flip"
        hint={`Honeypot state matches the previous scan on ${new Date(flip.priorAt).toLocaleString()}.`}
      />
    );
  if (!rc || score == null) {
    const rcReason = rc ? asStr(rc.reason) : null;
    return (
      <div>
        <Unavailable
          what="RugCheck"
          reason={
            rc == null
              ? "RugCheck unavailable — the deep-intel fetch returned nothing for this mint, so RugCheck was never reached."
              : (rcReason ?? "RugCheck returned a report with no score — the API was reached but no score came back.")
          }
        />
        {reportUrl ? (
          <p style={{ marginTop: "0.5rem" }}>
            <a href={reportUrl} target="_blank" rel="noreferrer">Full RugCheck report</a>
          </p>
        ) : null}
        {flipNode}
      </div>
    );
  }
  return (
    <div>
      <CheckRow label="RugCheck score" value={`${score}`} state={score >= 70 ? "fail" : score >= 40 ? "warn" : "pass"} badge={score >= 70 ? "High risk" : score >= 40 ? "Medium" : "Low"} />
      {warnings.length ? (
        <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="oxc-muted" style={{ fontSize: "0.8rem" }}>No warnings returned.</p>
      )}
      {reportUrl ? (
        <p style={{ marginTop: "0.5rem" }}>
          <a href={reportUrl} target="_blank" rel="noreferrer">Full RugCheck report</a>
        </p>
      ) : null}
      {flipNode}
    </div>
  );
}

// ── B6 · CEX deposit monitoring ───────────────────────────────────────────
export function CexDepositPanel() {
  return (
    <Unavailable
      what="CEX deposit monitoring"
      reason="No CEX deposit feed is wired — sends to known exchange hot wallets are not observed by this scan, so nothing can be reported."
    />
  );
}
