import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { verifyDeposit } from '@/lib/solana-verify';
import { getSolUsd, computeFee } from '@/lib/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || process.env.TREASURY_WALLET || '';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { betId, outcomeIndex, walletAddress, txSignature } = body || {};
  if (!betId || outcomeIndex === undefined || outcomeIndex === null || !walletAddress || !txSignature) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }
  if (!TREASURY) {
    return NextResponse.json({ ok: false, error: 'Treasury wallet is not configured. Set NEXT_PUBLIC_TREASURY_WALLET.' }, { status: 500 });
  }

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in to place a bet.' }, { status: 401 });

  const { data: bet, error: be } = await (supabase as any).from('bets').select('*').eq('id', betId).single();
  if (be || !bet) return NextResponse.json({ ok: false, error: 'Bet not found.' }, { status: 404 });
  if (bet.status !== 'open') return NextResponse.json({ ok: false, error: 'This bet is closed.' }, { status: 400 });

  const expiry = bet.expiry || bet.expires_at;
  if (expiry && new Date(expiry).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'This bet has expired.' }, { status: 400 });
  }
  const idx = Number(outcomeIndex);
  const outcomeCount = Array.isArray(bet.outcomes) ? bet.outcomes.length : 2;
  if (idx < 0 || idx >= outcomeCount) {
    return NextResponse.json({ ok: false, error: 'Invalid outcome.' }, { status: 400 });
  }

  // One on-chain transfer can only back one wager
  const { data: dup } = await (supabase as any).from('user_bets').select('id').eq('tx_signature', txSignature).maybeSingle();
  if (dup) return NextResponse.json({ ok: false, error: 'This transaction has already been used for a bet.' }, { status: 409 });

  // No minimum stake — any verified deposit of at least 1 lamport counts
  const check = await verifyDeposit(txSignature, walletAddress, TREASURY, 1);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error || 'Deposit could not be verified.' }, { status: 400 });

  // Tiered placement fee (USD) taken from the verified deposit; treasury keeps it.
  const solUsd = await getSolUsd();
  const { feeLamports, netLamports } = computeFee(check.lamports, solUsd);

  const { data: inserted, error: ie } = await (supabase as any).from('user_bets').insert({
    bet_id: betId,
    user_id: user.id,
    user_wallet: walletAddress,
    outcome_index: idx,
    side: idx === 0 ? 'yes' : 'no',
    amount: netLamports,
    fee_paid: feeLamports,
    tx_signature: txSignature,
    status: 'confirmed',
  }).select('id, amount').single();

  if (ie) {
    const msg = /full/i.test(ie.message) ? 'This bet is full.' : ie.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: inserted.id, amount: inserted.amount });
}
