import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN")!;
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://ffjipnkhcebjvttliptb.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BOT_USERNAME = "audifyx";
async function getGeminiReply(tweetText) {
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
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
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
async function postReply(tweetId, replyText) {
  try {
    const response = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: replyText.substring(0, 280),
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      })
    });
    if (response.status === 201) {
      const data = await response.json();
      const replyId = data.data.id;
      // Log to Supabase
      await supabase.table("x_replies").insert({
        mention_id: tweetId,
        reply_id: replyId,
        reply_text: replyText,
        status: "replied"
      });
      console.log(`✅ Replied to ${tweetId}`);
      return true;
    } else {
      console.error(`Post error: ${response.status}`, await response.text());
      return false;
    }
  } catch (error) {
    console.error("Post reply error:", error);
    return false;
  }
}
async function processMention(tweet) {
  // Skip high engagement
  if (tweet.public_metrics && tweet.public_metrics.reply_count > 10) {
    console.log(`⏭️ Skipping ${tweet.id} (high engagement)`);
    return;
  }
  console.log(`📱 Processing: ${tweet.text.substring(0, 80)}...`);
  const reply = await getGeminiReply(tweet.text);
  if (reply) {
    await postReply(tweet.id, reply);
  }
}
serve(async (req)=>{
  if (req.method === "POST") {
    const body = await req.json();
    if (body.type === "mention") {
      await processMention(body.tweet);
    }
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
  // Health check
  return new Response(JSON.stringify({
    status: "running"
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
