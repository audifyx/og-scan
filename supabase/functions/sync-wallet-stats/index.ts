/**
 * sync-wallet-stats — Edge Function
 * Batch-syncs on-chain wallet stats for all users who have a wallet_address.
 * Updates profiles with real trade data for the leaderboard.
 * Can be called on a schedule or triggered manually.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_BASE = `https://api.helius.xyz/v0`;
const SOL_MINT = "So11111111111111111111111111111111111111112";

const cors = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function heliusTxs(wallet: string, limit = 100) {
  const res = await fetch(`${HELIUS_BASE}/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

async function getBalance(wallet: string) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [wallet] }),
  });
  const json = await res.json();
  return (json.result?.value || 0) / 1e9;
}

async function getSolPrice(): Promise<number> {
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${SOL_MINT}`);
    const json = await res.json();
    return parseFloat(json.data?.[SOL_MINT]?.price || "0");
  } catch { return 0; }
}

async function syncWallet(wallet: string, solPrice: number) {
  const txs = await heliusTxs(wallet, 100);
  const balSol = await getBalance(wallet);

  let totalIn = 0, totalOut = 0, swapCount = 0;
  for (const tx of txs) {
    const type = tx.type || "";
    if (type === "SWAP" || type.includes("SWAP")) swapCount++;
    for (const nt of (tx.nativeTransfers || [])) {
      if (nt.toUserAccount === wallet) totalIn += nt.amount / 1e9;
      if (nt.fromUserAccount === wallet) totalOut += nt.amount / 1e9;
    }
  }

  const netSol = totalIn - totalOut;
  const netUsd = netSol * solPrice;
  const volumeUsd = totalOut * solPrice;
  const tradesCount = swapCount || txs.length;
  const winRate = txs.length > 0 ? Math.min(100, Math.max(0, 50 + (netUsd / Math.max(volumeUsd, 1)) * 100)) : 0;

  return {
    total_pnl: Math.round(netUsd * 100) / 100,
    trades_count: tradesCount,
    volume_usd: Math.round(volumeUsd * 100) / 100,
    win_rate: Math.round(winRate * 10) / 10,
    pnl_pct: volumeUsd > 0 ? Math.round((netUsd / volumeUsd) * 10000) / 100 : 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all profiles with wallet_address set
    const { data: profiles, error } = await sb
      .from("profiles")
      .select("user_id, wallet_address")
      .not("wallet_address", "is", null)
      .neq("wallet_address", "");

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "No wallets to sync" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const solPrice = await getSolPrice();
    let synced = 0;
    const errors: string[] = [];

    // Process wallets (with rate limiting — 2 at a time)
    for (let i = 0; i < profiles.length; i += 2) {
      const batch = profiles.slice(i, i + 2);
      const results = await Promise.allSettled(
        batch.map(async (p) => {
          const stats = await syncWallet(p.wallet_address, solPrice);
          await sb.from("profiles").update(stats).eq("user_id", p.user_id);
          return p.user_id;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") synced++;
        else errors.push(String(r.reason));
      }
      // Rate limit: 200ms between batches
      if (i + 2 < profiles.length) await new Promise(r => setTimeout(r, 200));
    }

    return new Response(JSON.stringify({ ok: true, synced, total: profiles.length, errors: errors.slice(0, 5) }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-wallet-stats error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
