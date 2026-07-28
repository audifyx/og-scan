import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { betId } = (await req.json().catch(() => ({}))) || {};
  if (!betId) return NextResponse.json({ ok: false, error: 'Missing betId' }, { status: 400 });
  await supabaseAdmin.from('user_bets').delete().eq('bet_id', betId);
  const { error } = await supabaseAdmin.from('bets').delete().eq('id', betId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
