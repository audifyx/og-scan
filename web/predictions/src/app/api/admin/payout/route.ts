import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyPayout, looksLikeSignature } from '@/lib/solana-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || process.env.TREASURY_WALLET || '';

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { userBetId, claimTx, force } = (await req.json().catch(() => ({}))) || {};
  if (!userBetId) return NextResponse.json({ ok: false, error: 'Missing userBetId' }, { status: 400 });

  // Load the wager so we can verify the payout went to the right wallet for the right amount.
  const { data: ub, error: loadErr } = await supabaseAdmin
    .from('user_bets')
    .select('id, user_id, user_wallet, payout')
    .eq('id', userBetId)
    .single();
  if (loadErr || !ub) return NextResponse.json({ ok: false, error: 'Wager not found' }, { status: 404 });

  // Resolve the winner's payout wallet (prefer their profile wallet, fall back to recorded wallet).
  let payoutWallet = ub.user_wallet;
  if (ub.user_id) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('wallet').eq('user_id', ub.user_id).maybeSingle();
    if (prof?.wallet) payoutWallet = prof.wallet;
  }

  let payoutVerified = false;
  let verifiedLamports = 0;

  if (looksLikeSignature(claimTx)) {
    const check = await verifyPayout(claimTx, TREASURY, payoutWallet, Number(ub.payout || 0));
    if (check.ok) {
      payoutVerified = true;
      verifiedLamports = check.lamports;
    } else if (!force) {
      // Don't record an unverifiable signature unless explicitly forced.
      return NextResponse.json({ ok: false, error: check.error, verifiable: false }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin.from('user_bets').update({
    claimed: true,
    status: 'claimed',
    claim_tx: claimTx || ('manual_' + Date.now()),
    claimed_at: new Date().toISOString(),
    payout_verified: payoutVerified,
    payout_verified_at: payoutVerified ? new Date().toISOString() : null,
  }).eq('id', userBetId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, payoutVerified, verifiedSol: verifiedLamports / 1e9 });
}
