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
  last_mint?: string | null;
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
  ingest_age_sec?: number | null;
  websocket_status: string;
  sol_usd: number | null;
  stats: {
    events_per_sec: number;
    transactions_per_min: number;
    buys?: number;
    sells?: number;
    swaps?: number;
    transfers?: number;
    burns?: number;
    kol_events?: number;
    orbitx_buys?: number;
    orbitx_sells?: number;
    orbitx_buys_24h?: number | null;
    orbitx_sells_24h?: number | null;
    orbitx_traders_24h?: number | null;
    orbitx_burned: number;
    whale_usd: number;
    active_wallets: number;
    assigned_kols?: number;
  };
  breakdown?: { kind: string; count: number; pct: number }[];
  eps_series?: { t: number; eps: number }[];
  districts?: CityDistricts;
  events: ChainEvent[];
  kols?: KolCard[];
  flows?: FlowRow[];
  note?: string;
  error?: string;
};

export type TokenDistrict = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  image?: string | null;
  banner?: string | null;
  price_usd?: number | null;
  market_cap?: number | null;
  liquidity_usd?: number | null;
  volume_24h?: number | null;
  change_24h?: number | null;
  change_1h?: number | null;
  holder_count?: number | null;
  buys_24h?: number | null;
  sells_24h?: number | null;
  traders_24h?: number | null;
  buy_volume_24h?: number | null;
  sell_volume_24h?: number | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  launch_platform?: string | null;
  dex?: string | null;
  source?: string;
  kind?: string;
};

export type DexHub = { id: string; label: string; kind: string; program?: string };

export type CityDistricts = {
  orbitx?: TokenDistrict;
  hubs?: DexHub[];
  tokens?: TokenDistrict[];
  trending_count?: number;
  window?: string;
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
  token?: TokenDistrict;
  events?: ChainEvent[];
  buyers?: WalletTokenRow[];
  error?: string;
};

export type TrendingPayload = {
  ok: boolean;
  window?: string;
  count: number;
  orbitx?: TokenDistrict | null;
  tokens: TokenDistrict[];
  error?: string;
};

export type OrbitxPayload = {
  ok: boolean;
  mint: string;
  token?: TokenDistrict | null;
  events?: ChainEvent[];
  burns?: ChainEvent[];
  buys?: ChainEvent[];
  sells?: ChainEvent[];
  burners?: WalletTokenRow[];
  buyers?: WalletTokenRow[];
  daily?: Array<{
    day?: string;
    buys?: number;
    sells?: number;
    burns?: number;
    volume_usd?: number | null;
  }>;
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
  tracked: boolean;
  minUsd: string;
  source: string;
  token: string;
  wallet: string;
  window: string;
};

export function filtersToQuery(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.type) p.set("type", f.type);
  if (f.orbitx) p.set("orbitx", "1");
  if (f.whale) p.set("whale", "1");
  if (f.kol) p.set("kol", "1");
  if (f.tracked) p.set("tracked", "1");
  if (f.minUsd) p.set("min_usd", f.minUsd);
  if (f.source) p.set("source", f.source);
  if (f.token) p.set("token", f.token);
  if (f.wallet) p.set("wallet", f.wallet);
  if (f.window && f.window !== "live") p.set("window", f.window);
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

export function fetchWallet(address: string) {
  return getJson<WalletPayload>(`wallet/${encodeURIComponent(address)}`);
}

export function fetchToken(mint: string) {
  return getJson<TokenPayload>(`token/${encodeURIComponent(mint)}`);
}

export type TxPayload = {
  ok: boolean;
  signature: string;
  slot?: number | null;
  block_time?: string | null;
  status?: string;
  fee?: number | null;
  events?: ChainEvent[];
  raw?: unknown;
  parsed?: unknown;
  error?: string;
};

export type BlockPayload = {
  ok: boolean;
  slot: number;
  block_time?: string | null;
  signatures?: string[];
  transaction_count?: number | null;
  error?: string;
};

export type SearchPayload = {
  ok: boolean;
  kind?: string;
  query?: string;
  mint?: string;
  address?: string;
  signature?: string;
  slot?: number | null;
  token?: TokenDistrict;
  tokens?: TokenDistrict[];
  pairs?: Array<{
    mint?: string;
    symbol?: string | null;
    name?: string | null;
    image?: string | null;
    price_usd?: number | null;
    market_cap?: number | null;
    volume_24h?: number | null;
    dex?: string | null;
  }>;
  error?: string;
};

export function fetchSearch(q: string) {
  return getJson<SearchPayload>(`search?q=${encodeURIComponent(q)}`);
}

export function fetchTx(signature: string) {
  return getJson<TxPayload>(`transaction/${encodeURIComponent(signature)}`);
}

export function fetchBlock(slot: string | number) {
  return getJson<BlockPayload>(`block/${encodeURIComponent(String(slot))}`);
}

export type PaperFill = {
  hour: number;
  at: string;
  mint: string;
  symbol: string;
  name?: string;
  image?: string | null;
  side: string;
  sol: number;
  pnl_sol: number;
  move_pct: number;
  thesis: string;
  current?: boolean;
  change_1h?: number | null;
  volume_24h?: number | null;
};

export type PaperAgent = {
  id: string;
  name: string;
  style: string;
  color: string;
  blurb?: string;
  equity_sol: number;
  pnl_sol: number;
  pnl_pct: number;
  wins: number;
  losses: number;
  win_pct: number;
  live?: PaperFill | null;
  fills?: PaperFill[];
};

export type PaperDeskPayload = {
  ok?: boolean;
  mock?: boolean;
  stake_sol?: number;
  desk_equity_sol?: number;
  desk_pnl_sol?: number;
  agent_count?: number;
  next_hour_at?: string;
  agents?: PaperAgent[];
  error?: string;
};

export type LiveDeskPayload = {
  ok?: boolean;
  live?: boolean;
  mock?: boolean;
  paper?: boolean;
  mode?: "paper" | "live" | string;
  paper_start_usd?: number | null;
  disclaimer?: string;
  wallet?: string;
  enabled?: boolean;
  armed?: boolean;
  paused?: boolean;
  configured?: boolean;
  skipped?: string | null;
  trade_usd?: number;
  max_open?: number;
  sol_usd?: number | null;
  sol_balance?: number | null;
  usd_balance?: number | null;
  equity_usd?: number | null;
  realized_pnl_usd?: number | null;
  starting_usd?: number | null;
  starting_sol?: number | null;
  last_tick_at?: string | null;
  last_activity_at?: string | null;
  last_error?: string | null;
  fundUrl?: string;
  worldUrl?: string;
  hunt?: Array<{
    mint: string;
    symbol?: string;
    clipUsd?: number;
    scaleMcap?: number;
    flattenMcap?: number;
  }>;
  ledger?: {
    started_usd?: number | null;
    started_sol?: number | null;
    currently_usd?: number | null;
    currently_sol?: number | null;
    made_usd?: number | null;
    made_pct?: number | null;
    wins?: number;
    losses?: number;
    trades?: number;
    win_pct?: number;
    holding?: LiveDeskPayload["open"] extends (infer T)[] | undefined ? T | null : null;
  };
  open?: Array<{
    id?: string;
    agent_id?: string;
    agent_name?: string;
    mint?: string;
    symbol?: string;
    usd_in?: number;
    sol_in?: number;
    entry_price_usd?: number;
    mark_usd?: number | null;
    pnl_pct?: number | null;
    tp_pct?: number;
    thesis?: string;
    signature?: string;
  }>;
  fills?: Array<{
    id?: string;
    agent_id?: string;
    mint?: string;
    symbol?: string;
    side?: string;
    usd_amount?: number;
    pnl_usd?: number | null;
    pnl_pct?: number | null;
    reason?: string;
    thesis?: string;
    signature?: string;
    created_at?: string;
  }>;
  agents?: Array<{
    id: string;
    name: string;
    style: string;
    tpPct: number;
    color: string;
    blurb?: string;
    currently_hold?: string;
    wins?: number;
    losses?: number;
    trades?: number;
    win_pct?: number;
    realized_pnl_usd?: number;
    unrealized_pnl_usd?: number;
    made_usd?: number;
    deployed_usd?: number;
    open?: LiveDeskPayload["open"] extends (infer T)[] | undefined ? T | null : null;
    last?: unknown;
  }>;
  events?: Array<{
    id?: string;
    created_at?: string;
    kind?: string;
    agent_id?: string;
    mint?: string;
    symbol?: string;
    thesis?: string;
    reason?: string;
    signature?: string;
  }>;
  chain?: Array<{
    signature?: string;
    slot?: number;
    err?: unknown;
    blockTime?: number | null;
    url?: string;
  }>;
  feed?: Array<{
    id: string;
    at?: string | null;
    kind?: string;
    agent_id?: string | null;
    agent_name?: string | null;
    agent_handle?: string | null;
    agent_color?: string | null;
    mint?: string | null;
    symbol?: string | null;
    usd?: number | null;
    pnl_usd?: number | null;
    thesis?: string | null;
    text?: string | null;
    reason?: string | null;
    signature?: string | null;
    source?: string;
    solscan_tx?: string | null;
    solscan_token?: string | null;
    solscan_account?: string | null;
  }>;
  world?: {
    wallet?: string;
    worldUrl?: string;
    fundUrl?: string;
    made_usd?: number | null;
    holding?: string | null;
    buildings?: Array<{
      id: string;
      kind?: string;
      label?: string | null;
      mint?: string | null;
      symbol?: string | null;
      name?: string | null;
      image?: string | null;
      holding?: boolean;
      usd?: number | null;
      pnl_usd?: number | null;
      last_kind?: string | null;
      last_at?: string | null;
      builder?: string | null;
      buys?: number;
      stories?: number;
      color?: string;
      construction?: boolean;
      built?: boolean;
      gx?: number;
      gz?: number;
      solscan?: string | null;
      url?: string | null;
      meta?: string | null;
      x?: number;
      y?: number;
      z?: number;
      height?: number;
    }>;
    characters?: Array<{
      id: string;
      name?: string;
      first?: string;
      handle?: string;
      color?: string;
      holding?: string;
      mint?: string | null;
      action?: string;
      text?: string | null;
      made_usd?: number | null;
      wins?: number;
      losses?: number;
      target?: string;
      path?: Array<{ x: number; z: number }>;
      loop?: boolean;
      x?: number;
      y?: number;
      z?: number;
    }>;
    posts?: LiveDeskPayload["feed"];
    climate?: {
      phase?: string;
      hour?: number;
      rain?: boolean;
      fog?: boolean;
      wind?: number;
      snow?: boolean;
      storm?: boolean;
      weather?: string;
      day?: number;
    };
    generation?: number;
    age_days?: number;
    span?: number;
    unlocked?: number;
    built?: number;
    trees?: Array<{ id: string; x: number; z: number; h: number; form?: string }>;
    lamps?: Array<{ id: string; x: number; z: number }>;
    roads?: Array<{ id: string; x: number; z: number; w: number; d: number }>;
    walks?: Array<{ id: string; x: number; z: number; w: number; d: number }>;
    parks?: Array<{ id: string; x: number; z: number; w?: number; d?: number }>;
    water?: Array<{ id: string; kind?: string; x: number; z: number; w: number; d: number; rot?: number }>;
    hills?: Array<{ id: string; x: number; z: number; r: number; h: number }>;
    props?: Array<{ id: string; kind: string; x: number; z: number; rot?: number; w?: number; d?: number }>;
  };
  error?: string;
};

export function fetchAgents() {
  return getJson<PaperDeskPayload>("agents");
}

export async function fetchLiveDesk() {
  try {
    const r = await fetch("/api/live-agents", { cache: "no-store" });
    const j = (await r.json()) as LiveDeskPayload;
    if (j && (j.ok || j.wallet)) return j;
  } catch {
    /* vite has no /api */
  }
  return getJson<LiveDeskPayload>("live-desk");
}

export function fetchOrbitx() {
  return getJson<OrbitxPayload>("orbitx");
}

export function fetchEvents(query = "") {
  const q = query.startsWith("?") || !query ? query : `?${query}`;
  return getJson<{ ok: boolean; events?: ChainEvent[]; next_cursor?: string | null }>(`events${q}`);
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

export function fetchDistricts() {
  return getJson<CityDistricts & { ok: boolean }>("districts");
}

export function fetchTrending() {
  return getJson<TrendingPayload>("trending");
}
