/**
 * API Route: POST /api/auth/signup
 * Closed as a direct createUser path. Production app uses web/api/auth/signup.ts
 * which proxies signup-guard (device + IP limits).
 */
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(410).json({
    error: "use_signup_guard",
    message: "Signup is only available through the OrbitX app.",
    code: "GONE",
  });
}
