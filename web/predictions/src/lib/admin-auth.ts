import crypto from 'crypto';
import { cookies } from 'next/headers';

// Server-only admin secret. Set ADMIN_PANEL_SECRET in the environment.
// Falls back to the legacy PIN so the panel keeps working until you set it.
export const ADMIN_SECRET = process.env.ADMIN_PANEL_SECRET || '0129';
export const ADMIN_COOKIE = 'admin_auth';

export function adminToken(secret: string = ADMIN_SECRET) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function isAdminRequest(): boolean {
  const c = cookies().get(ADMIN_COOKIE)?.value;
  return !!c && c === adminToken();
}
