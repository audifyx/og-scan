import { NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getSolUsd } from '@/lib/fees';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RPC = process.env.SOLANA_RPC_ENDPOINT || process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || process.env.TREASURY_WALLET || '';
const LAMPORTS = 1_000_000_000;

const OPEN = ['open', 'active', 'locked', 'matched'];

let cache: { at: number; data: any } = { at: 0, data: null };

export async function GET() {
  if (cache.data && Date.now() - cache.at < 30_000) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  const price = await getSolUsd();

  // ── On-chain treasury balance ──────────────────────────────
  let balanceSol = 0;
  let onchainError: string | null = null;
  if (TREASURY) {
    try {
      const conn = new Connection(RPC, 'confirmed');
      const lamports = await conn.getBalance(new PublicKey(TREASURY));
      balanceSol = lamports / LAMPORTS;
    } catch (e: any) {
      onchainError = e?.message || 'RPC error';
    }
  } else {
    onchainError = 'Treasury wallet not configured';
  }

  // ── Liabilities: SOL held that belongs to active bettors ───
  const { data: openBets } = await supabaseAdmin
    .from('bets').select('total_pool, status').in('status', OPEN);
  const liabilitiesLamports = (openBets || []).reduce((s: number, b: any) => s + Number(b.total_pool || 0), 0);
  const liabilitiesSol = liabilitiesLamports / LAMPORTS;

  // ── Lifetime payouts to users ──────────────────────────────
  const { data: paid } = await supabaseAdmin
    .from('user_bets').select('payout').in('status', ['won', 'refunded', 'claimed']);
  const paidLamports = (paid || []).reduce((s: number, w: any) => s + Number(w.payout || 0), 0);

  // ── Lifetime platform fees retained ────────────────────────
  const { data: resolved } = await supabaseAdmin
    .from('bets').select('platform_fees_collected').eq('status', 'resolved');
  const feesLamports = (resolved || []).reduce((s: number, b: any) => s + Number(b.platform_fees_collected || 0), 0);

  // ── Counts ─────────────────────────────────────────────────
  const counts = async (q: any) => (await q).count || 0;
  const [totalMarkets, openMarkets, resolvedMarkets, totalWagers] = await Promise.all([
    counts(supabaseAdmin.from('bets').select('*', { count: 'exact', head: true })),
    counts(supabaseAdmin.from('bets').select('*', { count: 'exact', head: true }).in('status', OPEN)),
    counts(supabaseAdmin.from('bets').select('*', { count: 'exact', head: true }).eq('status', 'resolved')),
    counts(supabaseAdmin.from('user_bets').select('*', { count: 'exact', head: true }).in('status', ['confirmed', 'won', 'lost', 'refunded', 'claimed'])),
  ]);

  const reserveRatio = liabilitiesSol > 0 ? balanceSol / liabilitiesSol : null;

  const data = {
    ok: true,
    at: new Date().toISOString(),
    treasury: TREASURY || null,
    onchainError,
    solUsd: price,
    balance: { sol: balanceSol, usd: balanceSol * price },
    liabilities: { sol: liabilitiesSol, usd: liabilitiesSol * price },
    surplus: { sol: balanceSol - liabilitiesSol, usd: (balanceSol - liabilitiesSol) * price },
    reserveRatio,
    solvent: reserveRatio == null ? balanceSol >= 0 : reserveRatio >= 1,
    lifetime: {
      paidOut: { sol: paidLamports / LAMPORTS, usd: (paidLamports / LAMPORTS) * price },
      feesCollected: { sol: feesLamports / LAMPORTS, usd: (feesLamports / LAMPORTS) * price },
    },
    counts: { totalMarkets, openMarkets, resolvedMarkets, totalWagers },
  };

  cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
