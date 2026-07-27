import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  HARD_MATCH_SIM,
  SOFT_MATCH_SIM,
  scoreIdentity,
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
  const { sim, hard } = scoreIdentity(candName, candTicker, name, ticker);
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

async function checkPumpFun(name: string, ticker: string): Promise<SourceResult> {
  const q = name || ticker;
  if (!q.trim()) return { matches: [], failed: false };
  try {
    const res = await withTimeout(
      fetch(`https://frontend-api-v3.pump.fun/coins/search?searchTerm=${encodeURIComponent(q)}&limit=25&offset=0`, {
        headers: { accept: "application/json" },
      }),
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return { matches: [], failed: true };
    const data = await res.json();
    const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.coins) ? data.coins : [];
    return {
      matches: list
        .map((t) => toMatch("pumpfun", String(t.name ?? ""), String(t.symbol ?? ""), name, ticker))
        .filter((m): m is VampSourceMatch => !!m),
      failed: false,
    };
  } catch (err) {
    console.error("[anti-vamp-check] pump.fun check failed:", err);
    return { matches: [], failed: true };
  }
}

async function checkDexScreener(name: string, ticker: string): Promise<SourceResult> {
  const q = name || ticker;
  if (!q.trim()) return { matches: [], failed: false };
  try {
    const res = await withTimeout(
      fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
        headers: { accept: "application/json" },
      }),
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return { matches: [], failed: true };
    const data = await res.json();
    const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
    const seen = new Set<string>();
    const out: VampSourceMatch[] = [];
    for (const p of pairs) {
      if (p.chainId && p.chainId !== "solana") continue;
      const bt = p.baseToken;
      if (!bt?.name && !bt?.symbol) continue;
      const key = `${bt.name}|${bt.symbol}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = toMatch("dexscreener", String(bt.name ?? ""), String(bt.symbol ?? ""), name, ticker);
      if (m) out.push(m);
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
    const hard = all.find((m) => m.hard || m.sim >= HARD_MATCH_SIM) ?? null;
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
