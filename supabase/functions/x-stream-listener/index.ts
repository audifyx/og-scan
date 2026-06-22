import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const BEARER_TOKEN = Deno.env.get("X_BEARER_TOKEN")!;
const BOT_ENDPOINT = "https://ffjipnkhcebjvttliptb.functions.supabase.co/x-reply-bot";
const BOT_USERNAME = "audifyx";
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 999;
const RECONNECT_DELAY = 5000;
async function connectStream() {
  const url = "https://api.x.com/2/tweets/search/stream?tweet.fields=author_id,public_metrics,created_at&expansions=author_id";
  const headers = {
    "Authorization": `Bearer ${BEARER_TOKEN}`
  };
  try {
    console.log(`[Stream] Connecting... (attempt ${reconnectAttempts + 1})`);
    const resp = await fetch(url, {
      headers
    });
    if (!resp.ok) {
      throw new Error(`Stream error: ${resp.status} ${resp.statusText}`);
    }
    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response body");
    reconnectAttempts = 0; // Reset on successful connection
    console.log("[Stream] ✅ Connected");
    const decoder = new TextDecoder();
    let buffer = "";
    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {
        stream: true
      });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines){
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.data) {
            const tweet = data.data;
            console.log(`[Stream] 📱 Mention: ${tweet.text.substring(0, 60)}...`);
            // Send to bot endpoint
            await fetch(BOT_ENDPOINT, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                type: "mention",
                tweet: tweet
              })
            });
          }
        } catch (e) {
          console.error("[Stream] Parse error:", e);
        }
      }
    }
  } catch (error) {
    console.error("[Stream] ❌ Error:", error);
    reconnectAttempts++;
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      console.log(`[Stream] Reconnecting in ${RECONNECT_DELAY}ms...`);
      await new Promise((resolve)=>setTimeout(resolve, RECONNECT_DELAY));
      await connectStream();
    } else {
      console.error("[Stream] Max reconnect attempts reached");
    }
  }
}
// Start stream in background
connectStream().catch(console.error);
serve(async (req)=>{
  return new Response(JSON.stringify({
    status: "Stream running",
    bot: BOT_USERNAME,
    endpoint: BOT_ENDPOINT
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
