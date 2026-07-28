import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabaseAdmin.from('site_settings').select('maintenance, message, updated_at').eq('id', 1).maybeSingle();
  return NextResponse.json({ ok: true, maintenance: !!data?.maintenance, message: data?.message || '', updatedAt: data?.updated_at || null });
}

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) || {};
  const update: any = { updated_at: new Date().toISOString() };
  if (typeof b.maintenance === 'boolean') update.maintenance = b.maintenance;
  if (typeof b.message === 'string') update.message = b.message.slice(0, 600);
  const { data, error } = await supabaseAdmin.from('site_settings').update(update).eq('id', 1).select('maintenance, message').single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, maintenance: data.maintenance, message: data.message });
}
