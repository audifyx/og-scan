import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { ADMIN_SECRET, ADMIN_COOKIE, adminToken } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;            // per window before lockout
const WINDOW_MS = 15 * 60 * 1000;  // rolling window
const LOCK_MS = 15 * 60 * 1000;    // lockout duration

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') || '';
  return (xff.split(',')[0] || '').trim() || req.headers.get('x-real-ip') || 'unknown';
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare a fixed-size digest so length differences don't leak or throw.
  const ah = crypto.createHash('sha256').update(ab).digest();
  const bh = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ah, bh);
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const now = Date.now();

  // ── rate limit (best-effort, DB-backed across instances) ──
  const { data: row } = await supabaseAdmin
    .from('admin_login_attempts').select('*').eq('ip', ip).maybeSingle();

  if (row?.locked_until && new Date(row.locked_until).getTime() > now) {
    const mins = Math.ceil((new Date(row.locked_until).getTime() - now) / 60000);
    return NextResponse.json({ ok: false, error: `Too many attempts. Try again in ${mins} min.` }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const pin = typeof body?.pin === 'string' ? body.pin : '';
  const ok = !!pin && constantTimeEqual(pin, ADMIN_SECRET);

  if (!ok) {
    // increment within the rolling window, lock if over the threshold
    const windowOpen = row && (now - new Date(row.window_start).getTime() < WINDOW_MS);
    const attempts = (windowOpen ? row!.attempts : 0) + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await supabaseAdmin.from('admin_login_attempts').upsert({
      ip,
      attempts,
      window_start: windowOpen ? row!.window_start : new Date(now).toISOString(),
      locked_until: locked ? new Date(now + LOCK_MS).toISOString() : null,
      updated_at: new Date(now).toISOString(),
    });
    return NextResponse.json({ ok: false, error: 'Invalid credentials.' }, { status: 401 });
  }

  // success → clear the counter
  if (row) await supabaseAdmin.from('admin_login_attempts').delete().eq('ip', ip);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}
