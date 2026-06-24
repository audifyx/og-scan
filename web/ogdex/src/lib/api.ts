export interface Row {
 mint: string; name?: string; symbol?: string; icon?: string | null;
 priceUsd?: number | null; mcap?: number | null; fdv?: number | null;
 liquidity?: number | null; holderCount?: number | null; volume?: number | null;
 buyVolume?: number | null; sellVolume?: number | null;
 numBuys?: number | null; numSells?: number | null; netBuyers?: number | null;
 change5m?: number | null; change1h?: number | null; change6h?: number | null; change24h?: number | null;
 organicScore?: number | null; organicScoreLabel?: string | null;
 isVerified?: boolean; dev?: string | null; circSupply?: number | null;
 totalSupply?: number | null; decimals?: number | null;
 holderChange24h?: number | null; liquidityChange24h?: number | null; volumeChange24h?: number | null;
 numTraders?: number | null; numOrganicBuyers?: number | null; ageDays?: number | null;
 createdAt?: string | null; tags?: string[];
 audit?: { mintAuthorityDisabled?: boolean; freezeAuthorityDisabled?: boolean; topHoldersPercentage?: number | null; devBalancePercentage?: number | null; devMints?: number | null };
 firstPool?: { id?: string; createdAt?: string } | null;
 stats?: Record;
}
export interface Listing {
 id: string; contract_address: string; chain: string; project_name?: string;
 symbol?: string; logo_url?: string; banner_url?: string; description?: string;
 links?: Record; tier: string; status: string; featured?: boolean;
 featured_rank?: number; metadata?: any; views?: number; created_at?: string; approved_at?: string;
}
export interface TokenDetailData {
 mint: string; token: Row | null; raw: any; score: any; flags: any;
 verdict: string | null; momentum: number | null; momentumLabel: string | null;
 meta: any; safety: any; intel?: any; error?: string;
}
export interface AppConfig {
 payWallet: string;
 pricing: { tier: string; price: number; sla: string; label: string }[];
 chains: string[]; telegram: string; community: any;
}

async function j(url: string, opts?: RequestInit): Promise {
 const r = await fetch(url, opts);
 return r.json();
}
const postJson = (url: string, body: any) =>
 j(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const getScreener = (type: string, interval: string, limit = 100, chain = "solana") =>
 j<{ rows: Row[]; count?: number; error?: string; chain?: string }>(`/api/ogdex/screener?type=${type}&interval=${interval}&limit=${limit}&chain=${chain}`);

export interface Boost {
 id: string; mint: string; symbol?: string; name?: string; icon?: string;
 chain?: string; tier?: string; status?: string; expires_at?: string; featured_rank?: number; usd_paid?: number; created_at?: string;
}
export const getBoosts = () => j<{ ok: boolean; boosts: Boost[]; error?: string }>("/api/ogdex/boosts");
export const getBoostTiers = () => j<{ tiers: any[]; payWallet: string }>("/api/ogdex/boosts?tiers=1");
export const submitBoost = (data: any) => postJson("/api/ogdex/boosts", data) as Promise<{ ok: boolean; boost?: Boost; error?: string }>;
export const search = (q: string) => j<{ rows: Row[] }>(`/api/ogdex/search?q=${encodeURIComponent(q)}`);
export const getToken = (mint: string) => j(`/api/ogdex/token?mint=${mint}`);
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
export interface ChartData { ok: boolean; candles: Candle[]; pool?: string | null; poolName?: string | null; dex?: string | null; interval?: string; error?: string; note?: string; }
export const getChart = (mint: string, interval = "1h", limit = 200, chain = "solana") =>
 j(`/api/ogdex/chart?mint=${mint}&interval=${interval}&limit=${limit}&chain=${chain}`);
export interface WalletHolding { mint: string; uiAmount: number; decimals: number; priceUsd: number | null; usdValue: number; change24h?: number | null; name?: string | null; symbol?: string | null; image?: string | null; mcap?: number | null; }
export interface WalletPortfolio { ok: boolean; address: string; sol: number; solPrice: number; solUsd: number; totalUsd: number; tokenCount: number; holdings: WalletHolding[]; pnl?: { realizedPnlUsd: number; realizedPnlSol: number; winRate: number | null; closedTrades: number; totalSwaps: number } | null; error?: string; }
export const getWallet = (address: string) => j(`/api/ogdex/wallet?address=${address}`);
export const getConfig = () => j(`/api/ogdex/config`);
export const getListings = (featuredOnly = false) =>
 j<{ rows: Listing[] }>(`/api/ogdex/listings${featuredOnly ? "?featured=1" : ""}`);
export const submitListing = (data: any) => postJson(`/api/ogdex/listings`, data) as Promise<{ ok: boolean; listing?: Listing; error?: string }>;
export interface SocialItem {
 mint: string | null; symbol?: string | null; name?: string | null; icon?: string | null;
 priceUsd?: number | null; mcap?: number | null; change1h?: number | null; change24h?: number | null;
 volume?: number | null; liquidity?: number | null;
 reason: string; reasons: string[];
 source: "geckoterminal" | "coingecko" | "dexscreener" | string;
 chain?: string; url?: string | null; cgId?: string | null; poolAddress?: string | null;
}
export const getTrendingSocial = () =>
 j<{ count: number; items: SocialItem[]; sources?: string[]; error?: string }>("/api/ogdex/screener?type=social");

export const track = (type: string, extra: any = {}) => {
 try { navigator.sendBeacon?.("/api/ogdex/track", JSON.stringify({ type, ...extra })); }
 catch { fetch("/api/ogdex/track", { method: "POST", body: JSON.stringify({ type, ...extra }), keepalive: true }); }
};
export const adminGet = (pass: string) => j(`/api/ogdex/admin?pass=${encodeURIComponent(pass)}`);
export const adminAction = (pass: string, action: string, id?: string, extra: any = {}) =>
 postJson(`/api/ogdex/admin`, { pass, action, id, ...extra }) as Promise<{ ok: boolean; error?: string }>;

export function fmtUsd(n?: number | null, opts: { compact?: boolean } = {}): string {
 if (n == null || !isFinite(n)) return "—";
 if (opts.compact) return "$" + compact(n);
 if (n < 0.000001 && n > 0) return "$" + n.toExponential(2);
 if (n < 1) return "$" + n.toLocaleString(undefined, { maximumSignificantDigits: 4 });
 return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
export function compact(n?: number | null): string {
 if (n == null || !isFinite(n)) return "—";
 const a = Math.abs(n);
 if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
 if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
 if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
 return n.toFixed(0);
}
export function fmtNum(n?: number | null): string {
 if (n == null || !isFinite(n)) return "—";
 return n.toLocaleString();
}
export function fmtPct(n?: number | null): string {
 if (n == null || !isFinite(n)) return "—";
 return (n > 0 ? "+" : "") + n.toFixed(2) + "%";
}
export function short(addr?: string | null): string {
 if (!addr) return "—";
 return addr.slice(0, 4) + "…" + addr.slice(-4);
}

/* ---- watched wallets (Phantom-style watchlist, localStorage) ---- */
const WL_KEY = "ogdex_watchlist";
export function getWatchlist(): string[] {
 try { return JSON.parse(localStorage.getItem(WL_KEY) || "[]"); } catch { return []; }
}
export function isWatched(addr: string): boolean { return getWatchlist().includes(addr); }
export function toggleWatch(addr: string): boolean {
 const list = getWatchlist();
 const i = list.indexOf(addr);
 if (i >= 0) list.splice(i, 1); else list.unshift(addr);
 localStorage.setItem(WL_KEY, JSON.stringify(list.slice(0, 50)));
 pushWatchlist();
 return list.includes(addr);
}

// ── Cross-device watchlist sync (keyed by connected Phantom wallet) ──
let _syncWallet: string | null = null;
function setLocalWatchlist(items: string[]) { localStorage.setItem(WL_KEY, JSON.stringify(items.slice(0, 50))); }
async function pushWatchlist() {
 if (!_syncWallet) return;
 try { await fetch("/api/ogdex/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet: _syncWallet, items: getWatchlist() }) }); } catch { /* offline */ }
}
export async function pullWatchlist(wallet: string): Promise<string[]> {
 try {
  const r = await fetch(`/api/ogdex/watchlist?wallet=${wallet}`);
  const d = await r.json();
  const server: string[] = d.items || [];
  const merged = Array.from(new Set([...getWatchlist(), ...server]));
  setLocalWatchlist(merged);
  return merged;
 } catch { return getWatchlist(); }
}
export function setWatchlistWallet(wallet: string | null) {
 _syncWallet = wallet;
 if (wallet) { pullWatchlist(wallet).then(() => pushWatchlist()); }
}
/* ---- Token Launcher ---- */
export interface LaunchConfig {
  ok: boolean; feeUsd: number; payWallet: string; solPrice: number | null;
  usdcMint: string; usdtMint: string; solMint: string;
}
export interface LaunchedToken {
  mint: string; symbol?: string | null; name?: string | null; icon?: string | null;
  description?: string | null; creator_wallet?: string | null; created_at: string;
  launch_tx?: string | null; priceUsd?: number | null; mcap?: number | null;
  verified: boolean; boosted: boolean; source?: string;
  links: { pumpfun: string; solscan: string; ogdex: string };
}
export const getLaunchConfig = () => j<LaunchConfig>(`/api/ogdex/launch?config=1`);
export const launchStep = (body: any) =>
  postJson(`/api/ogdex/launch`, body) as Promise<any>;
export const getLaunches = (limit = 50) =>
  j<{ ok: boolean; count: number; rows: LaunchedToken[]; error?: string }>(`/api/ogdex/launches?limit=${limit}`);
