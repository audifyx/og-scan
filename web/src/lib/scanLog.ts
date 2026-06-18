// ============================================================
// OG Scan — Append-only scan logging + public metrics (section 10)
// Writes every classification into the immutable ogi_scan_log,
// records an audit-trail event, upserts the token registry node,
// and reads aggregated public transparency metrics.
// All writes are best-effort and never throw into the scan flow.
// ============================================================

import { supabase } from "./supabase";
import type { OgClassification } from "./classification";
import { ENGINE_VERSION } from "./classification";

export type ScanLogRecord = {
  mint: string;
  chain?: string;
  symbol?: string | null;
  name?: string | null;
  scannerHandle?: string | null;
};

export type PublicMetrics = {
  total_scans: number;
  unique_tokens: number;
  scans_24h: number;
  og_count: number;
  safe_count: number;
  risky_count: number;
  dangerous_count: number;
};

export type TopScannedRow = {
  mint: string;
  symbol: string | null;
  name: string | null;
  scan_count: number;
  common_tier: string;
  avg_confidence: number;
  last_scanned: string;
};

/**
 * Persist a classification result to the append-only intelligence log.
 * Returns the inserted row id, or null on failure (non-fatal).
 */
export async function logScan(
  record: ScanLogRecord,
  result: OgClassification,
): Promise<string | null> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const scannedBy = auth?.user?.id ?? null;

    const { data, error } = await supabase
      .from("ogi_scan_log")
      .insert({
        mint: record.mint,
        chain: record.chain ?? "solana",
        symbol: record.symbol ?? null,
        name: record.name ?? null,
        tier: result.tier,
        confidence: result.confidence,
        risk_score: result.riskScore,
        signals: result.signals,
        rationale: result.rationale,
        scanned_by: scannedBy,
        scanner_handle: record.scannerHandle ?? null,
        engine_version: ENGINE_VERSION,
      })
      .select("id")
      .single();

    if (error) throw error;

    // best-effort audit + registry upsert (fire and forget)
    void supabase.from("ogi_audit_log").insert({
      event_type: "scan",
      mint: record.mint,
      actor: scannedBy,
      actor_handle: record.scannerHandle ?? null,
      detail: { tier: result.tier, confidence: result.confidence, risk_score: result.riskScore },
    });
    void supabase.from("ogi_token_node").upsert(
      {
        mint: record.mint,
        chain: record.chain ?? "solana",
        symbol: record.symbol ?? null,
        name: record.name ?? null,
        is_og: result.tier === "OG_TOKEN",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mint" },
    );

    return data?.id ?? null;
  } catch (err) {
    console.warn("[scanLog] failed to persist scan", err);
    return null;
  }
}

/** Read aggregated public transparency metrics. */
export async function getPublicMetrics(): Promise<PublicMetrics | null> {
  const { data, error } = await supabase
    .from("ogi_public_metrics")
    .select("*")
    .single();
  if (error) {
    console.warn("[scanLog] metrics fetch failed", error);
    return null;
  }
  return data as PublicMetrics;
}

/** Read the most-scanned tokens (public explorer). */
export async function getTopScanned(limit = 25): Promise<TopScannedRow[]> {
  const { data, error } = await supabase
    .from("ogi_top_scanned")
    .select("*")
    .limit(limit);
  if (error) {
    console.warn("[scanLog] top-scanned fetch failed", error);
    return [];
  }
  return (data ?? []) as TopScannedRow[];
}

/** Read recent scans for a single mint (token history). */
export async function getScanHistoryForMint(mint: string, limit = 50) {
  const { data, error } = await supabase
    .from("ogi_scan_log")
    .select("id, tier, confidence, risk_score, rationale, scanner_handle, created_at")
    .eq("mint", mint)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[scanLog] history fetch failed", error);
    return [];
  }
  return data ?? [];
}

// ── Social / attribution + trend helpers (section D, 8, 9) ──

export type ShareChannel = "x" | "telegram" | "card" | "link";

/** Record a share event for attribution + virality analytics. */
export async function logShare(mint: string, channel: ShareChannel, handle?: string | null, scanId?: string | null): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("ogi_share_event").insert({
      mint, channel, handle: handle ?? null,
      shared_by: auth?.user?.id ?? null, scan_id: scanId ?? null,
    });
  } catch (err) {
    console.warn("[scanLog] share log failed", err);
  }
}

export type LeaderboardRow = {
  handle: string;
  total_scans: number;
  og_finds: number;
  unique_tokens: number;
  last_active: string;
};

export async function getScannerLeaderboard(limit = 25): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.from("ogi_scanner_leaderboard").select("*").limit(limit);
  if (error) { console.warn("[scanLog] leaderboard failed", error); return []; }
  return (data ?? []) as LeaderboardRow[];
}

export type TrendingRow = { mint: string; symbol: string | null; name: string | null; scans_24h: number; common_tier: string };

export async function getTrendingScans(limit = 50): Promise<TrendingRow[]> {
  const { data, error } = await supabase.from("ogi_trending_scans").select("*").limit(limit);
  if (error) { console.warn("[scanLog] trending failed", error); return []; }
  return (data ?? []) as TrendingRow[];
}

/** Recent scans across all tokens (public history explorer). */
export async function getRecentScans(limit = 50) {
  const { data, error } = await supabase
    .from("ogi_scan_log")
    .select("id, mint, symbol, name, tier, confidence, risk_score, scanner_handle, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.warn("[scanLog] recent failed", error); return []; }
  return data ?? [];
}

/** Capture a trend snapshot for time-series velocity. */
export async function captureTrendSnapshot(mint: string, m: { priceUsd?: number; volume24h?: number; liquidityUsd?: number; velocity?: number }): Promise<void> {
  try {
    await supabase.from("ogi_trend_snapshot").insert({
      mint, price_usd: m.priceUsd ?? null, volume_24h: m.volume24h ?? null,
      liquidity_usd: m.liquidityUsd ?? null, velocity: m.velocity ?? null,
    });
  } catch (err) {
    console.warn("[scanLog] snapshot failed", err);
  }
}
