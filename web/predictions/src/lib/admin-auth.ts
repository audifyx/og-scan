import crypto from 'crypto';
import { cookies } from 'next/headers';

// Server-only admin secret. Set ADMIN_AUTH on Vercel project rork-og-meme-coin-tracker
// (ADMIN_PANEL_SECRET is a legacy alias).
// No default PIN — fail closed if unset.
export const ADMIN_SECRET = process.env.ADMIN_AUTH || process.env.ADMIN_PANEL_SECRET || '';
export const ADMIN_COOKIE = 'admin_auth';

export function adminToken(secret: string = ADMIN_SECRET) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function isAdminRequest(): boolean {
  const c = cookies().get(ADMIN_COOKIE)?.value;
  return !!c && c === adminToken();
}
