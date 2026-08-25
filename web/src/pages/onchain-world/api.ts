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
  wallet_label?: string | null;
  wallet_twitter?: string | null;
};

export type KolCard = {
  address: string;
  name: string;
  twitter: string | null;
  status: string;
  hits?: number;
  last_type: string | null;
  last_token: string | null;
  last_usd: number | null;
  last_at: string | null;
  tracked?: boolean;
  label_kind?: string;
};

export type FlowRow = {
  from_address: string;
  to_address: string;
  token_ca?: string | null;
  token_symbol: string | null;
  total_amount?: number | null;
  total_sol: number | null;
  total_usd: number | null;
  transfer_count: number;
  last_signature: string | null;
  last_seen?: string | null;
};

export type WalletTokenRow = {
  wallet?: string;
  token_ca: string;
  token_symbol?: string | null;
  balance?: number | null;
  amount?: number | null;
  bought?: number;
  sold?: number;
  burned?: number;
  bought_amount?: number;
  sold_amount?: number;
  burned_amount?: number;
  bought_usd?: number;
  sold_usd?: number;
  last_event_at?: string | null;
};

export type WalletHolding = {
  mint: string;
  amount: number;
  decimals?: number;
  symbol: string | null;
  name?: string | null;
  image?: string | null;
  price_usd?: number | null;
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
    assigned_kols?: number;
  };
  events: ChainEvent[];
  kols?: KolCard[];
  flows?: FlowRow[];
  note?: string;
  error?: string;
};

export type WalletPayload = {
  ok: boolean;
  address: string;
  kind?: string;
  kol?: { address: string; name: string; twitter: string | null; status: string } | null;
  assigned_kol?: boolean;
  label?: string | null;
  label_kind?: string | null;
  sol?: number | null;
  orbitx?: WalletTokenRow | null;
  holdings?: WalletHolding[];
  events?: ChainEvent[];
  flows?: FlowRow[];
  note?: string;
  error?: string;
};

export type TokenPayload = {
  ok: boolean;
  mint: string;
  token?: {
    mint?: string;
    symbol?: string | null;
    name?: string | null;
    price_usd?: number | null;
    market_cap?: number | null;
  };
  events?: ChainEvent[];
  buyers?: WalletTokenRow[];
  error?: string;
};

export type OrbitxPayload = {
  ok: boolean;
  mint: string;
  events?: ChainEvent[];
  burns?: ChainEvent[];
  buys?: ChainEvent[];
  sells?: ChainEvent[];
  burners?: WalletTokenRow[];
  buyers?: WalletTokenRow[];
  totals?: {
    burned?: number;
    burn_events?: number;
    largest_burn?: number;
    unique_wallets?: number;
    buy_usd?: number;
    sell_usd?: number;
  };
  error?: string;
};

export type KolsPayload = {
  ok: boolean;
  count: number;
  kols: KolCard[];
  events: ChainEvent[];
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
  return getJson<WalletPayload>(`wallet/${encodeURIComponent(address)}`);
}

export function fetchToken(mint: string) {
  return getJson<TokenPayload>(`token/${encodeURIComponent(mint)}`);
}

export function fetchTx(signature: string) {
  return getJson<Record<string, unknown>>(`transaction/${encodeURIComponent(signature)}`);
}

export function fetchOrbitx() {
  return getJson<OrbitxPayload>("orbitx");
}

export function fetchFlows(address: string) {
  return getJson<{ ok: boolean; flows?: FlowRow[] }>(`flows/${encodeURIComponent(address)}`);
}

export function fetchStatus() {
  return getJson<Record<string, unknown>>("status");
}

export function fetchKols() {
  return getJson<KolsPayload>("kols");
}
