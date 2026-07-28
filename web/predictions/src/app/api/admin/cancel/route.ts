import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { betId } = (await req.json().catch(() => ({}))) || {};
  if (!betId) return NextResponse.json({ ok: false, error: 'Missing betId' }, { status: 400 });
  const { data: wagers } = await supabaseAdmin.from('user_bets').select('id, amount').eq('bet_id', betId).eq('status', 'confirmed');
  for (const w of wagers || []) {
    await supabaseAdmin.from('user_bets').update({ status: 'refunded', payout: Number(w.amount) }).eq('id', w.id);
  }
  await supabaseAdmin.from('bets').update({ status: 'cancelled' }).eq('id', betId);
  return NextResponse.json({ ok: true, refunded: (wagers || []).length });
}
