/* OrbitX AI Hub — token mention detection, DexScreener price cache,
   TokenChip (price + 24h badge), and CopyAddr quick-action chips.
   DexScreener public API: https://docs.dexscreener.com/api/reference
   - batch quotes: GET /latest/dex/tokens/{mint1},{mint2}... (up to 30)
   - symbol search: GET /latest/dex/search?q=$SYM
   Cache lives in-memory + localStorage, 5-minute TTL per mint. */

import React, { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Bare base58 Solana addresses (mints, wallets) inside prose. */
export const MINT_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
/** $SYMBOL mentions, e.g. $BONK, $SOL. */
export const SYMBOL_RE = /\$([A-Za-z][A-Za-z0-9]{1,9})\b/g;

export interface TokenMention {
  kind: "mint" | "symbol";
  value: string;
}

/** Extract unique token mentions ($SYMBOL and bare base58 mints) from text. */
export function findTokenMentions(text: string): TokenMention[] {
  const out: TokenMention[] = [];
  const seen = new Set<string>();
  const push = (kind: "mint" | "symbol", value: string) => {
    const key = `${kind}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ kind, value });
    }
  };
  for (const m of text.matchAll(SYMBOL_RE)) push("symbol", m[1].toUpperCase());
  for (const m of text.matchAll(MINT_RE)) push("mint", m[0]);
  return out.slice(0, 6);
}

export interface TokenQuote {
  priceUsd: number | null;
  chg24: number | null;
  symbol: string | null;
}

interface CacheEntry {
  quote: TokenQuote;
  at: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const SYMBOL_TTL_MS = 60 * 60 * 1000;
const LS_KEY = "hub-dex-cache-v1";
const LS_SYMBOL_KEY = "hub-dex-symbol-v1";

const memCache = new Map<string, CacheEntry>();
const memSymbolCache = new Map<string, { mint: string; at: number }>();

function loadLs(key: string): Record<string, CacheEntry | { mint: string; at: number }> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveLs(key: string, obj: Record<string, unknown>) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    /* private mode / quota */
  }
}
function warmCaches() {
  const q = loadLs(LS_KEY);
  for (const [k, v] of Object.entries(q)) {
    if (v && typeof (v as CacheEntry).at === "number" && Date.now() - (v as CacheEntry).at < CACHE_TTL_MS)
      memCache.set(k, v as CacheEntry);
  }
  const s = loadLs(LS_SYMBOL_KEY);
  for (const [k, v] of Object.entries(s)) {
    if (v && typeof (v as { at: number }).at === "number" && Date.now() - (v as { at: number }).at < SYMBOL_TTL_MS)
      memSymbolCache.set(k, v as { mint: string; at: number });
  }
}
let warmed = false;
function ensureWarm() {
  if (!warmed) {
    warmed = true;
    warmCaches();
  }
}

interface DexPair {
  baseToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
}

/** Batched DexScreener quotes for up to 30 mints at once. */
export async function fetchTokenPrices(mints: string[]): Promise<Map<string, TokenQuote>> {
  ensureWarm();
  const fresh = new Map<string, TokenQuote>();
  const todo: string[] = [];
  for (const m of mints) {
    const hit = memCache.get(m);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) fresh.set(m, hit.quote);
    else todo.push(m);
  }
  if (todo.length > 0) {
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${todo.slice(0, 30).join(",")}`,
      );
      if (res.ok) {
        const json = (await res.json()) as { pairs?: DexPair[] };
        const best = new Map<string, DexPair>();
        for (const p of json.pairs || []) {
          const addr = p.baseToken?.address;
          if (addr && !best.has(addr)) best.set(addr, p);
        }
        const lsDump: Record<string, CacheEntry> = {};
        for (const m of todo) {
          const p = best.get(m);
          const quote: TokenQuote = p
            ? {
                priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
                chg24: p.priceChange?.h24 ?? null,
                symbol: p.baseToken?.symbol ?? null,
              }
            : { priceUsd: null, chg24: null, symbol: null };
          const entry = { quote, at: Date.now() };
          memCache.set(m, entry);
          lsDump[m] = entry;
          fresh.set(m, quote);
        }
        saveLs(LS_KEY, { ...loadLs(LS_KEY), ...lsDump });
      }
    } catch {
      /* offline / blocked — leave uncached */
    }
  }
  return fresh;
}

/** Resolve a $SYMBOL to a Solana mint via DexScreener search (best-volume Solana pair). */
export async function resolveSymbolToMint(symbol: string): Promise<string | null> {
  ensureWarm();
  const sym = symbol.toUpperCase();
  const hit = memSymbolCache.get(sym);
  if (hit && Date.now() - hit.at < SYMBOL_TTL_MS) return hit.mint;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=%24${sym}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { pairs?: (DexPair & { chainId?: string; volume?: { h24?: number } })[] };
    const solPairs = (json.pairs || []).filter(
      (p) => p.chainId === "solana" && p.baseToken?.address,
    );
    if (solPairs.length === 0) return null;
    solPairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
    const mint = solPairs[0].baseToken!.address!;
    memSymbolCache.set(sym, { mint, at: Date.now() });
    saveLs(LS_SYMBOL_KEY, { ...loadLs(LS_SYMBOL_KEY), [sym]: { mint, at: Date.now() } });
    return mint;
  } catch {
    return null;
  }
}

export type TokenKey = { mint: string; symbol?: string | null } | { symbol: string; mint?: string | null };

function keyMint(k: TokenKey): string | null {
  return "mint" in k && k.mint ? k.mint : null;
}
function keySymbol(k: TokenKey): string | null {
  return "symbol" in k && k.symbol ? k.symbol : null;
}

/** Hook: prices for a mixed list of mints and $symbols. Returns mint -> quote. */
export function useTokenPrices(keys: TokenKey[]): Map<string, TokenQuote> {
  const [quotes, setQuotes] = useState<Map<string, TokenQuote>>(new Map());
  const sig = keys.map((k) => keyMint(k) ?? `$${keySymbol(k)}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mints: string[] = [];
      for (const k of keys) {
        const m = keyMint(k);
        if (m) mints.push(m);
        else {
          const s = keySymbol(k);
          if (s) {
            const resolved = await resolveSymbolToMint(s);
            if (resolved) mints.push(resolved);
          }
        }
      }
      const map = await fetchTokenPrices([...new Set(mints)]);
      if (!cancelled) setQuotes(map);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return quotes;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

/** Glassy token chip: symbol, live price, 24h % badge. Clicking opens the token on DexScreener. */
export function TokenChip({ mint, symbol }: { mint?: string; symbol?: string }) {
  const key: TokenKey = mint ? { mint } : { symbol: symbol ?? "?" };
  const quotes = useTokenPrices([key]);
  const [resolvedMint, setResolvedMint] = useState<string | null>(mint ?? null);
  useEffect(() => {
    if (mint) {
      setResolvedMint(mint);
      return;
    }
    if (symbol) {
      resolveSymbolToMint(symbol).then((m) => m && setResolvedMint(m));
    }
  }, [mint, symbol]);
  const q = resolvedMint ? quotes.get(resolvedMint) : undefined;
  const label = (q?.symbol || symbol || (resolvedMint ? `${resolvedMint.slice(0, 4)}…` : "?")).toUpperCase();
  const href = resolvedMint ? `https://dexscreener.com/solana/${resolvedMint}` : undefined;
  const body = (
    <>
      <span className="font-black tracking-wide">{label}</span>
      {q ? (
        <>
          <span className="font-mono text-white/80">{fmtUsd(q.priceUsd)}</span>
          {q.chg24 != null && (
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                q.chg24 >= 0 ? "bg-og-lime/15 text-og-lime" : "bg-red-500/15 text-red-400"
              }`}
            >
              {q.chg24 >= 0 ? "▲" : "▼"} {Math.abs(q.chg24).toFixed(1)}%
            </span>
          )}
        </>
      ) : (
        <span className="h-3 w-16 animate-pulse rounded bg-white/10" />
      )}
    </>
  );
  const cls =
    "hub-rise inline-flex max-w-full items-center gap-2 rounded-full border border-iris/30 bg-iris/[0.08] px-3 py-1 text-[11px] text-white/90 transition hover:border-iris/60 hover:bg-iris/[0.14]";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls} title="Open on DexScreener">
      {body}
    </a>
  ) : (
    <span className={cls}>{body}
    </span>
  );
}

/** Copy-to-clipboard chip for wallet/mint addresses found in chat. */
export function CopyAddr({ address, compact = true }: { address: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const shown = compact ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={`Copy ${address}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-white/70 transition hover:border-og-cyan/40 hover:text-white"
    >
      {shown}
      {copied ? <Check className="h-3 w-3 text-og-lime" /> : <Copy className="h-3 w-3 opacity-60" />}
    </button>
  );
}
