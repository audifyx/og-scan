import { NextResponse } from 'next/server';
import { getSessionUser, getProfile } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyDeposit } from '@/lib/solana-verify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  const body = (await req.json().catch(() => ({}))) || {};
  const campaignId = String(body.campaignId || '');
  const wallet = String(body.walletAddress || '').trim();
  const tx = String(body.txSignature || '').trim();
  if (!campaignId || !wallet || !tx) return NextResponse.json({ ok: false, error: 'Missing required fields.' }, { status: 400 });

  const { data: c } = await supabaseAdmin.from('fundraises').select('*').eq('id', campaignId).maybeSingle();
  if (!c) return NextResponse.json({ ok: false, error: 'Campaign not found.' }, { status: 404 });
  if (c.deadline && new Date(c.deadline).getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'This fundraiser has ended.' }, { status: 400 });

  const { data: dupBet } = await supabaseAdmin.from('fundraise_contributions').select('id').eq('tx_signature', tx).maybeSingle();
  if (dupBet) return NextResponse.json({ ok: false, error: 'This transaction was already used.' }, { status: 409 });

  // Funds go to the creator's custom recipient wallet — verify on-chain.
  const check = await verifyDeposit(tx, wallet, c.recipient_wallet, 1);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error || 'Contribution could not be verified.' }, { status: 400 });

  const prof = user ? await getProfile(user.id) : { username: null };
  const { error: ie } = await supabaseAdmin.from('fundraise_contributions').insert({
    campaign_id: campaignId, contributor_user_id: user?.id || null, contributor_username: prof.username,
    contributor_wallet: wallet, lamports: check.lamports, tx_signature: tx,
  });
  if (ie) return NextResponse.json({ ok: false, error: ie.message }, { status: 400 });

  await supabaseAdmin.from('fundraises').update({
    raised_lamports: Number(c.raised_lamports) + check.lamports,
    contribution_count: Number(c.contribution_count) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId);

  return NextResponse.json({ ok: true, amount: check.lamports });
}
