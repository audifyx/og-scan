/**
 * Upstash Rate Limiting Middleware
 *
 * USAGE:
 *  import { rateLimit } from "@/api/rate-limit";
 *
 *  export default async function handler(req, res) {
 *    // Max 5 login attempts per 15 minutes per (IP + email)
 *    const limited = await rateLimit("login", req, {
 *      maxAttempts: 5,
 *      windowMs: 15 * 60 * 1000, // 15 minutes
 *      keyPrefix: `${req.body.email}:${req.headers["x-forwarded-for"]}`,
 *    });
 *
 *    if (limited) {
 *      return res.status(429).json({
 *        error: "Too many login attempts. Try again in 15 minutes.",
 *        retryAfter: 900,
 *      });
 *    }
 *
 *    // Safe to proceed with auth
 *  }
 *
 * RATE LIMIT RECOMMENDATIONS:
 *  - Login:      5 attempts per 15 minutes (per IP + email)
 *  - Signup:     3 attempts per hour (per IP + email)
 *  - Password Reset: 3 attempts per hour (per IP + email)
 *  - API calls:  100 per minute per user (per JWT subject)
 *
 * SETUP:
 *  1. Create Upstash account: https://upstash.com
 *  2. Create Redis database
 *  3. Add to .env:
 *     UPSTASH_REDIS_REST_URL=https://...
 *     UPSTASH_REDIS_REST_TOKEN=...
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextApiRequest } from "next";

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number; // milliseconds
  keyPrefix?: string; // e.g., "email:ip"
}

/**
 * Rate limit a specific action
 * Returns true if RATE LIMITED (deny request), false if OK (allow)
 *
 * @param action - "login", "signup", "password_reset", etc.
 * @param req - Next.js API request
 * @param options - Rate limit settings
 */
export async function rateLimit(
  action: string,
  req: NextApiRequest,
  options: RateLimitOptions,
): Promise<boolean> {
  try {
    // Use provided key prefix, or derive from IP + user ID
    const key =
      options.keyPrefix ||
      `${action}:${req.headers["x-forwarded-for"] || req.socket.remoteAddress}`;

    // Create a Ratelimit instance
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(options.maxAttempts, `${options.windowMs}ms`),
      analytics: true,
      prefix: `@ratelimit_${action}`,
    });

    // Check rate limit
    const { success, limit, remaining, reset } = await ratelimit.limit(key);

    // Store metadata for later (e.g., for temporary account lockout)
    if (!success) {
      const lockoutKey = `${key}:lockout`;
      const lockoutUntil = Date.now() + 15 * 60 * 1000; // Lock out for 15 min
      await redis.set(lockoutKey, lockoutUntil, { ex: 900 }); // Expires in 15 min
    }

    return !success; // true = rate limited, false = ok
  } catch (err) {
    console.error(`Rate limit check failed for ${action}:`, err);
    // On error, allow the request (fail open) — don't block users due to Redis outage
    return false;
  }
}

/**
 * Check if a user/IP is currently in lockout
 * Returns lockout end time in milliseconds (0 if not locked out)
 */
export async function getLockoutTime(key: string): Promise<number> {
  try {
    const lockoutKey = `${key}:lockout`;
    const lockoutUntil = await redis.get<number>(lockoutKey);
    return lockoutUntil || 0;
  } catch {
    return 0;
  }
}

/**
 * Pre-configured rate limiters for common auth flows
 */
export const rateLimiters = {
  /**
   * Login: 5 attempts per 15 minutes per (IP + email)
   */
  login: async (email: string, ip: string) =>
    rateLimit("login", { headers: { "x-forwarded-for": ip } } as NextApiRequest, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      keyPrefix: `login:${email}:${ip}`,
    }),

  /**
   * Signup: 3 attempts per hour per (IP + email)
   */
  signup: async (email: string, ip: string) =>
    rateLimit("signup", { headers: { "x-forwarded-for": ip } } as NextApiRequest, {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000,
      keyPrefix: `signup:${email}:${ip}`,
    }),

  /**
   * Password Reset: 3 attempts per hour per (IP + email)
   */
  passwordReset: async (email: string, ip: string) =>
    rateLimit(
      "password_reset",
      { headers: { "x-forwarded-for": ip } } as NextApiRequest,
      {
        maxAttempts: 3,
        windowMs: 60 * 60 * 1000,
        keyPrefix: `password_reset:${email}:${ip}`,
      },
    ),

  /**
   * API calls: 100 per minute per user (by JWT sub)
   */
  apiCall: async (userId: string) =>
    rateLimit("api_call", { headers: { "x-forwarded-for": "" } } as NextApiRequest, {
      maxAttempts: 100,
      windowMs: 60 * 1000,
      keyPrefix: `api_call:${userId}`,
    }),
};
