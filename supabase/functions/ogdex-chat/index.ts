// ogdex-chat — the per-coin AI. Each token page gets a conversational agent that
// "is" that coin: it answers using the on-chain DATA passed in (price, holders,
// dev/creator, first buyer, dex-paid status, safety) AND live web search results
// (why it's trending / what people are saying). Gemini Google-Search grounding
// is tried first; otherwise we feed DuckDuckGo results to NVIDIA Llama.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_BASE_URL = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Msg = { role: "user" | "assistant"; content: string };
type WebResult = { title: string; snippet: string; url: string };

function decodeDdg(href: string): string {
  try {
    const m = href.match(/uddg=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch { /* noop */ }
  return href;
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

// Live web search via DuckDuckGo HTML (no API key required).
async function webSearch(query: string, limit = 6): Promise<WebResult[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: WebResult[] = [];
    const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    const snipRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const snippets: string[] = [];
    let sm: RegExpExecArray | null;
    while ((sm = snipRe.exec(html)) !== null) snippets.push(stripTags(sm[1]));
    let lm: RegExpExecArray | null; let i = 0;
    while ((lm = linkRe.exec(html)) !== null && out.length < limit) {
      out.push({ title: stripTags(lm[2]), url: decodeDdg(lm[1]), snippet: snippets[i] || "" });
      i++;
    }
    return out;
  } catch { return []; }
}

function systemPrompt(sym: string, name: string, mint: string, ctx: any, web: WebResult[]): string {
  const webBlock = web.length
    ? web.map((w, i) => `[${i + 1}] ${w.title}\n${w.snippet}\n(${w.url})`).join("\n\n")
    : "(no web results returned)";
  return [
    `You ARE ${sym}${name && name !== sym ? ` (${name})` : ""}, a Solana token. You are this coin's own AI analyst on OG DEX.`,
    `Speak in first person about the token when natural ("my liquidity", "my holders") but stay factual and useful.`,
    `Mint: ${mint}`,
    ``,
    `CRITICAL: The "LIVE ON-CHAIN DATA" JSON below was fetched moments ago from our full data stack — Jupiter, Birdeye, GeckoTerminal, DexScreener, Rugcheck and Helius. It is CURRENT and COMPLETE. It contains, in this object:`,
    `- market: price, market cap, FDV, liquidity, 24h volume, supply, % changes (5m/1h/6h/24h), organic score, verdict`,
    `- microstructure: buy vs sell volume, buy/sell counts, traders, net buyers, holder/liquidity/volume change`,
    `- holdersInfo: total holders, top-25 holders (wallet, %, label, KOL name, public label like exchange/AMM), whale count, KOL holders`,
    `- recentTrades: latest swaps (side, USD, wallet, KOL, dex, tx hash)`,
    `- pairs: DEX pools with liquidity/volume`,
    `- security: mint/freeze renounced, LP locked %, LP pulled, rugged, risk score, risk list`,
    `- origin + forensics: dev/creator wallet, whether dev sold, tokens created, first buyer (wallet, tx hash, amount), DexScreener paid status, launchpad, bonding status`,
    `- socials: official links`,
    `Use this data directly and confidently. NEVER say you "don't have access" or "can't pull" something that is present in the JSON — read it and answer with the exact numbers, wallets and tx hashes. Only say a value is unavailable if it is genuinely null/missing in the JSON.`,
    ``,
    `ALL-TIME HIGH: use market.ath — if it is an object with athMcap/athPrice, report those exact figures (and the % down from ATH and date if present). Only if market.ath is the string "coming soon" should you say ATH is coming soon. Never invent an ATH.`,
    ``,
    `For market narrative, news, sentiment and "what are people saying / why is it trending", use the LIVE WEB SEARCH RESULTS and cite them inline like [1], [2].`,
    `Be concise and skimmable: short paragraphs or tight bullets. No financial advice; flag risks honestly. Round large numbers sensibly (e.g. $1.2M, 12.3%).`,
    `When you reference a wallet or a transaction, include its clickable Solscan link so the user does not have to search: wallets as https://solscan.io/account/<address> and transactions as https://solscan.io/tx/<signature>. Use the exact addresses/signatures from the data.`,
    ``,
    `=== LIVE ON-CHAIN DATA (JSON) ===`,
    JSON.stringify(ctx ?? {}, null, 0),
    ``,
    `=== LIVE WEB SEARCH RESULTS ===`,
    webBlock,
  ].join("\n");
}

async function callNvidia(sys: string, messages: Msg[], web: WebResult[]) {
  if (!NVIDIA_API_KEY) throw new Error("no nvidia key");
  const r = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [{ role: "system", content: sys }, ...messages.map((m) => ({ role: m.role, content: String(m.content || "") }))],
      temperature: 0.6, max_tokens: 1100,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`nvidia ${r.status}`);
  const text = j?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("nvidia empty");
  const sources = web.map((w) => ({ title: w.title, url: w.url })).slice(0, 6);
  return { answer: text, sources, provider: "nvidia" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const mint = String(body.mint || "");
    const sym = String(body.symbol || "this token");
    const name = String(body.name || "");
    const ctx = body.context || {};
    const messages: Msg[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12);
    if (!mint) return json({ ok: false, error: "mint required" }, 400);
    if (!messages.length) return json({ ok: false, error: "messages required" }, 400);

    // Live web search seeded from the coin identity + the latest user question.
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const idQuery = [sym, name && name !== sym ? name : "", "crypto token"].filter(Boolean).join(" ");
    const [wA, wB] = await Promise.all([
      webSearch(`${idQuery} trending news`, 5),
      lastUser ? webSearch(`${sym} ${name} ${lastUser}`.slice(0, 180), 4) : Promise.resolve([]),
    ]);
    const seen = new Set<string>();
    const web = [...wA, ...wB].filter((w) => w.url && !seen.has(w.url) && seen.add(w.url)).slice(0, 8);

    const sys = systemPrompt(sym, name, mint, ctx, web);
    try {
      const out = await callNvidia(sys, messages, web);
      return json({ ok: true, ...out });
    } catch (e) {
      return json({ ok: false, error: `AI unavailable: ${String((e as Error)?.message || e)}` });
    }
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
