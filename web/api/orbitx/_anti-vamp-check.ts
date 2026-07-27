import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  SOFT_MATCH_SIM,
  isRelevantMarketCandidate,
  scoreIdentity,
  type VampMatchContext,
} from "../../src/lib/orbitx/antiVampScore";

// OrbitX Anti-Vamp — unified, server-side originality check.
// Hard-blocks only real collisions. Soft matches flag fee routing.
// Source outages fail OPEN (warning) so legitimate launches are not frozen.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const FETCH_TIMEOUT_MS = 4500;

export interface VampSourceMatch {
  source: "orbitx" | "pumpfun" | "dexscreener";
  name: string;
  ticker: string;
  sim: number;
  hard: boolean;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

type SourceResult = { matches: VampSourceMatch[]; failed: boolean };

function toMatch(
  source: VampSourceMatch["source"],
  candName: string,
  candTicker: string,
  name: string,
  ticker: string,
): VampSourceMatch | null {
  const context: VampMatchContext = source === "orbitx" ? "registry" : "market";
  if (context === "market" && !isRelevantMarketCandidate(candName, candTicker, name, ticker)) {
    return null;
  }
  const { sim, hard } = scoreIdentity(candName, candTicker, name, ticker, context);
  if (sim < SOFT_MATCH_SIM && !hard) return null;
  return { source, name: candName, ticker: candTicker, sim, hard };
}

async function checkOrbitxRegistry(name: string, ticker: string): Promise<SourceResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { matches: [], failed: true };
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
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return { matches: [], failed: true };
    const rows = (await res.json()) as { name: string; ticker: string; sim: number }[];
    // Re-score with our stricter scorer — do not trust inflated RPC trigram alone.
    return {
      matches: (rows ?? [])
        .map((r) => toMatch("orbitx", r.name, r.ticker, name, ticker))
        .filter((m): m is VampSourceMatch => !!m),
      failed: false,
    };
  } catch (err) {
    console.error("[anti-vamp-check] orbitx registry check failed:", err);
    return { matches: [], failed: true };
  }
}

async function fetchPumpSearch(term: string): Promise<any[]> {
  const res = await withTimeout(
    fetch(
      `https://frontend-api-v3.pump.fun/coins/search?searchTerm=${encodeURIComponent(term)}&limit=25&offset=0`,
      { headers: { accept: "application/json" } },
    ),
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`pump.fun ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : Array.isArray(data?.coins) ? data.coins : [];
}

async function checkPumpFun(name: string, ticker: string): Promise<SourceResult> {
  const queries = [...new Set([name, ticker].map((q) => q.trim()).filter((q) => q.length >= 2))];
  if (!queries.length) return { matches: [], failed: false };
  try {
    const lists = await Promise.all(queries.map((q) => fetchPumpSearch(q).catch(() => [])));
    const seen = new Set<string>();
    const out: VampSourceMatch[] = [];
    for (const list of lists) {
      for (const t of list) {
        const candName = String(t.name ?? "");
        const candTicker = String(t.symbol ?? "");
        const key = `${normalizeKey(candName)}|${normalizeKey(candTicker)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const m = toMatch("pumpfun", candName, candTicker, name, ticker);
        if (m) out.push(m);
      }
    }
    return { matches: out, failed: false };
  } catch (err) {
    console.error("[anti-vamp-check] pump.fun check failed:", err);
    return { matches: [], failed: true };
  }
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function checkDexScreener(name: string, ticker: string): Promise<SourceResult> {
  const queries = [...new Set([name, ticker].map((q) => q.trim()).filter((q) => q.length >= 2))];
  if (!queries.length) return { matches: [], failed: false };
  try {
    const responses = await Promise.all(
      queries.map(async (q) => {
        const res = await withTimeout(
          fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
            headers: { accept: "application/json" },
          }),
          FETCH_TIMEOUT_MS,
        );
        if (!res.ok) throw new Error(`dexscreener ${res.status}`);
        return res.json();
      }),
    );
    const seen = new Set<string>();
    const out: VampSourceMatch[] = [];
    for (const data of responses) {
      const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
      for (const p of pairs) {
        if (p.chainId && p.chainId !== "solana") continue;
        const bt = p.baseToken;
        if (!bt?.name && !bt?.symbol) continue;
        const key = `${normalizeKey(String(bt.name ?? ""))}|${normalizeKey(String(bt.symbol ?? ""))}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const m = toMatch("dexscreener", String(bt.name ?? ""), String(bt.symbol ?? ""), name, ticker);
        if (m) out.push(m);
      }
    }
    return { matches: out, failed: false };
  } catch (err) {
    console.error("[anti-vamp-check] DexScreener check failed:", err);
    return { matches: [], failed: true };
  }
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ blocked: false, error: "Method not allowed" });
    return;
  }

  try {
    const { name, ticker } = (req.body ?? {}) as { name?: string; ticker?: string };
    const cleanName = (name ?? "").trim();
    const cleanTicker = (ticker ?? "").trim();

    if (!cleanName && !cleanTicker) {
      res.status(200).json({ blocked: false, flagged: false, hardMatch: null, matches: [], checked: [] });
      return;
    }

    const [orbitxRes, pumpRes, dexRes] = await Promise.all([
      checkOrbitxRegistry(cleanName, cleanTicker),
      checkPumpFun(cleanName, cleanTicker),
      checkDexScreener(cleanName, cleanTicker),
    ]);

    const sourceHealth = {
      orbitx: !orbitxRes.failed,
      pumpfun: !pumpRes.failed,
      dexscreener: !dexRes.failed,
    };
    const failedCount = [orbitxRes, pumpRes, dexRes].filter((r) => r.failed).length;

    // Fail OPEN on outages — warn + soft-flag, never freeze legitimate launches.
    if (failedCount === 3) {
      res.status(200).json({
        blocked: false,
        flagged: true,
        hardMatch: null,
        matches: [],
        checked: ["orbitx", "pumpfun", "dexscreener"],
        sourceHealth,
        warning: "verification_degraded",
        message: "Originality sources are unavailable — launch allowed with elevated fee-routing caution.",
      });
      return;
    }

    const all = [...orbitxRes.matches, ...pumpRes.matches, ...dexRes.matches].sort((a, b) => b.sim - a.sim);
    const hard = all.find((m) => m.hard) ?? null;
    const soft = all.filter((m) => m.sim >= SOFT_MATCH_SIM || m.hard);

    res.status(200).json({
      blocked: !!hard,
      flagged: soft.length > 0,
      hardMatch: hard ? { name: hard.name, ticker: hard.ticker || "—", source: hard.source } : null,
      matches: soft,
      checked: ["orbitx", "pumpfun", "dexscreener"],
      sourceHealth,
    });
  } catch (error) {
    console.error("[anti-vamp-check]", error);
    // Fail OPEN on unexpected errors — do not brick the launchpad.
    res.status(200).json({
      blocked: false,
      flagged: true,
      hardMatch: null,
      matches: [],
      warning: "verification_degraded",
      message: "Originality verification hit an error — launch allowed; please retry the check if unsure.",
    });
  }
}
