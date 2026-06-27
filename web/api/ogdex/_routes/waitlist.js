import { send } from "../_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return send(res, 400, { error: "Invalid email" });
  }

  try {
    // Store in Supabase or a simple KV store
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const res2 = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        email, 
        created_at: new Date().toISOString(),
        ip: req.headers["x-forwarded-for"] || req.connection.remoteAddress
      }),
    });

    if (res2.ok || res2.status === 409) {
      // 409 = already exists, which is fine
      return send(res, 200, { ok: true, message: "Added to waitlist" });
    }

    return send(res, 500, { error: "Failed to save" });
  } catch (e) {
    console.error("waitlist error:", e);
    return send(res, 500, { error: e.message });
  }
}
