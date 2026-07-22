/** OrbitX Curve — Supabase data access + client-side aggregation. */
import { supabase } from "@/lib/supabase";

export interface CurveMarketRow {
  token_address: string; chain: string; name?: string; symbol?: string;
  creator_wallet: string; fee_bps?: number; creator_fee_bps?: number;
  virtual_native?: string; graduation_native?: string; real_native?: string;
  token_reserve?: string; price_x1e18?: string; graduated?: boolean;
  launch_tx?: string; created_at?: string; updated_at?: string;
}

export interface CurveTradeRow {
  id?: number; token_address: string; chain: string; trader_wallet: string;
  side: "buy" | "sell"; native_amount: string; token_amount: string;
  price_x1e18?: string; tx_hash: string; block_time?: string | null; created_at?: string;
}

export type MarketSort = "price" | "graduation" | "newest";

const big = (v?: string | null): bigint => { try { return BigInt(v ?? "0"); } catch { return 0n; } };

export function graduationPct(m: CurveMarketRow): number {
  const g = big(m.graduation_native);
  if (g === 0n) return 0;
  return Math.min(100, Number((big(m.real_native) * 10000n) / g) / 100);
}

export async function listCurveMarkets(sort: MarketSort = "newest", limit = 100): Promise<CurveMarketRow[]> {
  const { data, error } = await supabase.from("orbitx_curve_markets").select("*").limit(limit);
  if (error || !data) return [];
  const rows = data as CurveMarketRow[];
  const cmp: Record<MarketSort, (a: CurveMarketRow, b: CurveMarketRow) => number> = {
    price: (a, b) => (big(b.price_x1e18) > big(a.price_x1e18) ? 1 : big(b.price_x1e18) < big(a.price_x1e18) ? -1 : 0),
    graduation: (a, b) => graduationPct(b) - graduationPct(a),
    newest: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  };
  return rows.sort(cmp[sort]);
}

export async function getCurveMarket(token: string): Promise<CurveMarketRow | null> {
  const { data } = await supabase.from("orbitx_curve_markets").select("*").eq("token_address", token).maybeSingle();
  return (data as CurveMarketRow) ?? null;
}

export async function listCurveTrades(token: string, limit = 100): Promise<CurveTradeRow[]> {
  const { data } = await supabase.from("orbitx_curve_trades").select("*")
    .eq("token_address", token).order("id", { ascending: false }).limit(limit);
  return ((data as CurveTradeRow[]) ?? []).reverse(); // oldest -> newest
}

/** Realtime INSERT subscription for a token's trades. Returns an unsubscribe fn. */
export function subscribeCurveTrades(token: string, onInsert: (t: CurveTradeRow) => void): () => void {
  const ch = supabase
    .channel(`orbitx_curve_trades_${token}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "orbitx_curve_trades", filter: `token_address=eq.${token}` },
      (payload: { new: CurveTradeRow }) => onInsert(payload.new))
    .subscribe();
  return () => { try { supabase.removeChannel(ch); } catch { /* noop */ } };
}

export interface Holder { wallet: string; tokens: bigint }

/** Approximate holders from the trade ledger (net buy - sell per wallet). */
export function aggregateHolders(trades: CurveTradeRow[]): Holder[] {
  const map = new Map<string, bigint>();
  for (const t of trades) {
    const amt = big(t.token_amount);
    const cur = map.get(t.trader_wallet) ?? 0n;
    map.set(t.trader_wallet, cur + (t.side === "buy" ? amt : -amt));
  }
  return [...map.entries()]
    .map(([wallet, tokens]) => ({ wallet, tokens }))
    .filter((h) => h.tokens > 0n)
    .sort((a, b) => (b.tokens > a.tokens ? 1 : b.tokens < a.tokens ? -1 : 0));
}

/** Estimated creator earnings (native) from the ledger, using the creator fee bps. */
export function creatorEarnings(trades: CurveTradeRow[], creatorFeeBps = 50): bigint {
  let sum = 0n;
  for (const t of trades) sum += (big(t.native_amount) * BigInt(creatorFeeBps)) / 10000n;
  return sum;
}

export function fmtUnits(v: bigint, dec = 18, places = 6): string {
  const neg = v < 0n; if (neg) v = -v;
  const base = 10n ** BigInt(dec);
  const int = v / base;
  const frac = (v % base).toString().padStart(dec, "0").slice(0, places).replace(/0+$/, "");
  return (neg ? "-" : "") + int.toString() + (frac ? "." + frac : "");
}
export const shortWallet = (a: string): string => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
