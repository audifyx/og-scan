import { LAUNCH_TYPES, type IntentIssue, type LaunchIntent, type LaunchType } from "./types";
import { CURATED_QUOTES, isNativeSol, isStockQuote, mayhemAllowedForQuote, quoteByMint } from "./quotes";
import { defaultMarketSpec } from "./market";
import { PAD_PARAMS } from "./params";
import { assertCombo } from "./combo";
import { DEFAULT_PAD_FLAGS, type PadFlags } from "./flags";

const TICKER_RE = /^[A-Za-z0-9]{1,10}$/;
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function defaultIntent(partial?: Partial<LaunchIntent>): LaunchIntent {
  const type = partial?.type ?? "normal";
  const ticker = partial?.symbol ?? "";
  return {
    type,
    quoteMint: partial?.quoteMint ?? "So11111111111111111111111111111111111111112",
    quoteSymbol: partial?.quoteSymbol ?? "SOL",
    name: partial?.name ?? "",
    symbol: ticker,
    description: partial?.description ?? "",
    twitter: partial?.twitter ?? "",
    telegram: partial?.telegram ?? "",
    website: partial?.website ?? "",
    vanityPrefix: partial?.vanityPrefix ?? "",
    vanitySuffix: partial?.vanitySuffix ?? "obx",
    vanityCaseInsensitive: partial?.vanityCaseInsensitive ?? true,
    customMintSecret: partial?.customMintSecret,
    customMintPubkey: partial?.customMintPubkey,
    holderRewards: type === "rewards" || type === "bagwork" || !!partial?.holderRewards,
    bagwork: type === "bagwork" || !!partial?.bagwork,
    mayhem: !!partial?.mayhem,
    firstBuySol: partial?.firstBuySol ?? 0,
    graduationDest: partial?.graduationDest ?? "pumpswap",
    style: partial?.style ?? "curve",
    delayOpenUnix: partial?.delayOpenUnix,
    antiSnipeBlocks: partial?.antiSnipeBlocks ?? 0,
    perWalletCapSol: partial?.perWalletCapSol ?? 0,
    rewards: partial?.rewards ?? {
      track: type === "rewards" || type === "bagwork" ? "pump_holder" : "none",
      epochSeconds: PAD_PARAMS.epochDefaultSec,
      lockBoost: false,
      predictBoost: false,
    },
    market: type === "predict" ? (partial?.market ?? defaultMarketSpec(ticker || "TICKER")) : partial?.market,
    geoAttest: !!partial?.geoAttest,
    geoCountry: partial?.geoCountry ?? "",
  };
}

export function applyLaunchType(intent: LaunchIntent, type: LaunchType): LaunchIntent {
  return {
    ...intent,
    type,
    holderRewards: type === "rewards" || type === "bagwork" ? true : type === "predict" ? intent.holderRewards : false,
    bagwork: type === "bagwork",
    mayhem: type === "bagwork" || type === "rewards" || type === "predict" ? false : intent.mayhem,
    rewards: {
      ...intent.rewards,
      track: type === "rewards" || type === "bagwork"
        ? "pump_holder"
        : type === "predict"
          ? intent.rewards.track
          : "none",
    },
    market: type === "predict" ? (intent.market ?? defaultMarketSpec(intent.symbol || "TICKER")) : undefined,
  };
}

export function vanityPatternLength(intent: Pick<LaunchIntent, "vanityPrefix" | "vanitySuffix">): number {
  const prefix = (intent.vanityPrefix || "").replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  const suffix = (intent.vanitySuffix || "").replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
  return prefix.length + suffix.length;
}

export function vanityEta(chars: number): { label: string; disabled: boolean } {
  if (chars <= 0) return { label: "random, instant", disabled: false };
  if (chars <= 3) return { label: "~seconds", disabled: false };
  if (chars === 4) return { label: "~minutes", disabled: false };
  if (chars === 5) return { label: "~hours", disabled: false };
  return { label: "too long — max 5", disabled: true };
}

export function validateLaunchIntent(
  intent: LaunchIntent,
  opts?: { onChainAllowed?: string[]; flags?: PadFlags; nowUnix?: number; country?: string },
): IntentIssue[] {
  const issues: IntentIssue[] = [];
  if (!LAUNCH_TYPES.includes(intent.type)) {
    issues.push({ field: "type", message: "Unknown launch type" });
  }
  if (!intent.name.trim() || intent.name.trim().length > PAD_PARAMS.nameMax) {
    issues.push({ field: "name", message: `Name is required (max ${PAD_PARAMS.nameMax})` });
  }
  if (!TICKER_RE.test(intent.symbol.trim())) {
    issues.push({ field: "symbol", message: `Ticker must be 1–${PAD_PARAMS.tickerMax} letters or numbers` });
  }
  if (intent.description.length > PAD_PARAMS.descriptionMax) {
    issues.push({ field: "description", message: `Description max ${PAD_PARAMS.descriptionMax}` });
  }
  const quote = quoteByMint(intent.quoteMint) || CURATED_QUOTES.find((q) => q.mint === intent.quoteMint);
  if (!intent.quoteMint) {
    issues.push({ field: "quoteMint", message: "Pick a quote asset" });
  }
  if (opts?.onChainAllowed && !opts.onChainAllowed.includes(intent.quoteMint) && !isNativeSol(intent.quoteMint) && intent.quoteMint !== "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") {
    issues.push({ field: "quoteMint", message: "Quote mint is not on the live allowlist" });
  }
  if (intent.mayhem && !mayhemAllowedForQuote(intent.quoteMint)) {
    issues.push({ field: "mayhem", message: "Mayhem is SOL and USDC only" });
  }
  if (intent.mayhem && isStockQuote(intent.quoteMint)) {
    issues.push({ field: "mayhem", message: "Stock quotes reject mayhem" });
  }
  if (intent.type === "vanity") {
    const n = vanityPatternLength(intent);
    if (n === 0) issues.push({ field: "vanity", message: "Enter a prefix or suffix" });
    if (n > 5) issues.push({ field: "vanity", message: "Vanity pattern max 5 characters" });
    const raw = `${intent.vanityPrefix}${intent.vanitySuffix}`;
    if (raw && !BASE58_RE.test(raw.replace(/[^1-9A-HJ-NP-Za-km-z]/g, "") || "1")) {
      issues.push({ field: "vanity", message: "Vanity must be base58" });
    }
  }
  if (intent.type === "custom_ca") {
    if (!intent.customMintPubkey) {
      issues.push({ field: "customMint", message: "Paste or generate a mint keypair" });
    }
  }
  if (intent.type === "bagwork" && !intent.twitter.trim()) {
    issues.push({ field: "twitter", message: "Bagwork requires an X link" });
  }
  if (!Number.isFinite(intent.firstBuySol) || intent.firstBuySol < 0) {
    issues.push({ field: "firstBuySol", message: "First buy cannot be negative" });
  }
  if (quote && !quote.allowed && quote.awaitingAllowlist) {
    issues.push({ field: "quoteMint", message: `${quote.symbol} is awaiting QuoteControl allowlist` });
  }
  issues.push(...assertCombo(intent, {
    flags: opts?.flags ?? DEFAULT_PAD_FLAGS,
    nowUnix: opts?.nowUnix,
    country: opts?.country,
  }));
  return issues;
}

export function onChainCreateSupported(intent: LaunchIntent): boolean {
  return isNativeSol(intent.quoteMint);
}

const DRAFT_KEY = "orbitx-pad-draft-v2";

export function saveLaunchDraft(intent: LaunchIntent): void {
  try {
    const { customMintSecret: _s, ...safe } = intent;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(safe));
  } catch { /* ignore */ }
}

export function loadLaunchDraft(): Partial<LaunchIntent> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<LaunchIntent>;
  } catch {
    return null;
  }
}

export function clearLaunchDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}
