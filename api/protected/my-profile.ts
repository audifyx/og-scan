/**
 * API Route: GET /api/protected/my-profile
 *
 * ENFORCES:
 *  - Server-side session verification (via JWT)
 *  - User can only read their own profile
 *  - RLS policy on database layer double-checks
 *
 * FLOW:
 *  1. Client sends GET request with Authorization: Bearer <JWT>
 *  2. Server verifies JWT signature
 *  3. Server extracts user ID from JWT
 *  4. Server queries profiles table filtered to that user (RLS)
 *  5. Server returns only that user's data
 *
 * RESPONSE:
 *  200: { id, email, username, created_at, ... }
 *  401: { error: "Unauthorized" }
 *  403: { error: "Access denied" }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth, unauthorized, forbidden } from "@/api/auth-middleware";
import { createClient } from "@supabase/supabase-js";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1. Verify user is authenticated
  const user = await requireAuth(req);
  if (!user) {
    return unauthorized(res, "Please sign in to view your profile");
  }

  try {
    // 2. Create Supabase client with user's JWT
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || "",
      process.env.SUPABASE_ANON_KEY || "", // Use anon key; RLS enforces access control
      {
        global: {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.replace("Bearer ", "")}`,
          },
        },
      },
    );

    // 3. Query user's own profile (RLS policy ensures this works)
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (!data) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // 4. Return user's profile
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * RLS POLICY FOR profiles TABLE:
 *
 * CREATE POLICY "Users can read own profile"
 * ON public.profiles
 * FOR SELECT
 * USING (auth.uid() = id);
 *
 * This policy ensures that even if the API route is exploited,
 * the database will still only return the user's own data.
 */
