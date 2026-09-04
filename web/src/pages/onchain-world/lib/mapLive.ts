import { APP_VERSION, EMPTY_BREAKDOWN, EMPTY_SNAPSHOT } from "./orbitx/constants";
import type {
  BreakdownKey,
  BreakdownSlice,
  DashboardSnapshot,
  EventKind,
  LiveEvent,
  TransactionRow,
  WalletSnapshot,
} from "./orbitx/types";
import type { ChainEvent, LivePayload, WalletPayload } from "../api";
import { clock } from "../format";
import { tokenDisplayName, tokenTicker } from "../../../../shared/orbitx-chain-districts.js";
import { isOrbitxMint } from "../../../../shared/orbitx-chain-intel.js";

export function eventKind(ev: ChainEvent): EventKind {
  const t = String(ev.event_type || "").toUpperCase();
  if (ev.kol_related && t.includes("SELL")) return "kol_sell";
  if (ev.kol_related && t.includes("BUY")) return "kol_buy";
  const ox = ev.orbitx_related || isOrbitxMint(ev.token_ca) || t.includes("ORBITX");
  if (t.includes("LAUNCH")) return "token_launch";
  if (t.includes("LIQUIDITY")) return "liquidity_add";
  if (t.includes("BURN") && ox) return "orbitx_burn";
  if (t.includes("BURN")) return "orbitx_burn";
  if (ox && t.includes("SELL")) return "orbitx_sell";
  if (ox && t.includes("BUY")) return "orbitx_buy";
  if (ox && t.includes("SWAP")) return "token_swap";
  if (ev.whale_related && (t.includes("SELL") || t.includes("SWAP"))) return "whale_sell";
  if (t.includes("SELL")) return "token_sell";
  if (t.includes("BUY")) return "token_buy";
  if (t.includes("SWAP")) return "token_swap";
  if (t.includes("SOL") || t.includes("TRANSFER")) return "sol_transfer";
  return "other";
}

export function isOrbitxChainEvent(ev: ChainEvent | null | undefined): boolean {
  if (!ev) return false;
  if (ev.orbitx_related) return true;
  if (isOrbitxMint(ev.token_ca)) return true;
  const t = String(ev.event_type || "").toUpperCase();
  if (t.includes("ORBITX")) return true;
  if (/orbitx/i.test(String(ev.token_name || "")) || /orbitx/i.test(String(ev.token_symbol || ""))) return true;
  return false;
}

export function mergeChainEvents(...lists: Array<ChainEvent[] | null | undefined>): ChainEvent[] {
  const byId = new Map<string, ChainEvent>();
  for (const list of lists) {
    for (const ev of list || []) {
      if (!ev?.event_id) continue;
      byId.set(ev.event_id, ev);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const tb = Date.parse(b.block_time || "") || 0;
    const ta = Date.parse(a.block_time || "") || 0;
    return tb - ta;
  });
}

function eventTitle(ev: ChainEvent): string {
  const t = String(ev.event_type || "").replace(/_/g, " ");
  return t || "CHAIN EVENT";
}

export function toLiveEvent(ev: ChainEvent): LiveEvent {
  const name = tokenDisplayName({ name: ev.token_name, symbol: ev.token_symbol, mint: ev.token_ca });
  const ticker = tokenTicker({ symbol: ev.token_symbol, mint: ev.token_ca });
  const amountLabel =
    ev.amount != null
      ? `${ev.amount} ${ticker || ""}`.trim()
      : ev.sol_amount != null
        ? `${ev.sol_amount} SOL`
        : undefined;
  return {
    id: ev.event_id,
    kind: eventKind(ev),
    title: eventTitle(ev),
    token: name || (ticker ? `$${ticker}` : undefined),
    tokenName: name,
    tokenImage: ev.token_image,
    mint: ev.token_ca,
    amountLabel,
    usd: ev.usd_value ?? null,
    detail: ev.description || ev.wallet_label || ev.wallet || ev.source_wallet || undefined,
    wallet: ev.wallet || ev.source_wallet || undefined,
    ts: ev.block_time ? Date.parse(ev.block_time) || Date.now() : Date.now(),
  };
}

export function toTransactionRow(ev: ChainEvent): TransactionRow {
  const amount =
    ev.amount != null
      ? String(ev.amount)
      : ev.sol_amount != null
        ? `${ev.sol_amount} SOL`
        : "—";
  return {
    id: ev.event_id,
    time: clock(ev.block_time),
    kind: eventKind(ev),
    wallet: ev.wallet || ev.source_wallet || "",
    token: tokenDisplayName({ name: ev.token_name, symbol: ev.token_symbol, mint: ev.token_ca })
      || (tokenTicker({ symbol: ev.token_symbol, mint: ev.token_ca }) ? `$${tokenTicker({ symbol: ev.token_symbol, mint: ev.token_ca })}` : ev.event_type?.includes("SOL") ? "SOL" : "—"),
    amount,
    usd: ev.usd_value ?? null,
    signature: ev.signature || "",
  };
}

const BREAKDOWN_KEYS: BreakdownKey[] = ["buy", "sell", "swap", "transfer", "burn", "other"];

function breakdownKey(kind: string): BreakdownKey {
  const k = kind.toLowerCase();
  if ((BREAKDOWN_KEYS as string[]).includes(k)) return k as BreakdownKey;
  if (k.includes("buy")) return "buy";
  if (k.includes("sell")) return "sell";
  if (k.includes("swap")) return "swap";
  if (k.includes("transfer") || k.includes("sol")) return "transfer";
  if (k.includes("burn")) return "burn";
  return "other";
}

export function toBreakdown(parts: LivePayload["breakdown"]): BreakdownSlice[] {
  if (!parts?.length) return EMPTY_BREAKDOWN.map((row) => ({ ...row }));
  const byKey = new Map<BreakdownKey, number>();
  for (const part of parts) {
    const key = breakdownKey(part.kind);
    byKey.set(key, (byKey.get(key) || 0) + (part.pct || 0));
  }
  return EMPTY_BREAKDOWN.map((row) => ({
    ...row,
    pct: byKey.get(row.key) ?? 0,
  }));
}

function confirmedNum(value: number | null | undefined, live: boolean, hasEvents: boolean): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (!live && !hasEvents && n === 0) return null;
  return n;
}

export function toWalletSnapshot(data: WalletPayload): WalletSnapshot {
  const holdings = data.holdings || [];
  const flows = data.flows || [];
  return {
    address: data.address,
    tracked: true,
    balances: [
      { symbol: "SOL", amount: data.sol ?? null, usd: null },
      {
        symbol: "ORBITX",
        mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
        amount: data.orbitx?.amount ?? data.orbitx?.balance ?? null,
        usd: null,
      },
      ...holdings.map((h) => ({
        symbol: tokenTicker(h) || "TOKEN",
        name: tokenDisplayName(h),
        mint: h.mint,
        amount: h.amount ?? null,
        usd: h.price_usd != null ? h.price_usd * (h.amount || 0) : null,
        icon: h.image || undefined,
      })),
    ],
    totalTransactions: data.events?.length ?? null,
    solReceived: null,
    solSent: null,
    tokensTraded: holdings.length || null,
    firstSeen: null,
    walletAgeDays: null,
    orbitxPurchasedUsd: data.orbitx?.bought_usd ?? null,
    orbitxSoldUsd: data.orbitx?.sold_usd ?? null,
    orbitxBurned: data.orbitx?.burned ?? data.orbitx?.burned_amount ?? null,
    orbitxHoldings: data.orbitx?.amount ?? data.orbitx?.balance ?? null,
    orbitxAvgBuy: null,
    activity: [],
    counterparties: flows.slice(0, 8).map((f) => ({
      address: f.to_address === data.address ? f.from_address : f.to_address,
      txs: f.transfer_count,
      sol: f.total_sol ?? 0,
    })),
  };
}

export function liveToSnapshot(data: LivePayload, wallet?: WalletPayload | null): DashboardSnapshot {
  const events = data.events || [];
  const hasEvents = events.length > 0;
  const live = Boolean(data.live);
  const wsRaw = String(data.websocket_status || "");
  return {
    ticker: {
      block: data.last_slot ?? data.chain_slot ?? null,
      blockAgeSec: data.ingest_age_sec ?? null,
      eventsPerSec: confirmedNum(data.stats?.events_per_sec, live, hasEvents),
      txPerMin: confirmedNum(data.stats?.transactions_per_min, live, hasEvents),
      buys: confirmedNum(data.stats?.buys, live, hasEvents),
      sells: confirmedNum(data.stats?.sells, live, hasEvents),
      swaps: confirmedNum(data.stats?.swaps, live, hasEvents),
      transfers: confirmedNum(data.stats?.transfers, live, hasEvents),
      burns: confirmedNum(data.stats?.burns, live, hasEvents),
      kolEvents: confirmedNum(data.stats?.kol_events, live, hasEvents),
      orbitxBuys: confirmedNum(data.stats?.orbitx_buys, live, hasEvents),
      orbitxSells: confirmedNum(data.stats?.orbitx_sells, live, hasEvents),
      orbitxBuys24h: data.stats?.orbitx_buys_24h ?? data.districts?.orbitx?.buys_24h ?? null,
      orbitxSells24h: data.stats?.orbitx_sells_24h ?? data.districts?.orbitx?.sells_24h ?? null,
      orbitxTraders24h: data.stats?.orbitx_traders_24h ?? data.districts?.orbitx?.traders_24h ?? null,
      orbitxBurned: confirmedNum(data.stats?.orbitx_burned, live, hasEvents),
      whaleActivityUsd: confirmedNum(data.stats?.whale_usd, live, hasEvents),
      activeWallets: confirmedNum(data.stats?.active_wallets, live, hasEvents),
    },
    events: events.map(toLiveEvent),
    breakdown: toBreakdown(data.breakdown),
    transactions: events.map(toTransactionRow),
    eventRate: (data.eps_series || []).map((p) => ({
      t: p.t ? new Date(p.t).toISOString().slice(11, 19) : "—",
      v: p.eps,
    })),
    wallet: wallet?.ok ? toWalletSnapshot(wallet) : wallet?.address ? toWalletSnapshot(wallet) : EMPTY_SNAPSHOT.wallet,
    network: {
      name: "Solana Mainnet",
      rpc: data.chain_slot != null || live ? "healthy" : "idle",
      lastIndexedBlock: data.last_slot ?? data.chain_slot ?? null,
      indexingDelaySec: data.ingest_age_sec ?? null,
      ws: (wsRaw === "connected" || wsRaw === "polling") && (live || data.chain_slot != null)
        ? "connected"
        : "disconnected",
      version: APP_VERSION,
      live,
      liveLabel: data.live_label || (live ? "LIVE" : "INDEXING DELAY"),
      liveReason: data.live_reason || null,
    },
  };
}
