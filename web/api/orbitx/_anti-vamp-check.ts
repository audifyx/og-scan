import type { VercelRequest, VercelResponse } from "@vercel/node";
import { CHAINS } from "../../src/lib/orbitx/chains.js";
import {
  SOFT_MATCH_SIM,
  isKnownVampIdentity,
  isRelevantMarketCandidate,
  scoreIdentity,
  type AntiVampAssetType,
  type VampMatchContext,
} from "../../src/lib/orbitx/antiVampScore.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const FETCH_TIMEOUT_MS = 4500;
const MAX_CHAINS = 16;
const MARKET_SOURCES = ["pumpfun", "dexscreener"] as const;
type MarketSource = (typeof MARKET_SOURCES)[number];

export interface VampSourceMatch {
  source: "orbitx" | MarketSource | "denylist";
  name: string;
  ticker: string;
  sim: number;
  hard: boolean;
  chainId?: string;
  assetType?: AntiVampAssetType;
  reason?: string;
}
export interface AntiVampRequest {
  name?: string;
  ticker?: string;
  symbol?: string;
  chainId?: string;
  chainIds?: string[];
  assetType?: AntiVampAssetType;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}
function key(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function requestedChains(input: AntiVampRequest): string[] {
  const ids = [...(input.chainIds ?? []), ...(input.chainId ? [input.chainId] : [])].filter((id) => CHAINS.some((c) => c.id === id));
  return [...new Set(ids)].slice(0, MAX_CHAINS).length ? [...new Set(ids)].slice(0, MAX_CHAINS) : CHAINS.filter((c) => c.status !== "soon").map((c) => c.id).slice(0, MAX_CHAINS);
}
function toMatch(source: VampSourceMatch["source"], candName: string, candTicker: string, name: string, ticker: string, chainId?: string, assetType: AntiVampAssetType = "token"): VampSourceMatch | null {
  const context: VampMatchContext = source === "orbitx" || source === "denylist" ? "registry" : "market";
  if (context === "market" && !isRelevantMarketCandidate(candName, candTicker, name, ticker)) return null;
  const result = scoreIdentity(candName, candTicker, name, ticker, context);
  if (result.sim < SOFT_MATCH_SIM && !result.hard) return null;
  return { source, name: candName, ticker: candTicker, sim: result.sim, hard: result.hard, chainId, assetType, reason: result.reason };
}
async function checkOrbitxRegistry(name: string, ticker: string, chainIds: string[], assetType: AntiVampAssetType) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { matches: [] as VampSourceMatch[], failed: true };
  try {
    const res = await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/rpc/orbitx_vamp_check`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_name: name, p_ticker: ticker, p_chain_ids: chainIds, p_asset_type: assetType }) }), FETCH_TIMEOUT_MS);
    if (!res.ok) return { matches: [], failed: true };
    const rows = await res.json() as { name: string; ticker?: string; symbol?: string; chain_id?: string }[];
    return { matches: (rows ?? []).map((row) => toMatch("orbitx", row.name, row.ticker ?? row.symbol ?? "", name, ticker, row.chain_id, assetType)).filter(Boolean) as VampSourceMatch[], failed: false };
  } catch (error) { console.error("[anti-vamp] registry source failed", error); return { matches: [], failed: true }; }
}
async function fetchDex(query: string): Promise<any[]> {
  const res = await withTimeout(fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, { headers: { accept: "application/json" } }), FETCH_TIMEOUT_MS);
  if (!res.ok) throw new Error(`dexscreener ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.pairs) ? data.pairs : [];
}
async function checkDexScreener(name: string, ticker: string, chainIds: string[], assetType: AntiVampAssetType) {
  if (assetType !== "token") return { matches: [] as VampSourceMatch[], failed: false };
  const queries = [...new Set([name, ticker].map((v) => v.trim()).filter((v) => v.length >= 2))];
  try {
    const pairs = (await Promise.all(queries.map(fetchDex))).flat();
    const allowed = new Set(chainIds);
    const seen = new Set<string>(); const matches: VampSourceMatch[] = [];
    for (const pair of pairs) {
      const chainId = String(pair?.chainId ?? "");
      if (chainId && !allowed.has(chainId)) continue;
      const token = pair?.baseToken;
      if (!token?.name && !token?.symbol) continue;
      const nameValue = String(token.name ?? ""); const tickerValue = String(token.symbol ?? "");
      const identityKey = `${key(nameValue)}|${key(tickerValue)}|${chainId}`;
      if (seen.has(identityKey)) continue; seen.add(identityKey);
      const match = toMatch("dexscreener", nameValue, tickerValue, name, ticker, chainId, assetType);
      if (match) matches.push(match);
    }
    return { matches, failed: false };
  } catch (error) { console.error("[anti-vamp] DexScreener source failed", error); return { matches: [], failed: true }; }
}
async function checkPumpFun(name: string, ticker: string) {
  const queries = [...new Set([name, ticker].map((v) => v.trim()).filter((v) => v.length >= 2))];
  try {
    const lists = await Promise.all(queries.map(async (query) => {
      const res = await withTimeout(fetch(`https://frontend-api-v3.pump.fun/coins/search?searchTerm=${encodeURIComponent(query)}&limit=50&offset=0`, { headers: { accept: "application/json" } }), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error(`pump.fun ${res.status}`);
      const data = await res.json(); return Array.isArray(data) ? data : Array.isArray(data?.coins) ? data.coins : [];
    }));
    const seen = new Set<string>(); const matches: VampSourceMatch[] = [];
    for (const token of lists.flat()) {
      const candName = String(token?.name ?? ""); const candTicker = String(token?.symbol ?? ""); const identityKey = `${key(candName)}|${key(candTicker)}`;
      if (seen.has(identityKey)) continue; seen.add(identityKey);
      const match = toMatch("pumpfun", candName, candTicker, name, ticker, "solana", "token"); if (match) matches.push(match);
    }
    return { matches, failed: false };
  } catch (error) { console.error("[anti-vamp] pump.fun source failed", error); return { matches: [], failed: true }; }
}
function setCors(res: VercelResponse) { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Content-Type"); }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res); if (req.method === "OPTIONS") return res.status(204).end(); if (req.method !== "POST") return res.status(405).json({ blocked: false, error: "Method not allowed" });
  const input = (req.body ?? {}) as AntiVampRequest; const name = String(input.name ?? "").trim(); const ticker = String(input.ticker ?? input.symbol ?? "").trim(); const assetType = input.assetType ?? "token"; const chains = requestedChains(input);
  if (!name && !ticker) return res.status(200).json({ blocked: false, flagged: false, hardMatch: null, matches: [], checked: [], checkedChains: chains, sourceHealth: {} });
  try {
    const deny = isKnownVampIdentity({ name, ticker, symbol: input.symbol }, assetType) ? [{ source: "denylist", name, ticker, sim: 1, hard: true, assetType, reason: "known_vamp_identity" } as VampSourceMatch] : [];
    const [orbitx, pumpfun, dexscreener] = await Promise.all([checkOrbitxRegistry(name, ticker, chains, assetType), assetType === "token" && chains.includes("solana") ? checkPumpFun(name, ticker) : Promise.resolve({ matches: [], failed: false }), checkDexScreener(name, ticker, chains, assetType)]);
    const health = { orbitx: !orbitx.failed, pumpfun: !pumpfun.failed, dexscreener: !dexscreener.failed }; const all = [...deny, ...orbitx.matches, ...pumpfun.matches, ...dexscreener.matches].sort((a, b) => b.sim - a.sim); const hard = all.find((m) => m.hard) ?? null; const matches = all.filter((m) => m.sim >= SOFT_MATCH_SIM || m.hard); const degraded = Object.values(health).every((healthy) => !healthy);
    return res.status(200).json({ blocked: !!hard, flagged: matches.length > 0 || degraded, hardMatch: hard ? { name: hard.name, ticker: hard.ticker || "—", source: hard.source, chainId: hard.chainId, reason: hard.reason } : null, matches, checked: ["orbitx", "pumpfun", "dexscreener"], checkedChains: chains, sourceHealth: health, warning: degraded ? "verification_degraded" : undefined, assetType, message: degraded ? "Originality sources are unavailable — launch allowed with platform-routing caution." : undefined });
  } catch (error) { console.error("[anti-vamp] unexpected checker failure", error); return res.status(200).json({ blocked: false, flagged: true, hardMatch: null, matches: [], checkedChains: chains, warning: "verification_degraded", message: "Originality verification hit an error — launch allowed; retry before continuing if unsure." }); }
}

