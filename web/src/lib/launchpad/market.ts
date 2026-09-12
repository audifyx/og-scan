import { PAD_PARAMS } from "./params";
import type { MarketAmm, MarketSpec, ResolverKind } from "./types";

export const MARKET_QUESTION_MAX = PAD_PARAMS.questionMax;

export type MarketTemplate = {
  id: string;
  label: string;
  question: (ticker: string) => string;
  resolver: ResolverKind;
  hours: number;
  category: "price" | "event" | "social" | "governance";
};

export const MARKET_TEMPLATES: MarketTemplate[] = [
  { id: "graduate_48h", label: "Graduate in 48h", question: (t) => `Will $${t || "TICKER"} graduate within 48h?`, resolver: "metric", hours: 48, category: "event" },
  { id: "mc_above", label: "MC above threshold", question: (t) => `Will $${t || "TICKER"} market cap be above the set threshold at deadline?`, resolver: "pyth", hours: 24, category: "price" },
  { id: "holders", label: "Holder count", question: (t) => `Will $${t || "TICKER"} have more holders at deadline than at launch?`, resolver: "metric", hours: 72, category: "event" },
  { id: "custom", label: "Custom", question: () => "", resolver: "mofn", hours: 48, category: "social" },
];

export function defaultMarketSpec(ticker = "TICKER", nowSec = Math.floor(Date.now() / 1000)): MarketSpec {
  const t = MARKET_TEMPLATES[0];
  return {
    question: t.question(ticker),
    deadlineUnix: nowSec + t.hours * 3600,
    resolver: t.resolver,
    amm: "parimutuel",
    seedCollateral: "0",
  };
}

const BANNED = /\b(kill|assassin|csam|child porn)\b/i;

export function lintMarketQuestion(q: string): string | null {
  const s = q.trim();
  if (!s) return "Question is required";
  if (s.length > MARKET_QUESTION_MAX) return `Question max ${MARKET_QUESTION_MAX} chars`;
  if (BANNED.test(s)) return "Question rejected by linter";
  if (!/\?/.test(s) && s.length < 12) return "Ask a real Yes/No question";
  return null;
}

export type CompleteSet = { yes: bigint; no: bigint; collateralLocked: bigint };

/** 1 collateral unit → 1 YES + 1 NO. */
export function splitCompleteSet(collateral: bigint): CompleteSet {
  if (collateral <= 0n) return { yes: 0n, no: 0n, collateralLocked: 0n };
  return { yes: collateral, no: collateral, collateralLocked: collateral };
}

export function mergeCompleteSet(yes: bigint, no: bigint): bigint {
  return yes < no ? yes : no;
}

export function impliedProbability(yesPool: bigint, noPool: bigint): number {
  const y = Number(yesPool);
  const n = Number(noPool);
  const d = y + n;
  if (!Number.isFinite(d) || d <= 0) return 0.5;
  return y / d;
}

/** Pin check: YES + NO ≈ 1 after fees. Returns residual in bps of 1.0. */
export function yesNoPinResidual(yesPrice: number, noPrice: number, feeBps: number): number {
  const pin = 1 - feeBps / 10_000;
  return Math.abs(yesPrice + noPrice - pin);
}

export function redeemWinning(amount: bigint, won: boolean): bigint {
  return won ? amount : 0n;
}

export function marketStatus(nowUnix: number, deadlineUnix: number, resolved: boolean, voided: boolean, halted = false): "preview" | "open" | "halted" | "resolved" | "void" {
  if (voided) return "void";
  if (resolved) return "resolved";
  if (halted) return "halted";
  if (nowUnix < deadlineUnix) return "open";
  return "halted";
}

export const AMM_COPY: Record<MarketAmm, string> = {
  parimutuel: "Share of the winning pot. Fastest prototype — no AMM inventory.",
  lmsr: "Hanson LMSR. Needs seed collateral b. Not live until market program.",
  cp: "Constant-product YES vs NO. Not live until market program.",
};
