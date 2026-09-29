/**
 * Auction primitives (#18) — shared by the city game team and any surface.
 *
 * Model: every bid is an immediate ORBITX burn (spend with reason
 * `auction:bid:<auctionId>`). Losing bids are therefore burned by
 * construction — no separate settlement burn needed. The winner is the
 * highest bid at close; the game/platform delivers the item off-chain.
 *
 * Game team usage:
 *   const { auctions, placeBid, closeAuction } = useAuctions();
 *   await placeBid(billing.spend, auctionId, amount);
 */
import { useCallback, useEffect, useState } from "react";
import { AUCTIONS_KEY } from "./constants";
import type { SpendArgs } from "./useOrbitxBilling";
import { spendReason } from "./constants";

export type AuctionBid = {
  bidder: string;
  amount: number;
  signature: string;
  at: number;
};

export type Auction = {
  id: string;
  title: string;
  kind: "billboard" | "penthouse" | "general";
  endsAt: number;
  minBid: number;
  bids: AuctionBid[];
  closed: boolean;
  winner: string | null;
  /** Total ORBITX burned across all bids (set at close). */
  burnedTotal?: number;
};

function readAuctions(): Auction[] {
  try {
    const raw = localStorage.getItem(AUCTIONS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAuctions(list: Auction[]): void {
  try {
    localStorage.setItem(AUCTIONS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function createAuction(input: {
  id?: string;
  title: string;
  kind?: Auction["kind"];
  durationMs?: number;
  minBid?: number;
}): Auction {
  const now = Date.now();
  const auction: Auction = {
    id: input.id || `auc-${now}-${Math.floor(Math.random() * 1e6)}`,
    title: input.title,
    kind: input.kind || "general",
    endsAt: now + (input.durationMs ?? 24 * 60 * 60 * 1000),
    minBid: input.minBid ?? 100,
    bids: [],
    closed: false,
    winner: null,
  };
  writeAuctions([auction, ...readAuctions()]);
  return auction;
}

/** Pure: highest bid wins; losers' bids were already burned at bid time. */
export function settleAuctionPure(auction: Auction): Auction {
  if (auction.closed) return auction;
  const sorted = [...auction.bids].sort((a, b) => b.amount - a.amount);
  const burnedTotal = auction.bids.reduce((s, b) => s + b.amount, 0);
  return {
    ...auction,
    closed: true,
    winner: sorted[0]?.bidder ?? null,
    bids: sorted,
    burnedTotal,
  };
}

export function useAuctions(): {
  auctions: Auction[];
  create: (input: Parameters<typeof createAuction>[0]) => Auction;
  placeBid: (
    spend: (opts: SpendArgs) => Promise<{ signature: string }>,
    auctionId: string,
    amount: number,
    bidder: string,
  ) => Promise<{ signature: string }>;
  close: (auctionId: string) => Auction | null;
  refresh: () => void;
} {
  const [auctions, setAuctions] = useState<Auction[]>(() => readAuctions());

  const refresh = useCallback(() => setAuctions(readAuctions()), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUCTIONS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const create = useCallback(
    (input: Parameters<typeof createAuction>[0]) => {
      const a = createAuction(input);
      refresh();
      return a;
    },
    [refresh],
  );

  const placeBid = useCallback(
    async (
      spend: (opts: SpendArgs) => Promise<{ signature: string }>,
      auctionId: string,
      amount: number,
      bidder: string,
    ): Promise<{ signature: string }> => {
      const list = readAuctions();
      const auction = list.find((a) => a.id === auctionId);
      if (!auction) throw new Error("Auction not found.");
      if (auction.closed || Date.now() > auction.endsAt) throw new Error("Auction is closed.");
      const top = Math.max(auction.minBid, ...auction.bids.map((b) => b.amount));
      if (amount <= top) throw new Error(`Bid must beat ${top.toLocaleString()} ORBITX.`);
      // The bid IS the burn — losers never get it back (#18).
      const { signature } = await spend({
        amount: Math.floor(amount),
        reason: spendReason.auctionBid(auctionId),
      });
      const bid: AuctionBid = { bidder, amount: Math.floor(amount), signature, at: Date.now() };
      writeAuctions(
        list.map((a) => (a.id === auctionId ? { ...a, bids: [...a.bids, bid] } : a)),
      );
      refresh();
      return { signature };
    },
    [refresh],
  );

  const close = useCallback(
    (auctionId: string): Auction | null => {
      const list = readAuctions();
      const auction = list.find((a) => a.id === auctionId);
      if (!auction) return null;
      const settled = settleAuctionPure(auction);
      writeAuctions(list.map((a) => (a.id === auctionId ? settled : a)));
      refresh();
      return settled;
    },
    [refresh],
  );

  return { auctions, create, placeBid, close, refresh };
}
