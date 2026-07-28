import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabaseAdmin.from('fundraises').select('*').order('created_at', { ascending: false }).limit(300);
  return NextResponse.json({ ok: true, campaigns: data || [] });
}

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { id, action } = (await req.json().catch(() => ({}))) || {};
  if (id && action === 'contributions') {
    const { data } = await supabaseAdmin.from('fundraise_contributions').select('*').eq('campaign_id', id).order('created_at', { ascending: false }).limit(500);
    return NextResponse.json({ ok: true, contributions: data || [] });
  }
  // Funds are non-custodial (sent straight to the creator) and final. Admin can
  // only remove a campaign listing for abuse/spam — this never touches funds.
  if (id && action === 'delete') {
    const { error } = await supabaseAdmin.from('fundraises').delete().eq('id', id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 });
}
