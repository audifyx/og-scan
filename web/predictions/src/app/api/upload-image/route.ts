import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerSupabase } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Allow admins (cookie) or any signed-in user to upload a bet image.
  let authorized = isAdminRequest();
  if (!authorized) {
    const sb = createServerSupabase();
    const { data: { user } } = await sb.auth.getUser();
    authorized = !!user;
  }
  if (!authorized) return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ ok: false, error: 'File must be an image' }, { status: 400 });
  if (file.size > 6_000_000) return NextResponse.json({ ok: false, error: 'Image must be under 6MB' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const name = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from('bet-images').upload(name, buf, {
    contentType: file.type, upsert: false,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const { data } = supabaseAdmin.storage.from('bet-images').getPublicUrl(name);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
