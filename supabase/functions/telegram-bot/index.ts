import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

async function callGemini(prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are OG Scanner AI, a crypto-native Telegram assistant for Solana meme coin traders. 
          Personality: Crypto-native, understands Solana, meme coins, whales, liquidity, rugs, DexScreener, market cap, volume, and the OG Scanner ecosystem. 
          Avoid fake hype and warn about risky projects. Feel like a real crypto trading assistant, not generic ChatGPT.
          
          User message: ${prompt}`
        }]
      }]
    })
  });
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble connecting to my brain right now.";
}

async function getTrending() {
  const response = await fetch(`${DEXSCREENER_API}/search?q=solana`);
  const data = await response.json();
  const pairs = data.pairs?.slice(0, 5) || [];
  if (pairs.length === 0) return "No trending pairs found right now.";
  
  return pairs.map((p: any) => 
    `🚀 *${p.baseToken.symbol}/${p.quoteToken.symbol}*\n` +
    `Price: $${p.priceUsd}\n` +
    `MCap: $${p.fdv?.toLocaleString()}\n` +
    `24h Vol: $${p.volume?.h24?.toLocaleString()}\n` +
    `[View on DexScreener](${p.url})`
  ).join("\n\n");
}

async function searchToken(query: string) {
  const response = await fetch(`${DEXSCREENER_API}/search?q=${query}`);
  const data = await response.json();
  const pair = data.pairs?.[0];
  if (!pair) return "Token not found.";
  
  return `🔍 *${pair.baseToken.name} (${pair.baseToken.symbol})*\n` +
    `Price: $${pair.priceUsd}\n` +
    `MCap: $${pair.fdv?.toLocaleString()}\n` +
    `Liquidity: $${pair.liquidity?.usd?.toLocaleString()}\n` +
    `24h Change: ${pair.priceChange?.h24}%\n` +
    `[View on DexScreener](${pair.url})`;
}

serve(async (req) => {
  try {
    const update = await req.json();
    if (!update.message) return new Response("ok");

    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    const botUsername = "@OGScannerAIBot";

    let responseText = "";

    if (text.startsWith("/start")) {
      responseText = "Welcome to OG Scanner AI! 🚀\n\nI'm your Solana meme coin assistant. Use /help to see what I can do.";
    } else if (text.startsWith("/help")) {
      responseText = "Commands:\n/ai <msg> - Chat with Gemini AI\n/trending - Top Solana pairs\n/search <ticker> - Find token info\n/newpairs - Latest pairs\n/whales - Whale activity (coming soon)\n/watch <ca> - Track a token";
    } else if (text.startsWith("/ai")) {
      const prompt = text.replace("/ai", "").trim();
      responseText = await callGemini(prompt || "Tell me about Solana meme coins.");
    } else if (text.startsWith("/trending")) {
      responseText = await getTrending();
    } else if (text.startsWith("/search")) {
      const query = text.replace("/search", "").trim();
      responseText = await searchToken(query || "SOL");
    } else if (text.includes(botUsername) || update.message.chat.type === "private") {
      responseText = await callGemini(text);
    }

    if (responseText) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: responseText,
          parse_mode: "Markdown",
        }),
      });
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
