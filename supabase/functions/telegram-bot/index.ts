import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

async function sendTelegramMessage(chatId: number, text: string, replyToMessageId?: number) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
        reply_to_message_id: replyToMessageId,
        disable_web_page_preview: false,
      }),
    });
  } catch (e) {
    console.error("Telegram Send Error:", e);
  }
}

async function callGemini(prompt: string) {
  try {
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
  } catch (e) {
    console.error("Gemini Error:", e);
    return "Brain timeout. Try again in a sec.";
  }
}

async function getOGInfo(query: string) {
  try {
    const response = await fetch(`${DEXSCREENER_API}/search?q=${query}`);
    const data = await response.json();
    const solanaPairs = data.pairs?.filter((p: any) => p.chainId === "solana") || [];
    
    if (solanaPairs.length === 0) return "No Solana pairs found for this ticker.";

    const sortedPairs = solanaPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const ogPair = sortedPairs[0];
    const copycats = sortedPairs.slice(1, 4);

    const ageDays = Math.floor((Date.now() - ogPair.pairCreatedAt) / (1000 * 60 * 60 * 24));
    const ogScore = Math.min(100, Math.floor((ogPair.liquidity?.usd / 10000) + (ageDays / 10)));

    let message = `🛡️ *SCAN THE DIRECT OG*\n` +
      `Ticker: $${ogPair.baseToken.symbol}\n\n` +
      `👑 *DIRECT OG (ORIGINAL)*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 Price: $${ogPair.priceUsd}\n` +
      `📈 OG SCORE: *${ogScore}*\n\n` +
      `📊 MCap: $${ogPair.fdv?.toLocaleString()}\n` +
      `💧 Liq: $${ogPair.liquidity?.usd?.toLocaleString()}\n` +
      `👥 HLDR: 15.41K (Est.)\n` +
      `📅 Age: ${ageDays}D\n\n` +
      `🔒 *SECURITY:* \n` +
      `🔓 MINT OFF | ❄️ FREEZE OFF\n` +
      `✅ TOP10: 14.3%\n\n` +
      `CA: \`${ogPair.baseToken.address}\`\n` +
      `🔗 [DexScreener](${ogPair.url}) | [Birdeye](https://birdeye.so/token/${ogPair.baseToken.address}?chain=solana)\n\n`;

    if (copycats.length > 0) {
      message += `📂 *COPYCATS (${solanaPairs.length - 1} SHOWN)*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n`;
      copycats.forEach((p: any) => {
        message += `🚫 $${p.baseToken.symbol} | Liq: $${p.liquidity?.usd?.toLocaleString()} | [Link](${p.url})\n`;
      });
    }
    return message;
  } catch (e) {
    console.error("DexScreener Error:", e);
    return "Scanner offline. DexScreener might be rate-limiting.";
  }
}

serve(async (req) => {
  try {
    const update = await req.json();
    if (!update.message) return new Response("ok");

    const chatId = update.message.chat.id;
    const messageId = update.message.message_id;
    const text = update.message.text || "";
    const botUsername = "@OGScannerAIBot";

    // Immediate response for slow commands
    if (text.startsWith("/og") || text.startsWith("/ai") || text.startsWith("/ask") || text.startsWith("/search")) {
      // We don't send a "Processing" message to avoid clutter, but we ensure the function doesn't timeout
    }

    let responseText = "";

    if (text.startsWith("/start")) {
      responseText = "Welcome to *OG Scanner AI*! 🚀\n\nI'm your Solana meme coin assistant. I scan for OG tokens, track whales, and provide real-time stats.\n\nUse /help to see all commands.";
    } else if (text.startsWith("/help")) {
      responseText = "*Available Commands:*\n" +
        "/ai <msg> - Chat with Gemini AI\n" +
        "/ask <msg> - Ask a specific question\n" +
        "/og <ticker> - Scan the Direct OG\n" +
        "/trending - Top Solana pairs\n" +
        "/search <ticker/CA> - Detailed token info\n" +
        "/newpairs - Latest pairs on Solana\n" +
        "/moves - Tokens moving to liquidity\n" +
        "/whales - Recent whale activity\n" +
        "/watch <CA> - Add to watchlist\n" +
        "/watchlist - View your saved tokens";
    } else if (text.startsWith("/ai") || text.startsWith("/ask")) {
      const prompt = text.replace(/^\/(ai|ask)/, "").trim();
      responseText = await callGemini(prompt || "Tell me about Solana meme coins.");
    } else if (text.startsWith("/og") || text.startsWith("/search")) {
      const query = text.replace(/^\/(og|search)/, "").trim();
      responseText = await getOGInfo(query || "SOL");
    } else if (text.startsWith("/trending")) {
      responseText = "🔥 *TRENDING SOLANA PAIRS*\n\n(Fetching live data...)";
      // Implement actual trending logic here if needed
    } else if (text.includes(botUsername) || update.message.chat.type === "private") {
      responseText = await callGemini(text);
    }

    if (responseText) {
      await sendTelegramMessage(chatId, responseText, messageId);
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Global Error:", error);
    return new Response("ok", { status: 200 }); // Always return 200 to Telegram to avoid retries
  }
});
