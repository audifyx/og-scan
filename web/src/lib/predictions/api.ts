import { supabase } from "@/lib/supabase";
import type { PredMarket, PredPortfolio, PredPosition, PredTrade, PredCategory, PredSide, PredAction } from "./types";
import { yesPrice } from "./types";

const LOCAL_KEY = "orbitx_pred_v1";

/** Demo markets when Supabase tables aren't migrated yet */
export const DEMO_MARKETS: PredMarket[] = [
  { id: "demo-sol", slug: "sol-200-week", question: "Will SOL close above $200 this week?", description: "CoinGecko SOL/USD ≥ $200 Friday 23:59 UTC.", category: "crypto", image_url: null, status: "open", resolution: null, resolves_at: null, yes_pool: 850, no_pool: 1150, volume_usdc: 84200, traders_count: 412, featured: true, created_at: new Date().toISOString() },
  { id: "demo-pump", slug: "pump-10m", question: "Next Pump.fun graduate hits $10M mcap?", description: "First graduate this week to $10M FDV.", category: "meme", image_url: null, status: "open", resolution: null, resolves_at: null, yes_pool: 620, no_pool: 1380, volume_usdc: 31500, traders_count: 188, featured: true, created_at: new Date().toISOString() },
  { id: "demo-btc", slug: "btc-dom", question: "BTC dominance above 58% by month end?", description: "CoinGecko BTC dominance.", category: "macro", image_url: null, status: "open", resolution: null, resolves_at: null, yes_pool: 980, no_pool: 1020, volume_usdc: 120400, traders_count: 890, featured: false, created_at: new Date().toISOString() },
  { id: "demo-orbitx", slug: "ox-mobile", question: "OrbitX mobile app in public beta by Q4?", description: "Official mobile beta on orbitx.world.", category: "orbitx", image_url: null, status: "open", resolution: null, resolves_at: null, yes_pool: 1100, no_pool: 900, volume_usdc: 18400, traders_count: 96, featured: true, created_at: new Date().toISOString() },
];

function mapMarket(r: Record<string, unknown>): PredMarket {
  return {
    id: String(r.id),
    slug: r.slug as string | null,
    question: String(r.question),
    description: String(r.description || ""),
    category: r.category as PredMarket["category"],
    image_url: r.image_url as string | null,
    status: r.status as PredMarket["status"],
    resolution: r.resolution as PredMarket["resolution"],
    resolves_at: r.resolves_at as string | null,
    yes_pool: Number(r.yes_pool),
    no_pool: Number(r.no_pool),
    volume_usdc: Number(r.volume_usdc),
    traders_count: Number(r.traders_count || 0),
    featured: Boolean(r.featured),
    created_at: String(r.created_at),
  };
}

async function tableExists(): Promise<boolean> {
  const { error } = await supabase.from("pred_markets").select("id").limit(1);
  return !error;
}

export async function listMarkets(opts?: { category?: PredCategory | "all"; featured?: boolean }): Promise<PredMarket[]> {
  if (!(await tableExists())) return filterDemo(opts);

  let q = supabase.from("pred_markets").select("*").eq("status", "open").order("featured", { ascending: false }).order("volume_usdc", { ascending: false });
  if (opts?.category && opts.category !== "all") q = q.eq("category", opts.category);
  if (opts?.featured) q = q.eq("featured", true);
  const { data, error } = await q;
  if (error || !data?.length) return filterDemo(opts);
  return data.map(mapMarket);
}

function filterDemo(opts?: { category?: PredCategory | "all"; featured?: boolean }) {
  let list = [...DEMO_MARKETS];
  if (opts?.category && opts.category !== "all") list = list.filter((m) => m.category === opts.category);
  if (opts?.featured) list = list.filter((m) => m.featured);
  return list;
}

export async function getMarket(id: string): Promise<PredMarket | null> {
  if (!(await tableExists())) return DEMO_MARKETS.find((m) => m.id === id || m.slug === id) ?? null;

  const byId = await supabase.from("pred_markets").select("*").eq("id", id).maybeSingle();
  if (byId.data) return mapMarket(byId.data);
  const bySlug = await supabase.from("pred_markets").select("*").eq("slug", id).maybeSingle();
  if (bySlug.data) return mapMarket(bySlug.data);
  return DEMO_MARKETS.find((m) => m.id === id || m.slug === id) ?? null;
}

export async function getPortfolio(userId: string): Promise<PredPortfolio | null> {
  if (!(await tableExists())) return getLocalPortfolio(userId);

  const { data, error } = await supabase.rpc("pred_get_or_create_portfolio", { p_user: userId });
  if (error) return getLocalPortfolio(userId);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) return getLocalPortfolio(userId);
  return {
    user_id: String(row.user_id),
    usdc_balance: Number(row.usdc_balance),
    initial_balance: Number(row.initial_balance),
    total_trades: Number(row.total_trades),
    realized_pnl: Number(row.realized_pnl),
  };
}

export async function listPositions(userId: string): Promise<PredPosition[]> {
  if (!(await tableExists())) return getLocalPositions(userId);

  const { data } = await supabase.from("pred_positions").select("*, market:pred_markets(*)").eq("user_id", userId).gt("shares", 0);
  return (data || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    market_id: r.market_id,
    side: r.side,
    shares: Number(r.shares),
    avg_price: Number(r.avg_price),
    cost_basis: Number(r.cost_basis),
    market: r.market ? mapMarket(r.market) : undefined,
  }));
}

export async function listTrades(userId: string, limit = 30): Promise<PredTrade[]> {
  if (!(await tableExists())) return [];

  const { data } = await supabase.from("pred_trades").select("*, market:pred_markets(question)").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return (data || []).map((r: any) => ({
    id: r.id,
    market_id: r.market_id,
    side: r.side,
    action: r.action,
    shares: Number(r.shares),
    price: Number(r.price),
    amount_usdc: Number(r.amount_usdc),
    created_at: r.created_at,
    market: r.market ? { question: r.market.question } as any : undefined,
  }));
}

export async function executeTrade(
  userId: string,
  marketId: string,
  side: PredSide,
  action: PredAction,
  amount: number,
): Promise<{ ok: boolean; error?: string; yes_price?: number; shares?: number }> {
  if (marketId.startsWith("demo-")) {
    return executeLocalTrade(userId, marketId, side, action, amount);
  }

  const { data, error } = await supabase.rpc("pred_trade", {
    p_market_id: marketId,
    p_side: side,
    p_action: action,
    p_amount: amount,
  });
  if (error) {
    if (error.message.includes("does not exist") || error.code === "PGRST202") {
      return executeLocalTrade(userId, marketId, side, action, amount);
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, yes_price: Number(data?.yes_price), shares: Number(data?.shares) };
}

/* ── Local demo fallback (pre-migration / offline) ── */
type LocalState = { portfolio: PredPortfolio; positions: PredPosition[]; markets: Record<string, { yes_pool: number; no_pool: number; volume: number }> };

function loadLocal(userId: string): LocalState {
  try {
    const raw = localStorage.getItem(`${LOCAL_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    portfolio: { user_id: userId, usdc_balance: 1000, initial_balance: 1000, total_trades: 0, realized_pnl: 0 },
    positions: [],
    markets: Object.fromEntries(DEMO_MARKETS.map((m) => [m.id, { yes_pool: m.yes_pool, no_pool: m.no_pool, volume: m.volume_usdc }])),
  };
}

function saveLocal(userId: string, s: LocalState) {
  try { localStorage.setItem(`${LOCAL_KEY}_${userId}`, JSON.stringify(s)); } catch { /* ignore */ }
}

function getLocalPortfolio(userId: string): PredPortfolio {
  return loadLocal(userId).portfolio;
}

function getLocalPositions(userId: string): PredPosition[] {
  return loadLocal(userId).positions.filter((p) => p.shares > 0);
}

function executeLocalTrade(userId: string, marketId: string, side: PredSide, action: PredAction, amount: number) {
  const s = loadLocal(userId);
  const pool = s.markets[marketId] || { yes_pool: 1000, no_pool: 1000, volume: 0 };
  const m = { yes_pool: pool.yes_pool, no_pool: pool.no_pool };
  const k = m.yes_pool * m.no_pool;
  const fee = 0.02;

  if (action === "buy") {
    if (s.portfolio.usdc_balance < amount) return { ok: false, error: "Insufficient balance" };
    let shares: number;
    if (side === "yes") {
      const newNo = m.no_pool + amount * (1 - fee);
      const newYes = k / newNo;
      shares = m.yes_pool - newYes;
      pool.yes_pool = newYes;
      pool.no_pool = newNo;
    } else {
      const newYes = m.yes_pool + amount * (1 - fee);
      const newNo = k / newYes;
      shares = m.no_pool - newNo;
      pool.yes_pool = newYes;
      pool.no_pool = newNo;
    }
    s.portfolio.usdc_balance -= amount;
    s.portfolio.total_trades += 1;
    pool.volume += amount;
    const price = side === "yes" ? yesPrice({ yes_pool: pool.yes_pool, no_pool: pool.no_pool }) : 1 - yesPrice({ yes_pool: pool.yes_pool, no_pool: pool.no_pool });
    let pos = s.positions.find((p) => p.market_id === marketId && p.side === side);
    if (!pos) {
      pos = { id: crypto.randomUUID(), user_id: userId, market_id: marketId, side, shares: 0, avg_price: 0, cost_basis: 0 };
      s.positions.push(pos);
    }
    pos.shares += shares;
    pos.cost_basis += amount;
    pos.avg_price = pos.cost_basis / pos.shares;
    s.markets[marketId] = pool;
    saveLocal(userId, s);
    return { ok: true, shares, yes_price: yesPrice({ yes_pool: pool.yes_pool, no_pool: pool.no_pool }) };
  }

  const pos = s.positions.find((p) => p.market_id === marketId && p.side === side);
  if (!pos || pos.shares < amount) return { ok: false, error: "Insufficient shares" };
  const price = side === "yes" ? yesPrice({ yes_pool: pool.yes_pool, no_pool: pool.no_pool }) : 1 - yesPrice({ yes_pool: pool.yes_pool, no_pool: pool.no_pool });
  const proceeds = amount * price;
  s.portfolio.usdc_balance += proceeds;
  s.portfolio.total_trades += 1;
  pos.shares -= amount;
  pos.cost_basis = Math.max(0, pos.cost_basis - pos.avg_price * amount);
  saveLocal(userId, s);
  return { ok: true, shares: amount, yes_price: yesPrice({ yes_pool: pool.yes_pool, no_pool: pool.no_pool }) };
}
