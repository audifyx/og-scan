import type { VercelRequest, VercelResponse } from "@vercel/node";

// OrbitX Anti-Vamp — unified, server-side originality check.
// Runs on the server (not the browser) so calls to pump.fun / DexScreener are
// never blocked by CORS — that silent failure was why "many duplicate tokens
// were passing validation": the client-side checks were throwing and being
// swallowed, leaving only the (much smaller) in-house registry check active.
//
// Combines three sources into one verdict used by BOTH launch lanes:
//   1. OrbitX's own registry (already-launched OrbitX tokens)          — RPC
//   2. pump.fun's live coin search                                    — HTTP
//   3. DexScreener's live token search (covers the rest of Solana)    — HTTP
//
// A `hardMatch` (near-exact normalized name/ticker collision, or trigram/
// dice similarity >= 0.85) must BLOCK the launch entirely. A softer match
// (>= 0.55) is returned as `flagged` so the caller can still route creator
// fees to the OBX buyback wallet per the existing anti-vamp fee penalty.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const HARD_MATCH_SIM = 0.85;
const SOFT_MATCH_SIM = 0.55;
const FETCH_TIMEOUT_MS = 4500;

export interface VampSourceMatch {
  source: "orbitx" | "pumpfun" | "dexscreener";
  name: string;
  ticker: string;
  sim: number;
}

function normalize(raw: string): string {
  // Mirrors the Postgres orbitx_normalize() function: lowercase, strip
  // non-alphanumerics, then collapse common leetspeak substitutions.
  const stripped = (raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t" };
  return stripped.replace(/[01345 7]/g, (c) => map[c] ?? c);
}

/** Dice coefficient over character bigrams — a JS-side stand-in for pg_trgm similarity(). */
function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const ba = bigrams(a), bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return a === b ? 1 : 0;
  let overlap = 0;
  for (const [g, count] of ba) overlap += Math.min(count, bb.get(g) ?? 0);
  return (2 * overlap) / ([...ba.values()].reduce((s, n) => s + n, 0) + [...bb.values()].reduce((s, n) => s + n, 0));
}

function scoreMatch(candidateName: string, candidateTicker: string, name: string, ticker: string): number {
  const nName = normalize(name), nTicker = normalize(ticker);
  const nCandName = normalize(candidateName), nCandTicker = normalize(candidateTicker);
  if ((nCandName && nCandName === nName) || (nCandTicker && nCandTicker === nTicker)) return 1;
  return Math.max(
    bigramSimilarity(nCandName, nName),
    bigramSimilarity(nCandTicker, nTicker)
  );
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function checkOrbitxRegistry(name: string, ticker: string): Promise<VampSourceMatch[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/rest/v1/rpc/orbitx_vamp_check`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_name: name, p_ticker: ticker }),
      }),
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as { name: string; ticker: string; sim: number }[];
    return (rows ?? []).map((r) => ({ source: "orbitx" as const, name: r.name, ticker: r.ticker, sim: r.sim }));
  } catch (err) {
    console.error("[anti-vamp-check] orbitx registry check failed:", err);
    return [];
  }
}

async function checkPumpFun(name: string, ticker: string): Promise<VampSourceMatch[]> {
  const q = name || ticker;
  if (!q.trim()) return [];
  try {
    const res = await withTimeout(
      fetch(`https://frontend-api-v3.pump.fun/coins/search?searchTerm=${encodeURIComponent(q)}&limit=25&offset=0`, {
        headers: { accept: "application/json" },
      }),
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.coins) ? data.coins : [];
    return list
      .map((t) => ({
        source: "pumpfun" as const,
        name: String(t.name ?? ""),
        ticker: String(t.symbol ?? ""),
        sim: scoreMatch(String(t.name ?? ""), String(t.symbol ?? ""), name, ticker),
      }))
      .filter((m) => m.sim >= SOFT_MATCH_SIM);
  } catch (err) {
    console.error("[anti-vamp-check] pump.fun check failed:", err);
    return [];
  }
}

async function checkDexScreener(name: string, ticker: string): Promise<VampSourceMatch[]> {
  const q = name || ticker;
  if (!q.trim()) return [];
  try {
    const res = await withTimeout(
      fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
        headers: { accept: "application/json" },
      }),
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return [];
    const data = await res.json();
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
    const seen = new Set<string>();
    const out: VampSourceMatch[] = [];
    for (const p of pairs) {
      if ((p.chainId && p.chainId !== "solana")) continue;
      const bt = p.baseToken;
      if (!bt?.name && !bt?.symbol) continue;
      const key = `${bt.name}|${bt.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sim = scoreMatch(String(bt.name ?? ""), String(bt.symbol ?? ""), name, ticker);
      if (sim >= SOFT_MATCH_SIM) out.push({ source: "dexscreener", name: String(bt.name ?? ""), ticker: String(bt.symbol ?? ""), sim });
    }
    return out;
  } catch (err) {
    console.error("[anti-vamp-check] DexScreener check failed:", err);
    return [];
  }
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ blocked: false, error: "Method not allowed" }); return; }

  try {
    const { name, ticker } = (req.body ?? {}) as { name?: string; ticker?: string };
    const cleanName = (name ?? "").trim();
    const cleanTicker = (ticker ?? "").trim();

    if (!cleanName && !cleanTicker) {
      res.status(200).json({ blocked: false, flagged: false, hardMatch: null, matches: [], checked: [] });
      return;
    }

    const [orbitxMatches, pumpMatches, dexMatches] = await Promise.all([
      checkOrbitxRegistry(cleanName, cleanTicker),
      checkPumpFun(cleanName, cleanTicker),
      checkDexScreener(cleanName, cleanTicker),
    ]);

    const all = [...orbitxMatches, ...pumpMatches, ...dexMatches].sort((a, b) => b.sim - a.sim);
    const hard = all.find((m) => m.sim >= HARD_MATCH_SIM) ?? null;
    const soft = all.filter((m) => m.sim >= SOFT_MATCH_SIM);

    res.status(200).json({
      blocked: !!hard,
      flagged: soft.length > 0,
      hardMatch: hard ? { name: hard.name, ticker: hard.ticker, source: hard.source } : null,
      matches: soft,
      checked: ["orbitx", "pumpfun", "dexscreener"],
    });
  } catch (error) {
    console.error("[anti-vamp-check]", error);
    // Fail CLOSED: a broken check must never let a duplicate slip through.
    res.status(200).json({
      blocked: true,
      flagged: true,
      hardMatch: null,
      matches: [],
      error: "verification_unavailable",
      message: "Originality verification is temporarily unavailable. Please try again in a moment.",
    });
  }
}
