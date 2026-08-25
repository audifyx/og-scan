export type ChainEvent = {
  event_id: string;
  signature: string;
  slot: number | null;
  block_time: string | null;
  event_type: string;
  status: string;
  source: string | null;
  attribution: string;
  wallet: string | null;
  counterparty: string | null;
  source_wallet: string | null;
  destination_wallet: string | null;
  token_ca: string | null;
  token_symbol: string | null;
  token_name: string | null;
  token_image: string | null;
  amount: number | null;
  sol_amount: number | null;
  usd_value: number | null;
  market_cap: number | null;
  orbitx_related: boolean;
  kol_related: boolean;
  whale_related: boolean;
  importance: number;
  confidence: string;
  description: string | null;
};

export type LivePayload = {
  ok: boolean;
  live: boolean;
  live_label: string;
  live_reason: string | null;
  chain_slot: number | null;
  last_slot: number | null;
  lag_slots: number | null;
  last_ingest_at: string | null;
  websocket_status: string;
  sol_usd: number | null;
  stats: {
    events_per_sec: number;
    transactions_per_min: number;
    orbitx_buys: number;
    orbitx_burned: number;
    whale_usd: number;
    active_wallets: number;
  };
  events: ChainEvent[];
  note?: string;
  error?: string;
};

export type FilterState = {
  type: string;
  orbitx: boolean;
  whale: boolean;
  kol: boolean;
  minUsd: string;
  source: string;
  token: string;
  wallet: string;
};

export function filtersToQuery(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.type) p.set("type", f.type);
  if (f.orbitx) p.set("orbitx", "1");
  if (f.whale) p.set("whale", "1");
  if (f.kol) p.set("kol", "1");
  if (f.minUsd) p.set("min_usd", f.minUsd);
  if (f.source) p.set("source", f.source);
  if (f.token) p.set("token", f.token);
  if (f.wallet) p.set("wallet", f.wallet);
  return p.toString();
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`/api/on-chain/${path}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({ ok: false, error: "Invalid response" }));
  return j as T;
}

export function fetchLive(filters: FilterState): Promise<LivePayload> {
  const q = filtersToQuery(filters);
  return getJson<LivePayload>(`live${q ? `?${q}` : ""}`);
}

export function fetchSearch(q: string) {
  return getJson<Record<string, unknown>>(`search?q=${encodeURIComponent(q)}`);
}

export function fetchWallet(address: string) {
  return getJson<Record<string, unknown>>(`wallet/${encodeURIComponent(address)}`);
}

export function fetchToken(mint: string) {
  return getJson<Record<string, unknown>>(`token/${encodeURIComponent(mint)}`);
}

export function fetchTx(signature: string) {
  return getJson<Record<string, unknown>>(`transaction/${encodeURIComponent(signature)}`);
}

export function fetchOrbitx() {
  return getJson<Record<string, unknown>>("orbitx");
}

export function fetchFlows(address: string) {
  return getJson<Record<string, unknown>>(`flows/${encodeURIComponent(address)}`);
}

export function fetchStatus() {
  return getJson<Record<string, unknown>>("status");
}
