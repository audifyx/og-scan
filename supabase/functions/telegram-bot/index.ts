import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const BIRDEYE_API_KEY = "d0b0455f927647d6806ca6d5730746e5";
const JUPITER_API_KEY = "jup_6e0d123f3459784011eaf91d3c3dc7799964432b0a1b98b566617f8c85c722f4";

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
    `💰 Price: $${p.priceUsd}\n` +
    `📊 MCap: $${p.fdv?.toLocaleString()}\n` +
    `💧 Liq: $${p.liquidity?.usd?.toLocaleString()}\n` +
    `📈 24h Vol: $${p.volume?.h24?.toLocaleString()}\n` +
    `🔗 [DexScreener](${p.url}) | [Birdeye](https://birdeye.so/token/${p.baseToken.address}?chain=solana)`
  ).join("\n\n");
}

async function getNewPairs() {
  // DexScreener doesn't have a direct "new" endpoint in the public API, but we can search for recent activity
  const response = await fetch(`${DEXSCREENER_API}/search?q=solana`);
  const data = await response.json();
  const pairs = data.pairs?.sort((a: any, b: any) => b.pairCreatedAt - a.pairCreatedAt).slice(0, 5) || [];
  
  return "🆕 *LATEST SOLANA PAIRS*\n\n" + pairs.map((p: any) => 
    `✨ *${p.baseToken.symbol}/${p.quoteToken.symbol}*\n` +
    `Created: ${new Date(p.pairCreatedAt).toLocaleTimeString()}\n` +
    `Liq: $${p.liquidity?.usd?.toLocaleString()}\n` +
    `CA: \`${p.baseToken.address}\`\n` +
    `🔗 [DexScreener](${p.url})`
  ).join("\n\n");
}

async function searchToken(query: string) {
  const response = await fetch(`${DEXSCREENER_API}/search?q=${query}`);
  const data = await response.json();
  const pair = data.pairs?.[0];
  if (!pair) return "Token not found.";
  
  const ca = pair.baseToken.address;
  return `🔍 *${pair.baseToken.name} (${pair.baseToken.symbol})*\n` +
    `\`${ca}\` (Tap to copy)\n\n` +
    `💰 Price: $${pair.priceUsd}\n` +
    `📊 MCap: $${pair.fdv?.toLocaleString()}\n` +
    `💧 Liquidity: $${pair.liquidity?.usd?.toLocaleString()}\n` +
    `📈 24h Change: ${pair.priceChange?.h24}%\n` +
    `📉 24h Vol: $${pair.volume?.h24?.toLocaleString()}\n\n` +
    `🔗 [DexScreener](${pair.url}) | [Birdeye](https://birdeye.so/token/${ca}?chain=solana) | [Jupiter](https://jup.ag/swap/SOL-${pair.baseToken.symbol})`;
}

async function getOGInfo(query: string) {
  const response = await fetch(`${DEXSCREENER_API}/search?q=${query}`);
  const data = await response.json();
  const pairs = data.pairs || [];
  if (pairs.length === 0) return "No pairs found for this ticker.";

  const ogPair = pairs.sort((a: any, b: any) => a.pairCreatedAt - b.pairCreatedAt)[0];
  const ca = ogPair.baseToken.address;
  const createdAt = new Date(ogPair.pairCreatedAt).toUTCString();

  return `💎 *OG FINDER: ${ogPair.baseToken.symbol}*\n` +
    `The original pair was detected on: \n📅 ${createdAt}\n\n` +
    `✅ *Origin Pair:* ${ogPair.baseToken.symbol}/${ogPair.quoteToken.symbol}\n` +
    `✅ *DEX:* ${ogPair.dexId}\n` +
    `✅ *CA:* \`${ca}\`\n\n` +
    `📊 *Current Stats:* \n` +
    `Price: $${ogPair.priceUsd}\n` +
    `MCap: $${ogPair.fdv?.toLocaleString()}\n` +
    `Liq: $${ogPair.liquidity?.usd?.toLocaleString()}\n\n` +
    `🔗 [View Origin on DexScreener](${ogPair.url})`;
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
      responseText = "Welcome to *OG Scanner AI*! 🚀\n\nI'm your Solana meme coin assistant. I scan for OG tokens, track whales, and provide real-time stats.\n\nUse /help to see all commands.";
    } else if (text.startsWith("/help")) {
      responseText = "*Available Commands:*\n" +
        "/ai <msg> - Chat with Gemini AI\n" +
        "/ask <msg> - Ask a specific question\n" +
        "/og <ticker> - Find the original pair (OG Finder)\n" +
        "/trending - Top Solana pairs\n" +
        "/search <ticker/CA> - Detailed token info\n" +
        "/newpairs - Latest pairs on Solana\n" +
        "/moves - Tokens moving from launch to liquidity\n" +
        "/whales - Recent whale activity (coming soon)\n" +
        "/watch <CA> - Add to watchlist\n" +
        "/watchlist - View your saved tokens";
    } else if (text.startsWith("/ai") || text.startsWith("/ask")) {
      const prompt = text.replace(/^\/(ai|ask)/, "").trim();
      responseText = await callGemini(prompt || "Tell me about Solana meme coins.");
    } else if (text.startsWith("/og")) {
      const query = text.replace("/og", "").trim();
      responseText = await getOGInfo(query || "SOL");
    } else if (text.startsWith("/trending")) {
      responseText = await getTrending();
    } else if (text.startsWith("/newpairs")) {
      responseText = await getNewPairs();
    } else if (text.startsWith("/moves")) {
      responseText = "🔄 *MIGRATIONS (MOVES)*\n\nScanning for tokens moving from Pump.fun to Raydium/Jupiter...\n\n(Feature integration in progress - check back in 5 mins!)";
    } else if (text.startsWith("/search")) {
      const query = text.replace("/search", "").trim();
      responseText = await searchToken(query || "SOL");
    } else if (text.startsWith("/watch")) {
      const ca = text.replace("/watch", "").trim();
      responseText = ca ? `✅ Added \`${ca}\` to your watchlist!` : "Please provide a Contract Address (CA).";
    } else if (text.startsWith("/watchlist")) {
      responseText = "📋 *YOUR WATCHLIST*\n\n(Feature requires database connection - setup in progress!)";
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
          disable_web_page_preview: false,
        }),
      });
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});
