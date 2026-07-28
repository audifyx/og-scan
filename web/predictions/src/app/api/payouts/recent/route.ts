import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { looksLikeSignature } from '@/lib/solana-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cache: { at: number; data: any } = { at: 0, data: null };

export async function GET() {
  if (cache.data && Date.now() - cache.at < 30_000) {
    return NextResponse.json({ ...cache.data, cached: true });
  }
  const { data, error } = await supabaseAdmin
    .from('user_bets')
    .select('id, user_wallet, payout, claim_tx, payout_verified, claimed_at, bet:bets(title)')
    .eq('claimed', true)
    .order('claimed_at', { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const payouts = (data || [])
    .filter((r: any) => looksLikeSignature(r.claim_tx))
    .slice(0, 20)
    .map((r: any) => ({
      id: r.id,
      wallet: r.user_wallet,
      payoutSol: Number(r.payout || 0) / 1e9,
      tx: r.claim_tx,
      verified: !!r.payout_verified,
      at: r.claimed_at,
      market: r.bet?.title || 'Market',
    }));

  const data2 = { ok: true, at: new Date().toISOString(), payouts };
  cache = { at: Date.now(), data: data2 };
  return NextResponse.json(data2);
}
