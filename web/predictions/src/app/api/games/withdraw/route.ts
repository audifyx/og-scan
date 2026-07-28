import { NextResponse } from 'next/server';
import { getSessionUser, getProfile } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { MIN_WITHDRAW } from '@/lib/games/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const { lamports, wallet } = (await req.json().catch(() => ({}))) || {};
  const amount = Math.floor(Number(lamports));
  if (!amount || amount < MIN_WITHDRAW) {
    return NextResponse.json({ ok: false, error: `Minimum withdrawal is ${(MIN_WITHDRAW / 1e9).toFixed(3)} SOL.` }, { status: 400 });
  }
  const dest = (wallet || (await getProfile(user.id)).wallet || '').trim();
  if (!dest) return NextResponse.json({ ok: false, error: 'No destination wallet. Enter a wallet address.' }, { status: 400 });

  const { data: bal, error: de } = await supabaseAdmin.rpc('game_debit', { p_user: user.id, p_amount: amount, p_kind: 'withdraw', p_ref: 'withdraw' });
  if (de) {
    const msg = /INSUFFICIENT_FUNDS/.test(de.message) ? 'Insufficient balance.' : de.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  const { data: wd, error: we } = await supabaseAdmin.from('game_withdrawals').insert({ user_id: user.id, wallet: dest, lamports: amount, status: 'pending' }).select('id').single();
  if (we) {
    await supabaseAdmin.rpc('game_credit', { p_user: user.id, p_amount: amount, p_kind: 'refund', p_ref: 'withdraw_failed' });
    return NextResponse.json({ ok: false, error: we.message }, { status: 400 });
  }
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (prof) await supabaseAdmin.from('notifications').insert({
      user_id: prof.id, type: 'payout', title: 'Withdrawal requested',
      body: `\u25ce ${(amount / 1e9).toFixed(4)} SOL queued for payout. Our team verifies manually \u2014 most are paid within 5 hours and always under 24 hours.`,
      data: { lamports: amount, status: 'pending', wallet: dest },
    });
  } catch {}
  return NextResponse.json({ ok: true, id: wd.id, balance: Number(bal), status: 'pending' });
}
