// OrbitX Launchpad admin analytics — derived from the token registry + live
// on-chain wallet balances/inflows. No mock data.
import { HELIUS_RPC, HELIUS_API_KEY } from "@/lib/og";
import { PLATFORM_WALLET } from "@/lib/platformFee";
import { ROUTED_FEE_WALLET } from "./feeRouting";
import type { OrbitxToken } from "./registry";

export interface LaunchStats {
  total: number;
  today: number;
  last7: number;
  last30: number;
  pump: number;
  custom: number;
  graduated: number;
  graduationRate: number;
  uniqueCreators: number;
  newCreators7: number;
  perDay: { date: string; count: number; pump: number; custom: number }[];
  activeCreatorsPerDay: { date: string; creators: number }[];
  topCreators: { wallet: string; count: number; graduated: number }[];
}

const DAY = 86_400_000;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function computeLaunchStats(tokens: OrbitxToken[]): LaunchStats {
  const now = Date.now();
  const startToday = new Date(new Date().toISOString().slice(0, 10)).getTime();
  let today = 0, last7 = 0, last30 = 0, pump = 0, custom = 0, graduated = 0;
  const creators = new Map<string, { count: number; graduated: number; first: number }>();
  const perDayMap = new Map<string, { count: number; pump: number; custom: number }>();
  const activeMap = new Map<string, Set<string>>();

  for (const t of tokens) {
    const ts = new Date(t.created_at).getTime();
    if (ts >= startToday) today++;
    if (now - ts <= 7 * DAY) last7++;
    if (now - ts <= 30 * DAY) last30++;
    if (t.launch_type === "pump") pump++; else custom++;
    const isGrad = !!t.lp_pool_address || !!t.graduated_at;
    if (isGrad) graduated++;

    const c = creators.get(t.creator_wallet) ?? { count: 0, graduated: 0, first: ts };
    c.count++;
    if (isGrad) c.graduated++;
    c.first = Math.min(c.first, ts);
    creators.set(t.creator_wallet, c);

    if (now - ts <= 30 * DAY) {
      const k = dayKey(t.created_at);
      const d = perDayMap.get(k) ?? { count: 0, pump: 0, custom: 0 };
      d.count++;
      if (t.launch_type === "pump") d.pump++; else d.custom++;
      perDayMap.set(k, d);
      const set = activeMap.get(k) ?? new Set<string>();
      set.add(t.creator_wallet);
      activeMap.set(k, set);
    }
  }

  // dense 30-day series
  const perDay: LaunchStats["perDay"] = [];
  const activeCreatorsPerDay: LaunchStats["activeCreatorsPerDay"] = [];
  for (let i = 29; i >= 0; i--) {
    const k = new Date(now - i * DAY).toISOString().slice(0, 10);
    const d = perDayMap.get(k) ?? { count: 0, pump: 0, custom: 0 };
    perDay.push({ date: k.slice(5), ...d });
    activeCreatorsPerDay.push({ date: k.slice(5), creators: (activeMap.get(k)?.size ?? 0) });
  }

  const newCreators7 = [...creators.values()].filter((c) => now - c.first <= 7 * DAY).length;
  const topCreators = [...creators.entries()]
    .map(([wallet, v]) => ({ wallet, count: v.count, graduated: v.graduated }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total: tokens.length,
    today, last7, last30, pump, custom, graduated,
    graduationRate: tokens.length ? graduated / tokens.length : 0,
    uniqueCreators: creators.size,
    newCreators7,
    perDay,
    activeCreatorsPerDay,
    topCreators,
  };
}

/* ── live on-chain fee wallets ── */

export async function fetchSolBalance(wallet: string): Promise<number> {
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "bal", method: "getBalance", params: [wallet] }),
    });
    const j = await res.json();
    return (j?.result?.value ?? 0) / 1e9;
  } catch { return 0; }
}

/** Sum of SOL received by `wallet` over the last `sinceDays` via Helius enhanced tx API. */
export async function fetchInflowSol(wallet: string, sinceDays = 30): Promise<number> {
  if (!HELIUS_API_KEY) return 0;
  const cutoff = Date.now() / 1000 - sinceDays * 86400;
  let before = "";
  let total = 0;
  for (let page = 0; page < 6; page++) {
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=100${before ? `&before=${before}` : ""}`;
    let txs: any[];
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      txs = await res.json();
    } catch { break; }
    if (!Array.isArray(txs) || txs.length === 0) break;
    for (const t of txs) {
      if (t.timestamp && t.timestamp < cutoff) return total;
      for (const nt of (t.nativeTransfers || [])) {
        if (nt.toUserAccount === wallet) total += (nt.amount || 0) / 1e9;
      }
    }
    before = txs[txs.length - 1]?.signature;
    if (txs.length < 100 || !before) break;
  }
  return total;
}

export interface FeeWallet {
  label: string;
  wallet: string;
  balanceSol: number;
  inflow30Sol: number;
}

export async function fetchFeeWallets(): Promise<FeeWallet[]> {
  const defs = [
    { label: "Routed revenue (2.5% claims)", wallet: ROUTED_FEE_WALLET },
    { label: "Platform (launch + swap fees)", wallet: PLATFORM_WALLET },
  ];
  return Promise.all(
    defs.map(async (d) => ({
      ...d,
      balanceSol: await fetchSolBalance(d.wallet),
      inflow30Sol: await fetchInflowSol(d.wallet, 30),
    })),
  );
}
