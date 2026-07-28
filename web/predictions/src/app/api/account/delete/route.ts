import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  // Best-effort cleanup of profile; auth deletion cascades FK rows.
  try { await supabaseAdmin.from('profiles').delete().eq('user_id', user.id); } catch {}
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
