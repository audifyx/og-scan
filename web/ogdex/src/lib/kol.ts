// KOL Scanner client + types.
export interface Kol {
  kolId: string | null; name: string; twitter: string | null; twitterUrl: string | null;
  avatar: string | null; address: string; tags: string[]; status: string; notes: string | null;
  pnl: number | null; winRate: number | null; followers: number | null; isActive: boolean;
}
export interface KolActivity {
  side: string; mint: string; tokenAmount: number; solAmount: number; time: number; txHash: string | null;
  symbol?: string | null; name?: string | null; image?: string | null; priceUsd?: number | null; mcap?: number | null; usdValue?: number | null;
}
export interface KolFeedItem {
  id: string; side: string; kolId: string; kolAddress: string | null; name: string; twitter: string | null; tags: string[];
  avatar: string | null; kolStatus: string; mint: string | null; symbol: string | null;
  tokenAmount: number | null; solAmount: number | null; priceUsd: number | null; usdValue: number | null; time: number | null; txHash: string | null;
}
export interface KolDirEntry { kolId: string | null; name: string; twitter: string | null; twitterUrl?: string | null; tags: string[]; status: string; avatar?: string | null; notes?: string | null; address: string; }

const j = <T,>(u: string): Promise<T> => fetch(u).then((r) => r.json());
const post = (u: string, b: any) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

export const getKols = () => j<{ ok: boolean; kols: Kol[] }>(`/api/ogdex/kols`);
export const getKolProfile = (address: string) => j<{ ok: boolean; kol: Kol; wallets: { address: string; label: string; primary: boolean }[] }>(`/api/ogdex/kols?address=${address}`);
export const getKolActivity = (address: string, limit = 15) => j<{ ok: boolean; activity: KolActivity[] }>(`/api/ogdex/kols?activity=${address}&limit=${limit}`);
export const addKol = (body: any) => post(`/api/ogdex/kols`, body);

export function getKolFeed(opts: { side?: string; kolId?: string; limit?: number } = {}) {
  const p = new URLSearchParams();
  if (opts.side) p.set("side", opts.side);
  if (opts.kolId) p.set("kolId", opts.kolId);
  p.set("limit", String(opts.limit || 60));
  p.set("feed", "1");
  return j<{ ok: boolean; feed: KolFeedItem[] }>(`/api/ogdex/kols?${p.toString()}`);
}

// directory map address -> KOL info, fetched once and reused for holder labeling.
let dirPromise: Promise<Record<string, KolDirEntry>> | null = null;
export function getKolDirectory(): Promise<Record<string, KolDirEntry>> {
  if (!dirPromise) dirPromise = j<{ directory: Record<string, KolDirEntry> }>(`/api/ogdex/kols?directory=1`).then((d) => d.directory || {}).catch(() => ({}));
  return dirPromise;
}
