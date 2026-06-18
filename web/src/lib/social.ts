// ============================================================
// OG Scan — Social Distribution Layer (spec section D & 9)
// X (Twitter) share generator, viral scan cards, Telegram
// alerts, and scan attribution. Pure & dependency-free.
// ============================================================

import type { OgClassification, OgTier } from "./classification";
import { OGSCAN_SITE_URL } from "./og";

const TIER_EMOJI: Record<OgTier, string> = {
  OG_TOKEN: "\u2705",        // ✅
  SAFE_CLONE: "\uD83D\uDD35", // 🔵
  RISKY_TOKEN: "\u26A0\uFE0F",// ⚠️
  DANGEROUS_TOKEN: "\uD83D\uDED1", // 🛑
};

export type ScanShareInput = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  handle?: string | null;   // attribution (X handle without @)
  result: OgClassification;
  url?: string;             // canonical scan url
};

function shortMint(m: string): string {
  return m.length > 12 ? `${m.slice(0, 4)}...${m.slice(-4)}` : m;
}

function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Copy-ready tweet text. */
export function buildTweet(input: ScanShareInput): string {
  const { result } = input;
  const ticker = input.symbol ? `$${input.symbol}` : (input.name ?? shortMint(input.mint));
  const who = input.handle ? `@${input.handle.replace(/^@/, "")}` : "an OG";
  const url = input.url ?? `${OGSCAN_SITE_URL}/intel-token/${input.mint}`;
  return [
    `${TIER_EMOJI[result.tier]} ${ticker} scanned by ${who}`,
    ``,
    `Verdict: ${result.tierLabel} (${result.confidence}% confidence)`,
    `Risk: ${result.riskScore}/100`,
    `CA: ${input.mint}`,
    `${dateStamp()}`,
    ``,
    `${result.rationale}`,
    ``,
    `Scan it 👉 ${url}`,
    `#OGScan #Solana`,
  ].join("\n");
}

/** X (Twitter) web-intent share URL. */
export function buildXShareUrl(input: ScanShareInput): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildTweet(input))}`;
}

/** Structured payload for an image/text "viral scan card". */
export type ScanCardPayload = {
  title: string;
  ticker: string;
  tierLabel: string;
  tier: OgTier;
  confidence: number;
  risk: number;
  ca: string;
  attribution: string;
  date: string;
  topSignals: { label: string; detail: string }[];
  footer: string;
};

export function buildScanCard(input: ScanShareInput): ScanCardPayload {
  const { result } = input;
  return {
    title: "OG SCAN REPORT",
    ticker: input.symbol ? `$${input.symbol}` : (input.name ?? shortMint(input.mint)),
    tierLabel: result.tierLabel,
    tier: result.tier,
    confidence: result.confidence,
    risk: result.riskScore,
    ca: input.mint,
    attribution: input.handle ? `@${input.handle.replace(/^@/, "")}` : "ogscan.fun",
    date: dateStamp(),
    topSignals: result.signals.slice(0, 3).map((s) => ({ label: s.label, detail: s.detail })),
    footer: input.url ?? OGSCAN_SITE_URL,
  };
}

// ── Telegram automation ─────────────────────────────────────
export type TelegramTrigger = "velocity_spike" | "og_identified" | "abnormal_activity" | "daily_report";

export function buildTelegramAlert(trigger: TelegramTrigger, input: ScanShareInput & { velocity?: number }): string {
  const ticker = input.symbol ? `$${input.symbol}` : (input.name ?? shortMint(input.mint));
  const head =
    trigger === "og_identified" ? `${TIER_EMOJI.OG_TOKEN} OG IDENTIFIED` :
    trigger === "velocity_spike" ? `🚀 VELOCITY SPIKE${input.velocity ? ` (${Math.round(input.velocity)}/100)` : ""}` :
    trigger === "abnormal_activity" ? `${TIER_EMOJI.RISKY_TOKEN} ABNORMAL ACTIVITY` :
    `📊 OG SCAN DAILY`;
  return [
    `*${head}*`,
    `${ticker} — ${input.result.tierLabel} (${input.result.confidence}%)`,
    `Risk: ${input.result.riskScore}/100`,
    `CA: \`${input.mint}\``,
    input.url ?? `${OGSCAN_SITE_URL}/intel-token/${input.mint}`,
  ].join("\n");
}

export function shouldAutoPost(opts: { velocity?: number; tier: OgTier; velocityThreshold?: number }): { post: boolean; trigger?: TelegramTrigger } {
  const threshold = opts.velocityThreshold ?? 70;
  if (opts.tier === "OG_TOKEN") return { post: true, trigger: "og_identified" };
  if ((opts.velocity ?? 0) >= threshold) return { post: true, trigger: "velocity_spike" };
  if (opts.tier === "DANGEROUS_TOKEN") return { post: true, trigger: "abnormal_activity" };
  return { post: false };
}

/** Normalise an attribution handle for storage/display. */
export function normalizeHandle(handle?: string | null): string | null {
  if (!handle) return null;
  const h = handle.trim().replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "");
  return h.length ? h.slice(0, 30) : null;
}
