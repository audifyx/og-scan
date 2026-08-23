import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://ffjipnkhcebjvttliptb.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BOT_USERNAME = "audifyx";

function authorized(req: Request): boolean {
  const secrets = [
    Deno.env.get("X_REPLY_BOT_SECRET") || "",
    Deno.env.get("ORBITX_INTERNAL_SECRET") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  ].map((s) => s.trim()).filter(Boolean);
  if (!secrets.length) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
  const hdr = (req.headers.get("x-orbitx-reply-secret") || "").trim();
  return secrets.some((secret) => secret === bearer || secret === hdr);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getGeminiReply(tweetText: string) {
  const prompt = `Someone mentioned @${BOT_USERNAME}: "${tweetText}"

Reply briefly and helpfully (max 200 chars). You are an AI assistant.
End with #AIBot to label yourself.
No links, no promotions, no spam.
Be conversational and helpful.`;
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    const data = await response.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    return null;
  } catch (error) {
    console.error("Gemini error:", error);
    return null;
  }
}

async function postReply(tweetId: string, replyText: string) {
  if (!ACCESS_TOKEN) {
    console.error("TWITTER_ACCESS_TOKEN missing — official mention bot disabled");
    return false;
  }
  try {
    const response = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: replyText.substring(0, 280),
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    });
    if (response.status === 201) {
      const data = await response.json();
      const replyId = data.data.id;
      await supabase.from("x_replies").insert({
        mention_id: tweetId,
        reply_id: replyId,
        reply_text: replyText,
        status: "replied",
      });
      return true;
    }
    console.error(`Post error: ${response.status}`, await response.text());
    return false;
  } catch (error) {
    console.error("Post reply error:", error);
    return false;
  }
}

async function processMention(tweet: { id?: string; text?: string; public_metrics?: { reply_count?: number } }) {
  if (!tweet?.id || !tweet?.text) return;
  if (tweet.public_metrics && (tweet.public_metrics.reply_count || 0) > 10) return;
  const reply = await getGeminiReply(tweet.text);
  if (reply) await postReply(tweet.id, reply);
}

serve(async (req) => {
  if (req.method === "GET") {
    return json({ status: "running", auth: "required" });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) {
    return json({ error: "unauthorized", message: "x-reply-bot requires the internal secret." }, 401);
  }
  const body = await req.json().catch(() => ({}));
  if (body.type === "mention" && body.tweet) {
    await processMention(body.tweet);
  }
  return json({ success: true });
});
