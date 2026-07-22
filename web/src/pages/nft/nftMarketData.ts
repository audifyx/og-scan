// OrbitX NFT Marketplace — data layer. Reuses the existing registry client so
// the marketplace reads the exact same live on-chain-backed tables as the hub.
import { useQuery } from "@tanstack/react-query";
import {
  listNftCollections, listActiveListings, listRecentSales, listNfts,
  type OrbitxNftCollection, type OrbitxNft, type NftSale,
} from "@/lib/orbitx/nftRegistry";

export type { OrbitxNftCollection, OrbitxNft, NftSale };

export function useMarketCollections() {
  return useQuery({ queryKey: ["nftmkt-collections"], staleTime: 30_000, queryFn: () => listNftCollections(120) });
}
export function useActiveListings() {
  return useQuery({ queryKey: ["nftmkt-listings"], staleTime: 20_000, refetchInterval: 45_000, queryFn: () => listActiveListings() });
}
export function useRecentSales(limit = 24) {
  return useQuery({ queryKey: ["nftmkt-sales", limit], staleTime: 15_000, refetchInterval: 30_000, queryFn: () => listRecentSales(limit) });
}
export function useAllNfts(limit = 200) {
  return useQuery({ queryKey: ["nftmkt-nfts", limit], staleTime: 30_000, queryFn: () => listNfts(limit) });
}

export const solDp = (v: number): number => (v >= 1 ? 2 : v >= 0.01 ? 3 : v >= 0.0001 ? 5 : 6);
export const fmtSol = (n?: number | null, dp?: number): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Number(n);
  return `${v.toFixed(dp ?? solDp(v))} SOL`;
};

export const fmtInt = (n?: number | null): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

export const shortAddr = (a?: string | null, n = 4): string =>
  !a ? "—" : a.length <= n * 2 + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
