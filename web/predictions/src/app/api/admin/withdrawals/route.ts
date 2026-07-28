import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('game_withdrawals').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, withdrawals: data || [] });
}

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { id, action, payoutTx } = (await req.json().catch(() => ({}))) || {};
  if (!id || !['paid', 'rejected'].includes(action)) return NextResponse.json({ ok: false, error: 'Missing id or action' }, { status: 400 });
  const { data: wd } = await supabaseAdmin.from('game_withdrawals').select('*').eq('id', id).maybeSingle();
  if (!wd) return NextResponse.json({ ok: false, error: 'Withdrawal not found' }, { status: 404 });
  if (wd.status !== 'pending') return NextResponse.json({ ok: false, error: 'Already processed' }, { status: 409 });

  if (action === 'rejected') {
    await supabaseAdmin.rpc('game_credit', { p_user: wd.user_id, p_amount: wd.lamports, p_kind: 'refund', p_ref: 'withdraw_rejected:' + id });
  }
  const { error } = await supabaseAdmin.from('game_withdrawals').update({
    status: action, payout_tx: action === 'paid' ? (payoutTx || ('manual_' + Date.now())) : null, processed_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'pending');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('user_id', wd.user_id).maybeSingle();
    if (prof) {
      const s = (Number(wd.lamports) / 1e9).toFixed(4);
      const notif = action === 'paid'
        ? { type: 'payout', title: 'Withdrawal paid \u2705', body: `\u25ce ${s} SOL has been sent to your wallet.`, data: { payoutTx: payoutTx || null, lamports: wd.lamports, status: 'paid' } }
        : { type: 'payout', title: 'Withdrawal declined', body: `Your withdrawal of \u25ce ${s} SOL was declined and refunded to your balance.`, data: { lamports: wd.lamports, status: 'rejected' } };
      await supabaseAdmin.from('notifications').insert({ user_id: prof.id, ...notif });
    }
  } catch {}
  return NextResponse.json({ ok: true });
}
