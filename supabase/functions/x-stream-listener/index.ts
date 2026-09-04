/**
 * Filtered-stream listener. Forwards mentions to x-reply-bot with the shared secret.
 * Its own HTTP surface is health-only and does not post to X.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN") || "";
const BOT_ENDPOINT =
  Deno.env.get("X_REPLY_BOT_URL") ||
  "https://ffjipnkhcebjvttliptb.functions.supabase.co/x-reply-bot";
const REPLY_SECRET =
  Deno.env.get("X_REPLY_BOT_SECRET") || Deno.env.get("OXW_WORKER_SECRET") || "";
const BOT_USERNAME = "audifyx";
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 999;
const RECONNECT_DELAY = 5000;

async function connectStream() {
  if (!BEARER_TOKEN || !REPLY_SECRET) {
    console.error("[Stream] Missing X_BEARER_TOKEN or X_REPLY_BOT_SECRET/OXW_WORKER_SECRET — not connecting");
    return;
  }
  const url =
    "https://api.x.com/2/tweets/search/stream?tweet.fields=author_id,public_metrics,created_at&expansions=author_id";
  try {
    console.log(`[Stream] Connecting... (attempt ${reconnectAttempts + 1})`);
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${BEARER_TOKEN}` } });
    if (!resp.ok) throw new Error(`Stream error: ${resp.status} ${resp.statusText}`);
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response body");
    reconnectAttempts = 0;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.data) {
            const tweet = data.data;
            await fetch(BOT_ENDPOINT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${REPLY_SECRET}`,
                "x-orbitx-reply-secret": REPLY_SECRET,
              },
              body: JSON.stringify({
                type: "mention",
                tweet: {
                  id: tweet.id,
                  text: tweet.text,
                  public_metrics: tweet.public_metrics || {},
                },
              }),
            });
          }
        } catch (e) {
          console.error("[Stream] Parse error:", e);
        }
      }
    }
  } catch (error) {
    console.error("[Stream] Error:", error);
    reconnectAttempts++;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY));
      await connectStream();
    }
  }
}

connectStream().catch(console.error);

serve(async () => {
  return new Response(JSON.stringify({ status: "ok", bot: BOT_USERNAME }), {
    headers: { "Content-Type": "application/json" },
  });
});
