import type { CSSProperties, ReactNode } from "react";
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
import type { DexPair, ForensicsPayload, ResearchPayload, SafetyPayload, TokenPayload } from "../api/client";
import {
  ageLabel,
  authorityVerdict,
  cloneVerdict,
  concentrationBand,
  honeypotChecks,
  lpLockState,
  type OgScore,
  type VerdictState,
} from "../hooks/useTokenIntel";

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

export function OgScorePanel({ ogScore }: { ogScore: OgScore | null }) {
  if (!ogScore) return <p className="oxc-empty">Score pending — waiting on scan data.</p>;
  if (ogScore.score == null) {
    return (
      <div>
        <p className="oxc-empty">Unverified — not enough signals came back to score this token.</p>
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