import { send } from "../_lib.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return send(res, 400, { error: "Invalid email" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Save to Supabase
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

    if (!res2.ok && res2.status !== 409) {
      return send(res, 500, { error: "Failed to save" });
    }

    // Send email via Resend
    if (RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "OG Scan <noreply@ogscan.fun>",
            to: email,
            subject: "Welcome to OG Scan Waitlist 🚀",
            html: `
              <div style="max-width: 600px; margin: 0 auto; font-family: 'Sora', sans-serif; background: #04060E; color: #fff; padding: 40px 20px; border-radius: 24px;">
                <h1 style="background: linear-gradient(135deg, #fff 0%, #c27fff 40%, #14F195 80%, #00E5FF 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 32px; margin-bottom: 20px;">Welcome to the Waitlist!</h1>
                
                <p style="color: rgba(255,255,255,0.8); font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                  Thanks for joining our waitlist. We're rebranding OG Scan into something even more powerful, and we can't wait to show you what's coming.
                </p>

                <div style="background: rgba(153,69,255,0.1); border-left: 3px solid #9945FF; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
                  <p style="color: #c27fff; font-weight: 600; margin: 0;">Coming Soon: Full Rebrand</p>
                  <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 8px 0 0 0;">New name, new theme, new domain, new platform design. We're launching with even more powerful updates than before.</p>
                </div>

                <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 8px;">Stay in the loop:</p>
                <a href="https://t.me/ogupdates" style="display: inline-block; background: linear-gradient(135deg, #9945FF 0%, #2F80FF 50%, #14F195 100%); color: #fff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">Join Telegram</a>

                <hr style="border: none; border-top: 1px solid rgba(153,69,255,0.2); margin: 32px 0;">
                <p style="color: rgba(255,255,255,0.4); font-size: 12px; text-align: center;">OG Scan — Token Intelligence Platform<br/>© 2026 @ogscanbackup</p>
              </div>
            `
          }),
        });
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
        // Don't fail the request if email fails
      }
    }

    return send(res, 200, { ok: true, message: "Added to waitlist" });
  } catch (e) {
    console.error("waitlist error:", e);
    return send(res, 500, { error: e.message });
  }
}
