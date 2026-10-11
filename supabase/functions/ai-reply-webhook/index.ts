/**
 * Legacy mention reply webhook.
 * AUTH REQUIRED: same shared secret as x-reply-bot.
 * TWITTER_ACCESS_TOKEN is only used after authorizeXReplyRequest() succeeds.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authorizeXReplyRequest,
  clientIp,
  createRateLimiter,
  validateMentionPayload,
} from "../_shared/x-reply-guard.js";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const limiter = createRateLimiter();

function envMap() {
  return {
    X_REPLY_BOT_SECRET: Deno.env.get("X_REPLY_BOT_SECRET") || "",
    OXW_WORKER_SECRET: Deno.env.get("OXW_WORKER_SECRET") || "",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function generateAIReply(tweetText: string) {
  if (!GEMINI_API_KEY) return null;
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Someone just mentioned you in a tweet: "${tweetText}"

Generate a helpful, friendly AI response (max 200 chars). End with #AIBot. Be conversational and genuine.`,
                },
              ],
            },
          ],
        }),
      },
    );
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return String(data.candidates[0].content.parts[0].text).trim().slice(0, 200);
    }
    return null;
  } catch (error) {
    console.error("Gemini error:", error);
    return null;
  }
}

async function postReply(tweetId: string, replyText: string) {
  const accessToken = Deno.env.get("TWITTER_ACCESS_TOKEN") || "";
  if (!accessToken) return null;
  try {
    const response = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: replyText.substring(0, 280),
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    });
    if (response.status === 201) {
      const data = await response.json();
      return data.data;
    }
    return null;
  } catch (error) {
    console.error("Post error:", error);
    return null;
  }
}

serve(async (req) => {
  const ip = clientIp(req);
  const ts = new Date().toISOString();

  if (req.method === "GET" || req.method === "HEAD") return json({ error: "not_found" }, 404);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // AUTH — do not call Gemini or X until this passes.
  const auth = authorizeXReplyRequest(req, envMap());
  if (!auth.ok) {
    console.warn(JSON.stringify({ event: "ai-reply-webhook.denied", ip, ts, error: auth.error }));
    return json({ error: auth.error }, auth.status);
  }

  if (!limiter.allow(ip)) {
    console.warn(JSON.stringify({ event: "ai-reply-webhook.rate_limited", ip, ts }));
    return json({ error: "rate_limited" }, 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = validateMentionPayload(body);
  if (!parsed.ok) {
    console.warn(JSON.stringify({ event: "ai-reply-webhook.invalid", ip, ts, error: parsed.error }));
    return json({ error: parsed.error }, 400);
  }

  console.log(JSON.stringify({ event: "ai-reply-webhook.mention", ip, ts, tweetId: parsed.tweet.id }));

  const replyText = await generateAIReply(parsed.tweet.text);
  if (!replyText) return json({ error: "generate_failed" }, 502);
  const posted = await postReply(parsed.tweet.id, replyText);
  if (!posted) return json({ error: "post_failed" }, 502);

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    await supabase.from("x_replies").insert({
      mention_id: parsed.tweet.id,
      reply_id: posted.id,
      reply_text: replyText,
      status: "replied",
    });
  }

  return json({ ok: true, reply_id: posted.id });
});
