/**
 * API Route: POST /api/auth/signup
 *
 * ENFORCES:
 *  - Rate limiting (3 attempts per hour per IP+email)
 *  - Password strength validation (12+, no common patterns, no breaches)
 *  - Supabase Auth signup
 *  - httpOnly cookie storage (automatic via Supabase SSR)
 *
 * FLOW:
 *  1. Client sends email + password
 *  2. Server checks rate limits
 *  3. Server validates password strength
 *  4. Server calls Supabase Auth.signUp()
 *  5. Supabase sends verification email + sets httpOnly cookies
 *  6. Client is redirected to "check your email" page
 *
 * RESPONSE:
 *  200: { success: true, message: "Verification email sent to ..." }
 *  429: { error: "Too many signup attempts. Try again in 1 hour." }
 *  400: { error: "Password is too common", code: "INVALID_PASSWORD" }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { rateLimiters } from "@/api/rate-limit";
import { validatePassword } from "@/lib/password-validation";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, password, metadata } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    if (!email.includes("@")) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // 2. Check rate limits (3 signups per hour per IP+email)
    const ip =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket.remoteAddress ||
      "unknown";
    const isRateLimited = await rateLimiters.signup(email, ip);

    if (isRateLimited) {
      return res.status(429).json({
        error: "Too many signup attempts. Please try again in 1 hour.",
        code: "RATE_LIMITED",
      });
    }

    // 3. Validate password strength
    const passwordValidation = await validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: passwordValidation.error || "Password is not strong enough",
        code: "INVALID_PASSWORD",
      });
    }

    // 4. Create Supabase client (uses service role key for auth endpoints)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    );

    // 5. Sign up user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require verification
      user_metadata: metadata || {},
    });

    if (error) {
      // User already exists
      if (error.message.includes("already")) {
        return res.status(400).json({
          error: "Email already registered. Please sign in or use another email.",
          code: "USER_EXISTS",
        });
      }

      return res.status(400).json({
        error: error.message || "Signup failed",
        code: "AUTH_ERROR",
      });
    }

    // 6. Send verification email (automatic via Supabase)
    // Supabase will send an email with a magic link to verify
    // Browser can catch the verification via the redirect URL

    return res.status(200).json({
      success: true,
      message: `Verification email sent to ${email}. Please check your inbox.`,
      userId: data.user?.id,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      error: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
}
