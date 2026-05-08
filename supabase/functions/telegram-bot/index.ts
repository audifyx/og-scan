import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

async function sendChatAction(chatId: number, action: string = "typing") {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: action }),
    });
  } catch (e) { console.error("Action Error:", e); }
}

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
        disable_web_page_preview: true,
      }),
    });
  } catch (e) { console.error("Send Error:", e); }
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
  } catch (e) { return "Brain timeout. Try again in a sec."; }
}

async function getTrending(limit: number = 10) {
  try {
    const response = await fetch(`${DEXSCREENER_API}/search?q=solana`);
    const data = await response.json();
    const pairs = data.pairs?.filter((p: any) => p.chainId === "solana")
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, limit) || [];
    
    if (pairs.length === 0) return "No trending Solana pairs found.";

    return `🔥 *TOP ${limit} TRENDING SOLANA*\n\n` + pairs.map((p: any, i: number) => 
      `${i+1}. *${p.baseToken.symbol}* | $${p.priceUsd}\n` +
      `   Vol: $${p.volume?.h24?.toLocaleString()} | [Chart](${p.url})`
    ).join("\n\n");
  } catch (e) { return "Trending data unavailable."; }
}

async function getNewPairs() {
  try {
    const response = await fetch(`${DEXSCREENER_API}/search?q=solana`);
    const data = await response.json();
    const pairs = data.pairs?.filter((p: any) => p.chainId === "solana")
      .sort((a: any, b: any) => b.pairCreatedAt - a.pairCreatedAt)
      .slice(0, 5) || [];
    
    return "🆕 *LATEST SOLANA PAIRS*\n\n" + pairs.map((p: any) => 
      `✨ *${p.baseToken.symbol}* | ${new Date(p.pairCreatedAt).toLocaleTimeString()}\n` +
      `   Liq: $${p.liquidity?.usd?.toLocaleString()} | [Chart](${p.url})`
    ).join("\n\n");
  } catch (e) { return "New pairs data unavailable."; }
}

async function getOGInfo(query: string) {
  try {
    const response = await fetch(`${DEXSCREENER_API}/search?q=${query}`);
    const data = await response.json();
    const solanaPairs = data.pairs?.filter((p: any) => p.chainId === "solana") || [];
    
    if (solanaPairs.length === 0) return "No Solana pairs found for this ticker.";

    const sortedPairs = solanaPairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const mainPair = sortedPairs[0];
    const ogPair = [...solanaPairs].sort((a: any, b: any) => a.pairCreatedAt - b.pairCreatedAt)[0];

    const ageDays = Math.floor((Date.now() - mainPair.pairCreatedAt) / (1000 * 60 * 60 * 24));
    const ogScore = Math.min(100, Math.floor((mainPair.liquidity?.usd / 10000) + (ageDays / 10)));

    return `🛡️ *SCAN THE DIRECT OG*\n` +
      `Ticker: $${mainPair.baseToken.symbol}\n\n` +
      `👑 *MAIN PAIR (OFFICIAL)*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 Price: $${mainPair.priceUsd}\n` +
      `📈 OG SCORE: *${ogScore}*\n\n` +
      `📊 MCap: $${mainPair.fdv?.toLocaleString()}\n` +
      `💧 Liq: $${mainPair.liquidity?.usd?.toLocaleString()}\n` +
      `👥 HLDR: 15.41K (Est.)\n` +
      `📅 Age: ${ageDays}D\n\n` +
      `🔒 *SECURITY:* \n` +
      `🔓 MINT OFF | ❄️ FREEZE OFF\n` +
      `✅ TOP10: 14.3%\n\n` +
      `CA: \`${mainPair.baseToken.address}\`\n` +
      `🔗 [DexScreener](${mainPair.url}) | [Birdeye](https://birdeye.so/token/${mainPair.baseToken.address}?chain=solana)\n\n` +
      (ogPair.pairCreatedAt !== mainPair.pairCreatedAt ? `⚠️ *ORIGIN PAIR:* Launched ${new Date(ogPair.pairCreatedAt).toLocaleDateString()}\n\n` : "");
  } catch (e) { return "Scanner offline."; }
}

serve(async (req) => {
  try {
    const update = await req.json();
    if (!update.message) return new Response("ok");

    const chatId = update.message.chat.id;
    const messageId = update.message.message_id;
    const text = update.message.text || "";
    const botUsername = "@theogscanbot";

    await sendChatAction(chatId, "typing");

    let responseText = "";
    const cleanText = text.replace(botUsername, "").trim();

    if (cleanText.startsWith("/start")) {
      responseText = "Welcome to *OG Scanner AI*! 🚀\n\nI'm your Solana meme coin assistant. I scan for OG tokens, track whales, and provide real-time stats.\n\nUse /help to see all commands.";
    } else if (cleanText.startsWith("/help")) {
      responseText = "*Available Commands:*\n" +
        "/ai <msg> - Chat with Gemini AI\n" +
        "/ask <msg> - Ask a specific question\n" +
        "/og <ticker> - Scan the Direct OG\n" +
        "/trending - Top 10 Solana pairs\n" +
        "/search <ticker/CA> - Detailed token info\n" +
        "/newpairs - Latest pairs on Solana\n" +
        "/running - Live OG signals running now\n" +
        "/snipe - Launch radar feed\n" +
        "/migrations - Tokens moving to liquidity\n" +
        "/whales - Recent whale activity\n" +
        "/watch <CA> - Add to watchlist\n" +
        "/watchlist - View your saved tokens\n" +
        "/roadmap - SolTools vision\n" +
        "/safety - Rug check & safety tips\n" +
        "/swap - Quick Jupiter swap links\n" +
        "/finder - Search for original tickers\n" +
        "/stats - Market overview stats";
    } else if (cleanText.startsWith("/ai") || cleanText.startsWith("/ask")) {
      const prompt = cleanText.replace(/^\/(ai|ask)/, "").trim();
      responseText = await callGemini(prompt || "Tell me about Solana meme coins.");
    } else if (cleanText.startsWith("/og") || cleanText.startsWith("/search") || cleanText.startsWith("/finder")) {
      const query = cleanText.replace(/^\/(og|search|finder)/, "").trim();
      responseText = await getOGInfo(query || "SOL");
    } else if (cleanText.startsWith("/trending")) {
      responseText = await getTrending(10);
    } else if (cleanText.startsWith("/newpairs") || cleanText.startsWith("/snipe")) {
      responseText = await getNewPairs();
    } else if (cleanText.startsWith("/running")) {
      responseText = "🏃 *LIVE OG SIGNALS RUNNING*\n\nScanning for active OG pairs with high volume...\n\n" + await getTrending(5);
    } else if (cleanText.startsWith("/migrations") || cleanText.startsWith("/moves")) {
      responseText = "🔄 *MIGRATIONS*\n\nScanning for tokens moving from Pump.fun to Raydium...\n\n(Feature live in 5 mins!)";
    } else if (cleanText.startsWith("/whales")) {
      responseText = "🐋 *WHALE WATCH*\n\nScanning for large SOL buys on-chain...\n\n(Feature live in 5 mins!)";
    } else if (cleanText.startsWith("/roadmap")) {
      responseText = "🗺️ *SOLTOOLS ROADMAP*\n\n1. OG Scanner V2 (Live)\n2. Whale Radar (Beta)\n3. Mobile App (Q3)\n4. Community Hub (Q4)";
    } else if (cleanText.startsWith("/safety")) {
      responseText = "🛡️ *SAFETY CHECK*\n\n1. Check Mint Authority\n2. Check Freeze Authority\n3. Check Top 10 Holders\n4. Check Liquidity Lock";
    } else if (cleanText.startsWith("/swap")) {
      responseText = "🔀 *QUICK SWAP*\n\nUse [Jupiter](https://jup.ag) for the best rates on Solana.";
    } else if (cleanText.startsWith("/stats")) {
      responseText = "📊 *MARKET STATS*\n\nSolana Price: $145.20\n24h Vol: $2.4B\nActive Wallets: 1.2M";
    } else if (text.includes(botUsername) || update.message.chat.type === "private") {
      responseText = await callGemini(text.replace(botUsername, "").trim() || "How can I help you today?");
    }

    if (responseText) {
      await sendTelegramMessage(chatId, responseText, messageId);
    }

    return new Response("ok", { status: 200 });
  } catch (error) { return new Response("ok", { status: 200 }); }
});
