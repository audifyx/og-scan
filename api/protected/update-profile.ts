/**
 * API Route: PUT /api/protected/my-profile
 *
 * ENFORCES:
 *  - Server-side session verification (via JWT)
 *  - Email must be verified (email_confirmed_at must be set)
 *  - User can only update their own profile
 *  - RLS policy double-checks access control
 *
 * FLOW:
 *  1. Client sends PUT request with Authorization: Bearer <JWT>
 *  2. Server verifies JWT signature
 *  3. Server checks email_confirmed_at (must be set)
 *  4. Server extracts user ID
 *  5. Server updates only that user's profile
 *  6. RLS policy ensures no cross-user updates
 *
 * RESPONSE:
 *  200: { id, email, username, updated_at, ... }
 *  401: { error: "Please sign in" }
 *  403: { error: "Please verify your email first" }
 *  429: { error: "Too many requests" }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  requireVerifiedEmail,
  unauthorized,
  forbidden,
  rateLimited,
} from "@/api/auth-middleware";
import { rateLimiters } from "@/api/rate-limit";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Verify user is authenticated AND email is verified
    const user = await requireVerifiedEmail(req);
    if (!user) {
      // Check which gate failed
      const { data: basicUser } = await (
        await (await import("@supabase/supabase-js")).createClient(
          process.env.VITE_SUPABASE_URL || "",
          process.env.SUPABASE_ANON_KEY || "",
        ).auth
      ).getUser(req.headers.authorization?.replace("Bearer ", "") || "");

      if (!basicUser) {
        return unauthorized(res, "Please sign in");
      }

      return forbidden(
        res,
        "Please verify your email before updating your profile",
      );
    }

    // 2. Rate limit (100 updates per minute per user)
    const isLimited = await rateLimiters.apiCall(user.id);
    if (isLimited) {
      return rateLimited(res, 60);
    }

    // 3. Validate input
    const { username, display_name, bio } = req.body;

    if (!username && !display_name && !bio) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Validate username format if provided
    if (username && !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: "Username must be 3-20 characters, alphanumeric + _ -",
      });
    }

    // 4. Create Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || "",
      {
        global: {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.replace("Bearer ", "")}`,
          },
        },
      },
    );

    // 5. Update user's own profile
    const updateData: Record<string, any> = {};
    if (username) updateData.username = username;
    if (display_name) updateData.display_name = display_name;
    if (bio) updateData.bio = bio;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      // Check if it's a conflict (username already taken)
      if (error.message.includes("unique")) {
        return res.status(409).json({
          error: "Username is already taken",
          code: "DUPLICATE_USERNAME",
        });
      }

      return res.status(400).json({ error: error.message });
    }

    // 6. Return updated profile
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * RLS POLICIES FOR profiles TABLE:
 *
 * -- Read: Users can read own profile
 * CREATE POLICY "Users can read own profile"
 * ON public.profiles
 * FOR SELECT
 * USING (auth.uid() = id);
 *
 * -- Write: Users can update own profile ONLY if email verified
 * CREATE POLICY "Users can update own profile (verified)"
 * ON public.profiles
 * FOR UPDATE
 * USING (auth.uid() = id)
 * WITH CHECK (
 *   auth.uid() = id
 *   AND (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL
 * );
 *
 * This double-checks that even if the API is exploited,
 * the database will reject updates from unverified users.
 */
