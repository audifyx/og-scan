/**
 * news-fetcher — Server-side RSS + crypto news aggregator.
 * Fetches 4 RSS feeds (CoinTelegraph, CoinDesk, Decrypt, The Block),
 * deduplicates, detects sentiment, and upserts to crypto_news table.
 * No CORS issues since it runs on the edge.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PER_FEED = 10;
const MAX_TOTAL = 40;

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ogscan.fun",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RSS_FEEDS = [
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss", category: "news" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "news" },
  { name: "Decrypt", url: "https://decrypt.co/feed", category: "news" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml", category: "news" },
];

// Keyword-based sentiment detection
const BULLISH_WORDS = ["surge", "rally", "bullish", "gain", "rise", "soar", "pump", "breakout", "ath", "all-time high", "recovery", "positive", "green", "up", "launch", "partnership", "adoption", "approve", "approval", "etf"];
const BEARISH_WORDS = ["crash", "dump", "drop", "fall", "decline", "bear", "sell", "plunge", "warning", "hack", "exploit", "scam", "fraud", "ban", "restrict", "lawsuit", "sec", "fine", "liquidation", "fear", "regulation"];

function detectSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const lower = text.toLowerCase();
  const bullishScore = BULLISH_WORDS.filter(w => lower.includes(w)).length;
  const bearishScore = BEARISH_WORDS.filter(w => lower.includes(w)).length;
  if (bullishScore > bearishScore + 1) return "bullish";
  if (bearishScore > bullishScore + 1) return "bearish";
  return "neutral";
}

function detectCoins(text: string): string[] {
  const coinPatterns = [
    /\$([A-Z]{2,10})\b/g,  // $BTC $ETH etc
    /\b(Bitcoin|Ethereum|Solana|BNB|XRP|Cardano|Avalanche|Polygon|Dogecoin|Shiba)\b/gi,
  ];
  const found = new Set<string>();
  for (const pattern of coinPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      found.add((match[1] || match[0]).toUpperCase().replace("$", ""));
    }
  }
  return [...found].slice(0, 5);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(name: string, url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OGScan/1.0 RSS Reader", "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML item parser
    const items: any[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
    for (const match of itemMatches) {
      const itemXml = match[1];
      const getTag = (tag: string) => {
        const m = itemXml.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, "i"))
          || itemXml.match(new RegExp(`<${tag}[^/]*/>`));
        if (!m) return "";
        const raw = m[1] || "";
        return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      };

      const title = stripHtml(getTag("title") || "").slice(0, 200);
      const link = (getTag("link") || "").trim();
      const description = stripHtml(getTag("description") || getTag("content:encoded") || "").slice(0, 500);
      const pubDate = getTag("pubDate") || getTag("dc:date") || "";
      const imageMatch = itemXml.match(/<media:content[^>]+url="([^"]+)"/)
        || itemXml.match(/<enclosure[^>]+url="([^"]+)"/);
      const imageUrl = imageMatch ? imageMatch[1] : null;

      if (!title || !link) continue;

      const fullText = `${title} ${description}`;
      const sentiment = detectSentiment(fullText);
      const coins = detectCoins(fullText);

      let publishedAt: string;
      try {
        publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      } catch {
        publishedAt = new Date().toISOString();
      }

      items.push({
        title,
        description: description.slice(0, 300) || null,
        source: name,
        source_url: link,
        image_url: imageUrl,
        category: "news",
        sentiment,
        coins: coins.length > 0 ? coins : null,
        is_featured: sentiment !== "neutral" && title.length > 40,
        published_at: publishedAt,
        engagement_score: Math.floor(Math.random() * 50 + 10), // placeholder until real engagement data
      });

      if (items.length >= MAX_PER_FEED) break;
    }
    console.log(`[news-fetcher] ${name}: fetched ${items.length} items`);
    return items;
  } catch (e) {
    console.error(`[news-fetcher] ${name} error:`, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all feeds in parallel
    const results = await Promise.all(
      RSS_FEEDS.map(f => fetchFeed(f.name, f.url))
    );

    const allItems = results.flat();

    // Deduplicate by title (first 80 chars)
    const seen = new Set<string>();
    const deduped = allItems
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
      .filter(item => {
        const key = item.title.toLowerCase().slice(0, 80);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_TOTAL);

    if (deduped.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No items fetched from any feed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Upsert to crypto_news (source_url as conflict key)
    const { data, error } = await supabase
      .from("crypto_news")
      .upsert(deduped, {
        onConflict: "source_url",
        ignoreDuplicates: false,
      })
      .select("id");

    if (error) {
      console.error("[news-fetcher] Upsert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Prune old news (keep last 200 rows)
    try { await supabase.rpc("prune_old_news"); } catch (_) { /* ok */ }

    return new Response(
      JSON.stringify({ success: true, fetched: allItems.length, upserted: deduped.length, saved: data?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[news-fetcher] Fatal error:", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
