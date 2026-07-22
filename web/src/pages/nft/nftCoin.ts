// OrbitX NFT Marketplace — "trade the NFT like a meme coin" client.
//
// This is the APP + DB layer for a pump.fun-style market attached to an NFT:
// a bonding curve, per-trade fees split platform/creator, and creator fee
// accrual that is CLAIMABLE in-app (mirrors lib/orbitx/claim.ts for tokens).
//
// NOTE: the on-chain bonding-curve program is a separate, security-critical
// deploy (see docs/NFT_COIN_TRADING.md). Until it ships, these reads return
// tracked market state and the claim call is a no-op-safe stub that throws a
// clear "not live yet" error rather than moving funds.
import { supabase } from "@/lib/supabase";

// Pump.fun parity: 1% total swap fee. We route it the same way the launchpad
// token lane does — creator share is claimable, platform share funds OrbitX.
export const NFT_COIN_TOTAL_FEE_BPS = 100;   // 1.00% per trade (pump.fun parity)
export const NFT_COIN_CREATOR_FEE_BPS = 50;  // 0.50% -> creator (claimable in-app)
export const NFT_COIN_PLATFORM_FEE_BPS = 50; // 0.50% -> OrbitX platform

export interface NftCoinMarket {
  nft_id: string;
  mint_address: string;
  creator_wallet: string;
  enabled: boolean;
  curve_supply: number;
  sol_reserves: number;
  last_price_sol: number | null;
  market_cap_sol: number | null;
  creator_fee_bps: number;
  platform_fee_bps: number;
  graduated: boolean;
  created_at: string;
}

export async function getCoinMarket(nftId: string): Promise<NftCoinMarket | null> {
  try {
    const { data } = await supabase.from("orbitx_nft_coin_markets").select("*").eq("nft_id", nftId).maybeSingle();
    return (data as NftCoinMarket) ?? null;
  } catch { return null; }
}

export interface CreatorFeeSummary { claimable_sol: number; lifetime_sol: number; last_claim_at: string | null }

export async function getCreatorFees(wallet: string): Promise<CreatorFeeSummary> {
  try {
    const { data } = await supabase.rpc("orbitx_nft_creator_fee_summary", { p_wallet: wallet });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) return {
      claimable_sol: Number(row.claimable_sol ?? 0),
      lifetime_sol: Number(row.lifetime_sol ?? 0),
      last_claim_at: row.last_claim_at ?? null,
    };
  } catch { /* migration/program pending */ }
  return { claimable_sol: 0, lifetime_sol: 0, last_claim_at: null };
}

// Placeholder until the on-chain program is deployed. Kept explicit so the UI
// can show a real "coming online" state instead of silently pretending to pay.
export async function claimCreatorFees(_wallet: string): Promise<{ amount_sol: number; signature?: string }> {
  throw new Error("Creator-fee claims go live when the OrbitX NFT-coin program is deployed. Accrual is already tracked.");
}

// ── Tradeable market (DB-tracked bonding curve) ─────────────────────────────
export async function enableNftCoin(nftId: string, wallet: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("orbitx_nft_enable_coin", { p_nft_id: nftId, p_wallet: wallet });
  if (error) throw error;
  return !!data;
}

export async function listCoinMarkets(): Promise<(NftCoinMarket & { nft: any })[]> {
  try {
    const { data } = await supabase.from("orbitx_nft_coin_markets").select("*, nft:orbitx_nfts(*)").eq("enabled", true).order("market_cap_sol", { ascending: false }).limit(60);
    return (data ?? []) as any;
  } catch { return []; }
}

export async function getMarketWithNft(nftId: string): Promise<(NftCoinMarket & { nft: any }) | null> {
  try {
    const { data } = await supabase.from("orbitx_nft_coin_markets").select("*, nft:orbitx_nfts(*)").eq("nft_id", nftId).maybeSingle();
    return (data as any) ?? null;
  } catch { return null; }
}

export async function getHoldings(nftId: string, wallet: string): Promise<number> {
  try {
    const { data } = await supabase.from("orbitx_nft_coin_holdings").select("tokens").eq("nft_id", nftId).eq("wallet", wallet).maybeSingle();
    return Number(data?.tokens ?? 0);
  } catch { return 0; }
}

export interface CoinTrade { id: string; trader_wallet: string; side: string; sol_amount: number; token_amount: number; price_sol: number; created_at: string }
export async function listCoinTrades(nftId: string, limit = 30): Promise<CoinTrade[]> {
  try {
    const { data } = await supabase.from("orbitx_nft_coin_trades").select("*").eq("nft_id", nftId).order("created_at", { ascending: false }).limit(limit);
    return (data ?? []) as CoinTrade[];
  } catch { return []; }
}

export async function tradeCoin(nftId: string, wallet: string, side: "buy" | "sell", amount: number): Promise<any> {
  const { data, error } = await supabase.rpc("orbitx_nft_coin_trade", { p_nft_id: nftId, p_wallet: wallet, p_side: side, p_amount: amount });
  if (error) throw error;
  return data;
}
