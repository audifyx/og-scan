import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ACCESS_TOKEN = Deno.env.get("TWITTER_ACCESS_TOKEN")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
async function generateAIReply(tweetText) {
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
                text: `Someone just mentioned you in a tweet: "${tweetText}"

Generate a helpful, friendly AI response (max 200 chars). End with #AIBot. Be conversational and genuine.`
              }
            ]
          }
        ]
      })
    });
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      let reply = data.candidates[0].content.parts[0].text.trim();
      if (reply.length > 280) reply = reply.substring(0, 277) + "...";
      return reply;
    }
    return "Thanks for the mention! How can I help? #AIBot";
  } catch (error) {
    console.error("Gemini error:", error);
    return "Thanks for mentioning me! Let me know what you need. #AIBot";
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
      return data.data;
    } else {
      console.error(`X API error: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.error("Post error:", error);
    return null;
  }
}
async function logReply(mentionId, replyId, replyText) {
  try {
    await supabase.from("x_replies").insert({
      mention_id: mentionId,
      reply_id: replyId,
      reply_text: replyText,
      status: "replied"
    });
  } catch (error) {
    console.error("DB error:", error);
  }
}
serve(async (req)=>{
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (!body.mention_id || !body.tweet_text) {
        return new Response(JSON.stringify({
          error: "Missing mention_id or tweet_text"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      console.log(`Processing mention: ${body.mention_id}`);
      // Generate AI reply
      const replyText = await generateAIReply(body.tweet_text);
      console.log(`Generated reply: ${replyText}`);
      // Post to X
      const posted = await postReply(body.mention_id, replyText);
      if (posted) {
        console.log(`Posted: ${posted.id}`);
        // Log to database
        await logReply(body.mention_id, posted.id, replyText);
        return new Response(JSON.stringify({
          success: true,
          reply_id: posted.id,
          reply_text: posted.text
        }), {
          status: 201,
          headers: {
            "Content-Type": "application/json"
          }
        });
      } else {
        return new Response(JSON.stringify({
          error: "Failed to post reply"
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
    } catch (error) {
      console.error("Function error:", error);
      return new Response(JSON.stringify({
        error: String(error)
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  }
  return new Response(JSON.stringify({
    status: "ready"
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
