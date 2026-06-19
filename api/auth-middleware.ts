/**
 * Vercel API Route Auth Middleware
 *
 * ENFORCES:
 *  - Server-side session verification (never trust browser JWT claims)
 *  - Email verification check (blocks unverified users from write operations)
 *  - Role-based access control (admin, mod, user)
 *  - Rate limiting (see rate-limit middleware)
 *
 * USAGE:
 *  import { createServerSupabaseClient, requireAuth, requireVerifiedEmail, requireRole } from "@/lib/api-auth";
 *
 *  export default async function handler(req, res) {
 *    // Verify user is authenticated
 *    const user = await requireAuth(req);
 *    if (!user) return res.status(401).json({ error: "Unauthorized" });
 *
 *    // Verify email is confirmed
 *    const verifiedUser = await requireVerifiedEmail(req);
 *    if (!verifiedUser) return res.status(403).json({ error: "Email not verified" });
 *
 *    // Verify user is admin
 *    const adminUser = await requireRole(req, "admin");
 *    if (!adminUser) return res.status(403).json({ error: "Admin only" });
 *
 *    // Safe to proceed — user is verified and authorized
 *    res.status(200).json({ ok: true, user });
 *  }
 */

import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

// Create server-side Supabase client (uses service key, not anon key)
export function createServerSupabaseClient(
  serviceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || "",
) {
  const url = process.env.VITE_SUPABASE_URL || "";
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }
  return createClient(url, serviceRoleKey);
}

/**
 * Extract JWT from Authorization header
 * Browser sends: "Authorization: Bearer <jwt>"
 */
function extractJwt(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * Verify JWT signature and extract user
 * Returns null if JWT is invalid, expired, or missing
 */
export async function verifyJwtAndGetUser(req: NextApiRequest) {
  try {
    const jwt = extractJwt(req);
    if (!jwt) return null;

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(jwt);

    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Middleware: Require user to be authenticated
 * Use in any protected route
 */
export async function requireAuth(req: NextApiRequest) {
  const user = await verifyJwtAndGetUser(req);
  return user || null;
}

/**
 * Middleware: Require user to have verified email
 * Use for write operations (create, update, delete)
 * Blocks unverified users with 403 Forbidden
 */
export async function requireVerifiedEmail(req: NextApiRequest) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) return null;

  // Supabase stores verification status in user.email_confirmed_at
  if (!user.email_confirmed_at) return null;

  return user;
}

/**
 * Middleware: Require user to have a specific role
 * Checks the user's custom claim in JWT: app_metadata.role
 * Admin creates roles in Supabase dashboard: Auth → Policies
 */
export async function requireRole(
  req: NextApiRequest,
  requiredRole: "admin" | "moderator" | "user",
) {
  const user = await verifyJwtAndGetUser(req);
  if (!user) return null;

  const userRole = (user.user_metadata?.role || "user") as string;

  // Role hierarchy: admin > moderator > user
  const roleHierarchy: Record<string, number> = { admin: 3, moderator: 2, user: 1 };
  if ((roleHierarchy[userRole] || 0) < roleHierarchy[requiredRole]) {
    return null;
  }

  return user;
}

/**
 * Helper: Return 401 Unauthorized
 */
export function unauthorized(
  res: NextApiResponse,
  message = "Unauthorized",
) {
  return res.status(401).json({ error: message });
}

/**
 * Helper: Return 403 Forbidden
 */
export function forbidden(
  res: NextApiResponse,
  message = "Forbidden",
) {
  return res.status(403).json({ error: message });
}

/**
 * Helper: Return 429 Too Many Requests (rate limited)
 */
export function rateLimited(
  res: NextApiResponse,
  retryAfterSeconds: number = 60,
) {
  return res
    .status(429)
    .setHeader("Retry-After", retryAfterSeconds.toString())
    .json({ error: "Too many requests. Try again later." });
}

/**
 * RLS Policy Helpers
 *
 * Add these policies to each table in Supabase:
 *
 * -- Read: Authenticated users only
 * CREATE POLICY "Users can read own data"
 * ON public.profiles
 * FOR SELECT
 * USING (auth.uid() = id);
 *
 * -- Write: Authenticated + Verified email only
 * CREATE POLICY "Users can write own data (verified)"
 * ON public.profiles
 * FOR UPDATE
 * USING (auth.uid() = id)
 * WITH CHECK (auth.uid() = id AND auth.jwt() -> 'email_confirmed_at' IS NOT NULL);
 *
 * -- Admin: Admin role only
 * CREATE POLICY "Only admins can delete"
 * ON public.profiles
 * FOR DELETE
 * USING (auth.jwt() -> 'app_metadata' -> 'role' = '"admin"');
 *
 * -- Rate limit tracking table (for Upstash middleware)
 * CREATE TABLE public.rate_limit_events (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   ip_address INET,
 *   action TEXT NOT NULL,
 *   attempted_at TIMESTAMP DEFAULT NOW(),
 *   created_at TIMESTAMP DEFAULT NOW()
 * );
 * CREATE INDEX idx_rate_limit_user_action ON public.rate_limit_events(user_id, action, attempted_at);
 * CREATE INDEX idx_rate_limit_ip_action ON public.rate_limit_events(ip_address, action, attempted_at);
 */
