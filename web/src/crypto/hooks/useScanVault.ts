/**
 * useScanVault — Scan History Vault (Team E, third batch).
 *
 * Every scan the user runs is saved locally (localStorage, per device):
 * mint, name, symbol, OG score, risk, bundle flag, scanned-at timestamp.
 * Re-scans append a new snapshot, so each token's outcome evolves over
 * time: score then vs now, and rugged / alive / dead status — but ONLY
 * when a later scan actually knows the outcome. Status is NEVER inferred
 * from a score alone; a token with no known outcome is "unknown".
 *
 * Team B integration (TokenScanner): call `recordScan(snapshot)` once a
 * scan completes (or use the `useScanVault` hook's `recordScan`). Render
 * `<ScanVault />` from a vault route/section; it reads the same store.
 * Nothing is seeded — an empty vault says "No scans yet".
 */
import { useCallback, useEffect, useState } from "react";

export type ScanOutcome = "alive" | "rugged" | "dead";
export type VaultStatus = ScanOutcome | "unknown";

export interface ScanSnapshot {
  mint: string;
  name?: string | null;
  symbol?: string | null;
  /** OG score 0–100, higher = safer. Null = unknown at scan time. */
  ogScore?: number | null;
  /** Composed risk 0–100, higher = riskier. Null = unknown. */
  riskScore?: number | null;
  bundleRisk?: "low" | "moderate" | "high" | null;
  bundledSupplyPct?: number | null;
  verdict?: string | null;
  /**
   * Outcome ONLY when the scan actually knows it (e.g. forensics flagged
   * a rug / honeypot, or liquidity is gone). Leave null otherwise — the
   * vault reports "unknown", never guesses.
   */
  outcome?: ScanOutcome | null;
  scannedAt: number;
  /** Forensics snapshot (W2): authority + LP + honeypot + liquidity at
   *  scan time, so later scans can diff against this observation. */
  mintRenounced?: boolean | null;
  freezeRenounced?: boolean | null;
  lpLockedPct?: number | null;
  /** Honeypot at scan time: true = buys work but sells blocked,
   *  false = sells work, null = unknown. */
  honeypot?: boolean | null;
  liquidityUsd?: number | null;
}

export interface VaultToken {
  mint: string;
  name: string | null;
  symbol: string | null;
  /** Newest-first snapshots. */
  scans: ScanSnapshot[];
  first: ScanSnapshot;
  latest: ScanSnapshot;
  scanCount: number;
  status: VaultStatus;
  /** latest OG score minus first OG score; null when either is unknown. */
  scoreDelta: number | null;
  firstScannedAt: number;
  lastScannedAt: number;
}

export const SCAN_VAULT_KEY = "orbitx:scan-vault:v1";
const MAX_TOKENS = 200;
const MAX_SNAPS_PER_TOKEN = 50;

function isAddr(v: string | null | undefined): boolean {
  return typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitizeSnapshot(raw: unknown): ScanSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<ScanSnapshot>;
  if (!isAddr(s.mint) || typeof s.scannedAt !== "number") return null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const outcome =
    s.outcome === "alive" || s.outcome === "rugged" || s.outcome === "dead" ? s.outcome : null;
  return {
    mint: s.mint as string,
    name: typeof s.name === "string" ? s.name : null,
    symbol: typeof s.symbol === "string" ? s.symbol : null,
    ogScore: num(s.ogScore),
    riskScore: num(s.riskScore),
    bundleRisk:
      s.bundleRisk === "low" || s.bundleRisk === "moderate" || s.bundleRisk === "high"
        ? s.bundleRisk
        : null,
    bundledSupplyPct: num(s.bundledSupplyPct),
    verdict: typeof s.verdict === "string" ? s.verdict : null,
    outcome,
    scannedAt: s.scannedAt,
    mintRenounced: bool(s.mintRenounced),
    freezeRenounced: bool(s.freezeRenounced),
    lpLockedPct: num(s.lpLockedPct),
    honeypot: bool(s.honeypot),
    liquidityUsd: num(s.liquidityUsd),
  };
}

/** Status comes from the NEWEST snapshot that actually knows an outcome.
 *  No known outcome anywhere → "unknown". Scores never imply an outcome. */
export function deriveStatus(scans: ScanSnapshot[]): VaultStatus {
  const sorted = [...scans].sort((a, b) => b.scannedAt - a.scannedAt);
  for (const s of sorted) {
    if (s.outcome) return s.outcome;
  }
  return "unknown";
}

export function toVaultToken(mint: string, scans: ScanSnapshot[]): VaultToken | null {
  const sorted = [...scans].sort((a, b) => b.scannedAt - a.scannedAt);
  if (sorted.length === 0) return null;
  const latest = sorted[0];
  const first = sorted[sorted.length - 1];
  const scoreDelta =
    latest.ogScore != null && first.ogScore != null ? latest.ogScore - first.ogScore : null;
  return {
    mint,
    name: latest.name ?? first.name ?? null,
    symbol: latest.symbol ?? first.symbol ?? null,
    scans: sorted,
    first,
    latest,
    scanCount: sorted.length,
    status: deriveStatus(sorted),
    scoreDelta,
    firstScannedAt: first.scannedAt,
    lastScannedAt: latest.scannedAt,
  };
}

/** Raw stored shape: mint → snapshots (newest-first). */
export function loadVaultRaw(): Record<string, ScanSnapshot[]> {
  const store = safeStorage();
  if (!store) return {};
  try {
    const parsed: unknown = JSON.parse(store.getItem(SCAN_VAULT_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, ScanSnapshot[]> = {};
    for (const [mint, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isAddr(mint) || !Array.isArray(list)) continue;
      const snaps = list
        .map(sanitizeSnapshot)
        .filter((s): s is ScanSnapshot => s !== null)
        .sort((a, b) => b.scannedAt - a.scannedAt)
        .slice(0, MAX_SNAPS_PER_TOKEN);
      if (snaps.length > 0) out[mint] = snaps;
    }
    return out;
  } catch {
    return {};
  }
}

export function loadVault(): VaultToken[] {
  const raw = loadVaultRaw();
  return Object.entries(raw)
    .map(([mint, scans]) => toVaultToken(mint, scans))
    .filter((t): t is VaultToken => t !== null)
    .sort((a, b) => b.lastScannedAt - a.lastScannedAt)
    .slice(0, MAX_TOKENS);
}

/** ── W2 snapshot-powered history ─────────────────────────────────────────
 *  Panels diff the CURRENT scan against the vault's stored snapshots for
 *  the same mint. The newest snapshot is the scan that just recorded, so
 *  the "prior observation" is the SECOND newest snapshot — never the
 *  current one. No prior snapshot → null, and panels say so honestly. ── */

/** All snapshots for a mint, newest-first. Empty when never scanned. */
export function getSnapshotHistory(mint: string): ScanSnapshot[] {
  if (!isAddr(mint)) return [];
  return loadVaultRaw()[mint] ?? [];
}

/** Newest snapshot for a mint (usually the scan that just completed). */
export function getLastSnapshot(mint: string): ScanSnapshot | null {
  return getSnapshotHistory(mint)[0] ?? null;
}

/** The snapshot BEFORE the newest — the prior observation to diff against. */
export function getPriorSnapshot(mint: string): ScanSnapshot | null {
  return getSnapshotHistory(mint)[1] ?? null;
}

export type AuthorityDiff = {
  field: "Mint authority" | "Freeze authority";
  from: string;
  to: string;
  priorAt: number;
};

/** Authority changes between the current scan and the prior snapshot.
 *  A field is only reported when BOTH observations actually knew it. */
export function diffAuthorities(
  current: { mintRenounced?: boolean | null; freezeRenounced?: boolean | null },
  prior: ScanSnapshot | null,
): AuthorityDiff[] {
  if (!prior) return [];
  const label = (v: boolean | null | undefined): string | null =>
    v === true ? "Renounced" : v === false ? "Live" : null;
  const out: AuthorityDiff[] = [];
  const pairs: Array<[AuthorityDiff["field"], boolean | null | undefined, boolean | null | undefined]> = [
    ["Mint authority", current.mintRenounced, prior.mintRenounced],
    ["Freeze authority", current.freezeRenounced, prior.freezeRenounced],
  ];
  for (const [field, now, then] of pairs) {
    const from = label(then);
    const to = label(now);
    if (from != null && to != null && from !== to) out.push({ field, from, to, priorAt: prior.scannedAt });
  }
  return out;
}

export type HoneypotFlipResult = {
  flipped: boolean;
  from: boolean | null;
  to: boolean | null;
  priorAt: number;
};

/** Compare current honeypot state vs the prior snapshot. Null when there
 *  is no prior snapshot that knew the honeypot state. */
export function honeypotFlipFromSnapshots(
  currentHoneypot: boolean | null,
  prior: ScanSnapshot | null,
): HoneypotFlipResult | null {
  if (!prior || prior.honeypot == null || currentHoneypot == null) return null;
  return {
    flipped: prior.honeypot !== currentHoneypot,
    from: prior.honeypot,
    to: currentHoneypot,
    priorAt: prior.scannedAt,
  };
}

export type BundleDecayResult = {
  priorPct: number;
  currentPct: number;
  /** current minus prior, in percentage points. Negative = bundles unwinding. */
  deltaPct: number;
  trend: "rising" | "falling" | "stable";
  priorAt: number;
};

/** Bundled-% trend vs the prior snapshot. Null when no prior snapshot
 *  recorded a bundled % (or there is no prior snapshot at all). */
export function bundleDecayFromSnapshots(
  currentPct: number | null,
  prior: ScanSnapshot | null,
): BundleDecayResult | null {
  if (currentPct == null || !prior || prior.bundledSupplyPct == null) return null;
  const deltaPct = currentPct - prior.bundledSupplyPct;
  return {
    priorPct: prior.bundledSupplyPct,
    currentPct,
    deltaPct,
    trend: deltaPct > 0.5 ? "rising" : deltaPct < -0.5 ? "falling" : "stable",
    priorAt: prior.scannedAt,
  };
}

export type LpDrainResult = {
  priorLiq: number;
  currentLiq: number;
  /** Liquidity lost since the prior snapshot, as % of prior liquidity. */
  dropPct: number;
  priorAt: number;
};

/** Liquidity drain vs the prior snapshot. Null when no prior snapshot
 *  recorded liquidity (or there is no prior snapshot at all). */
export function lpDrainFromSnapshots(
  currentLiq: number | null,
  prior: ScanSnapshot | null,
): LpDrainResult | null {
  if (currentLiq == null || !prior || prior.liquidityUsd == null || prior.liquidityUsd <= 0) return null;
  return {
    priorLiq: prior.liquidityUsd,
    currentLiq,
    dropPct: ((prior.liquidityUsd - currentLiq) / prior.liquidityUsd) * 100,
    priorAt: prior.scannedAt,
  };
}

/** Rug-radar ranking: riskiest first — highest risk score, then lowest OG
 *  score. Tokens with no known risk score sort last (unknown, not safe). */
export function rankVaultByRisk(tokens: VaultToken[]): VaultToken[] {
  return [...tokens].sort((a, b) => {
    const ra = a.latest.riskScore;
    const rb = b.latest.riskScore;
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    if (ra != null && rb == null) return -1;
    if (ra == null && rb != null) return 1;
    const oa = a.latest.ogScore;
    const ob = b.latest.ogScore;
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    return b.lastScannedAt - a.lastScannedAt;
  });
}

function persistRaw(raw: Record<string, ScanSnapshot[]>): void {
  try {
    safeStorage()?.setItem(SCAN_VAULT_KEY, JSON.stringify(raw));
  } catch {
    /* storage full/blocked — in-memory state still works for the session */
  }
}

/** Append one scan snapshot. Returns the updated vault (newest-first). */
export function recordScan(snap: ScanSnapshot): VaultToken[] {
  if (!isAddr(snap.mint)) return loadVault();
  const clean = sanitizeSnapshot(snap);
  if (!clean) return loadVault();
  const raw = loadVaultRaw();
  const list = [clean, ...(raw[clean.mint] ?? [])]
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, MAX_SNAPS_PER_TOKEN);
  raw[clean.mint] = list;
  // Trim oldest tokens if over the cap.
  const entries = Object.entries(raw).sort(
    ([, a], [, b]) => (b[0]?.scannedAt ?? 0) - (a[0]?.scannedAt ?? 0),
  );
  const trimmed: Record<string, ScanSnapshot[]> = {};
  for (const [mint, snaps] of entries.slice(0, MAX_TOKENS)) trimmed[mint] = snaps;
  persistRaw(trimmed);
  return loadVault();
}

export function removeVaultToken(mint: string): VaultToken[] {
  const raw = loadVaultRaw();
  delete raw[mint];
  persistRaw(raw);
  return loadVault();
}

export function clearVault(): VaultToken[] {
  try {
    safeStorage()?.removeItem(SCAN_VAULT_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export interface UseScanVault {
  tokens: VaultToken[];
  totalScans: number;
  record: (snap: ScanSnapshot) => void;
  removeToken: (mint: string) => void;
  clear: () => void;
}

export function useScanVault(): UseScanVault {
  const [tokens, setTokens] = useState<VaultToken[]>([]);

  useEffect(() => {
    setTokens(loadVault());
  }, []);

  const record = useCallback((snap: ScanSnapshot) => {
    setTokens(recordScan(snap));
  }, []);

  const removeToken = useCallback((mint: string) => {
    setTokens(removeVaultToken(mint));
  }, []);

  const clear = useCallback(() => {
    setTokens(clearVault());
  }, []);

  const totalScans = tokens.reduce((n, t) => n + t.scanCount, 0);

  return { tokens, totalScans, record, removeToken, clear };
}
