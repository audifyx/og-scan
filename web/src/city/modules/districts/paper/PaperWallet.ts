/**
 * Paper CITY ledger + paper trading positions.
 *
 * Paper CITY is the gameplay currency (local ledger, no chain) per the
 * billing contract. The stock exchange terminals trade against LIVE quotes
 * (fed in from `useLivePrices`) but settle in paper CITY only — never real
 * ORBITX. Persists to localStorage so the paper portfolio survives reloads.
 */
import type { PaperTradeResult, TokenQuote } from "../types";

const STORAGE_KEY = "orbitxcity:paper-wallet:v1";
export const STARTING_CITY = 10_000;

export interface PaperPosition {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  notionalCity: number;
  at: number;
}

export interface PaperWalletSnapshot {
  city: number;
  positions: Record<string, PaperPosition>;
  realizedPnl: number;
  trades: PaperTrade[];
}

function load(): PaperWalletSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PaperWalletSnapshot;
      if (typeof parsed.city === "number") return parsed;
    }
  } catch { /* noop */ }
  return { city: STARTING_CITY, positions: {}, realizedPnl: 0, trades: [] };
}

export class PaperWallet {
  private state: PaperWalletSnapshot = load();
  private listeners = new Set<() => void>();

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch { /* noop */ }
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  snapshot(): PaperWalletSnapshot {
    return JSON.parse(JSON.stringify(this.state)) as PaperWalletSnapshot;
  }

  get city(): number { return this.state.city; }

  /** Add/subtract raw paper CITY (hospital bills, fines, wages). */
  adjustCity(delta: number): number {
    this.state.city = Math.max(0, this.state.city + delta);
    this.save();
    return this.state.city;
  }

  /** Spend paper CITY if affordable. Returns false when broke. */
  trySpend(amount: number): boolean {
    if (amount <= 0 || this.state.city < amount) return false;
    this.state.city -= amount;
    this.save();
    return true;
  }

  buy(symbol: string, price: number, notionalCity: number): PaperTradeResult {
    const sym = symbol.toUpperCase();
    if (!(price > 0)) return { ok: false, message: "No live quote for " + sym, symbol: sym, side: "buy", qty: 0, price, notionalCity };
    if (!(notionalCity > 0)) return { ok: false, message: "Enter an amount", symbol: sym, side: "buy", qty: 0, price, notionalCity };
    if (this.state.city < notionalCity) {
      return { ok: false, message: `Insufficient paper CITY (have ${Math.floor(this.state.city)})`, symbol: sym, side: "buy", qty: 0, price, notionalCity };
    }
    const qty = notionalCity / price;
    const existing = this.state.positions[sym];
    const newQty = (existing?.qty ?? 0) + qty;
    const newAvg = existing
      ? (existing.avgPrice * existing.qty + price * qty) / newQty
      : price;
    this.state.positions[sym] = { symbol: sym, qty: newQty, avgPrice: newAvg };
    this.state.city -= notionalCity;
    this.state.trades.unshift({ id: crypto.randomUUID(), symbol: sym, side: "buy", qty, price, notionalCity, at: Date.now() });
    this.state.trades = this.state.trades.slice(0, 100);
    this.save();
    return { ok: true, message: `Bought ${qty.toFixed(4)} ${sym}`, symbol: sym, side: "buy", qty, price, notionalCity };
  }

  sell(symbol: string, price: number, notionalCity: number): PaperTradeResult {
    const sym = symbol.toUpperCase();
    if (!(price > 0)) return { ok: false, message: "No live quote for " + sym, symbol: sym, side: "sell", qty: 0, price, notionalCity };
    const pos = this.state.positions[sym];
    if (!pos || pos.qty <= 0) {
      return { ok: false, message: `No position in ${sym}`, symbol: sym, side: "sell", qty: 0, price, notionalCity };
    }
    // Sell by notional: qty = min(notional/price, held)
    const qty = Math.min(notionalCity > 0 ? notionalCity / price : pos.qty, pos.qty);
    const proceeds = qty * price;
    const pnl = (price - pos.avgPrice) * qty;
    this.state.realizedPnl += pnl;
    pos.qty -= qty;
    if (pos.qty < 1e-9) delete this.state.positions[sym];
    this.state.city += proceeds;
    this.state.trades.unshift({ id: crypto.randomUUID(), symbol: sym, side: "sell", qty, price, notionalCity: proceeds, at: Date.now() });
    this.state.trades = this.state.trades.slice(0, 100);
    this.save();
    return {
      ok: true,
      message: `Sold ${qty.toFixed(4)} ${sym} · ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} PnL`,
      symbol: sym, side: "sell", qty, price, notionalCity: proceeds,
    };
  }

  /** Mark-to-market equity in paper CITY given live quotes. */
  equity(quotes: Record<string, TokenQuote> | TokenQuote[]): number {
    const map: Record<string, number> = {};
    if (Array.isArray(quotes)) {
      for (const q of quotes) map[q.symbol.toUpperCase()] = q.price;
    } else {
      for (const k of Object.keys(quotes)) map[k.toUpperCase()] = quotes[k].price;
    }
    let positionsValue = 0;
    for (const sym of Object.keys(this.state.positions)) {
      const p = this.state.positions[sym];
      const px = map[sym] ?? 0;
      positionsValue += p.qty * px;
    }
    return this.state.city + positionsValue;
  }

  positionPnl(symbol: string, price: number): number {
    const pos = this.state.positions[symbol.toUpperCase()];
    if (!pos || !(price > 0)) return 0;
    return (price - pos.avgPrice) * pos.qty;
  }

  reset(): void {
    this.state = { city: STARTING_CITY, positions: {}, realizedPnl: 0, trades: [] };
    this.save();
  }
}

/** Module-level singleton — one paper portfolio per player. */
export const paperWallet = new PaperWallet();
