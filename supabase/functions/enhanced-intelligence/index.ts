import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// ── Config ──────────────────────────────────────────────────────────────────
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_API_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
const MODEL = Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const BIRDEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") || "";
const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── HTTP helpers (with timeout) ──────────────────────────────────────────────
async function fetchJson(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) return null;
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((s || "").trim());
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));

// ── Data sources ─────────────────────────────────────────────────────────────
async function dexByMint(mint: string) {
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  const pairs = (d?.pairs || []).filter((p: any) => p?.chainId === "solana" || !p?.chainId);
  if (!pairs.length) return null;
  const top = pairs.slice().sort((a: any, b: any) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
  const shaped = shapeDexPair(top, pairs.length);
  if (shaped) {
    // Aggregate across ALL pairs for true totals (single-pair values are misleading for multi-pair tokens)
    shaped.liquidityUsd = pairs.reduce((acc: number, p: any) => acc + (p?.liquidity?.usd || 0), 0);
    shaped.volume24h = pairs.reduce((acc: number, p: any) => acc + (p?.volume?.h24 || 0), 0);
  }
  return shaped;
}
async function dexSearch(q: string) {
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
  const pairs = (d?.pairs || []).filter((p: any) => p?.chainId === "solana");
  if (!pairs.length) return null;
  const top = pairs.slice().sort((a: any, b: any) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
  return shapeDexPair(top, pairs.length);
}
async function dexFindMint(q: string): Promise<string | null> {
  // Resolve a symbol/name to the canonical mint = the highest-24h-VOLUME Solana pair
  // (sorting by liquidity is gameable by scam pairs with fake liquidity).
  const d = await fetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`);
  const pairs = (d?.pairs || []).filter((p: any) => p?.chainId === "solana" && p?.baseToken?.address);
  if (!pairs.length) return null;
  pairs.sort((a: any, b: any) => (b?.volume?.h24 || 0) - (a?.volume?.h24 || 0));
  return pairs[0].baseToken.address;
}

function shapeDexPair(p: any, pairCount: number) {
  if (!p) return null;
  return {
    source: "dexscreener",
    mint: p.baseToken?.address,
    name: p.baseToken?.name,
    symbol: p.baseToken?.symbol,
    priceUsd: num(p.priceUsd),
    marketCap: num(p.marketCap),
    fdv: num(p.fdv),
    liquidityUsd: num(p.liquidity?.usd),
    volume24h: num(p.volume?.h24),
    priceChange: { m5: num(p.priceChange?.m5), h1: num(p.priceChange?.h1), h24: num(p.priceChange?.h24) },
    txns24h: p.txns?.h24 ? { buys: p.txns.h24.buys, sells: p.txns.h24.sells } : null,
    pairCreatedAt: p.pairCreatedAt || null,
    dex: p.dexId,
    pairCount,
    url: p.url,
  };
}

async function birdeyeOverview(mint: string) {
  if (!BIRDEYE_API_KEY) return null;
  const d = await fetchJson(
    `https://public-api.birdeye.so/defi/token_overview?address=${mint}`,
    { headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", accept: "application/json" } },
  );
  const r = d?.data;
  if (!r) return null;
  return {
    source: "birdeye",
    name: r.name,
    symbol: r.symbol,
    priceUsd: num(r.price),
    marketCap: num(r.marketCap ?? r.mc),
    liquidityUsd: num(r.liquidity),
    volume24h: num(r.v24hUSD),
    priceChange24h: num(r.priceChange24hPercent),
    holders: num(r.holder),
    supply: num(r.supply),
    decimals: num(r.decimals),
  };
}

async function birdeyeHolders(mint: string) {
  if (!BIRDEYE_API_KEY) return null;
  const d = await fetchJson(
    `https://public-api.birdeye.so/defi/v3/token/holder?address=${mint}&offset=0&limit=10`,
    { headers: { "X-API-KEY": BIRDEYE_API_KEY, "x-chain": "solana", accept: "application/json" } },
  );
  const items = d?.data?.items;
  if (!Array.isArray(items)) return null;
  return items.slice(0, 10).map((h: any) => ({ owner: h.owner, amount: num(h.ui_amount ?? h.amount), pct: num(h.percentage) }));
}

async function heliusAsset(mint: string) {
  if (!HELIUS_API_KEY) return null;
  const d = await fetchJson(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "getAsset", params: { id: mint } }),
  });
  const r = d?.result;
  if (!r) return null;
  return {
    source: "helius",
    name: r.content?.metadata?.name,
    symbol: r.content?.metadata?.symbol,
    supply: num(r.token_info?.supply),
    decimals: num(r.token_info?.decimals),
    priceUsd: num(r.token_info?.price_info?.price_per_token),
    image: r.content?.links?.image,
  };
}

async function jupiterPrice(mint: string) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (JUPITER_API_KEY) headers["x-api-key"] = JUPITER_API_KEY;
  // Jupiter Price API v3 (v2 was removed). Shape: { [mint]: { usdPrice, priceChange24h, decimals, liquidity } }
  const d = await fetchJson(`https://api.jup.ag/price/v3?ids=${mint}`, { headers })
    || await fetchJson(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { headers: { accept: "application/json" } });
  const p = d?.[mint];
  if (!p) return null;
  return {
    source: "jupiter",
    priceUsd: num(p.usdPrice),
    decimals: num(p.decimals),
  };
}

async function heliusWallet(address: string) {
  if (!HELIUS_API_KEY) return null;
  const [bal, txs] = await Promise.all([
    fetchJson(`https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${HELIUS_API_KEY}`),
    fetchJson(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=10`),
  ]);
  if (!bal && !txs) return null;
  return {
    source: "helius",
    solBalance: bal?.nativeBalance != null ? bal.nativeBalance / 1e9 : null,
    tokenCount: Array.isArray(bal?.tokens) ? bal.tokens.length : null,
    topTokens: Array.isArray(bal?.tokens)
      ? bal.tokens.slice(0, 8).map((t: any) => ({ mint: t.mint, amount: t.amount / Math.pow(10, t.decimals || 0) }))
      : null,
    recentTx: Array.isArray(txs)
      ? txs.slice(0, 10).map((t: any) => ({ type: t.type, source: t.source, ts: t.timestamp, desc: (t.description || "").slice(0, 140) }))
      : null,
  };
}

function mergeToken(parts: any[]) {
  const out: Record<string, any> = { sources: [] };
  for (const p of parts) {
    if (!p) continue;
    out.sources.push(p.source);
    for (const [k, v] of Object.entries(p)) {
      if (k === "source") continue;
      if (out[k] === undefined || out[k] === null || out[k] === "") out[k] = v;
    }
  }
  return out.sources.length ? out : null;
}

// ── Tool definitions exposed to the model ────────────────────────────────────
const TOOLS = [
  { name: "lookupToken", description: "Look up a Solana token's live market data (price, market cap, FDV, liquidity, 24h volume/price change, holders, supply) by mint address, symbol, or name. Aggregates DexScreener, Birdeye, Helius, Jupiter and the internal tokens DB.", parameters: { type: "object", properties: { query: { type: "string", description: "Mint address, symbol, or name" } }, required: ["query"] } },
  { name: "getTokenPrice", description: "Get the current USD price (and 24h change) of a Solana token quickly by mint, symbol, or name.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "getHolderData", description: "Get holder count and top holder distribution for a Solana token mint.", parameters: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] } },
  { name: "getTokenActivity", description: "Get recent trading activity for a Solana token: 24h volume, buys/sells, and price change across 5m/1h/24h.", parameters: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] } },
  { name: "getWalletData", description: "Get a Solana wallet's SOL balance, token holdings, and recent transactions.", parameters: { type: "object", properties: { address: { type: "string" } }, required: ["address"] } },
];

async function resolveToken(query: string, supabase: any) {
  // internal DB first (may carry extra fields), then external sources
  let dbRow: any = null;
  try {
    const { data } = await supabase
      .from("tokens")
      .select("mint,name,symbol,current_price,market_cap,holders_count,top_10_holders_pct")
      .or(`mint.eq.${query},name.ilike.%${query}%,symbol.ilike.%${query}%`)
      .limit(1)
      .maybeSingle();
    dbRow = data;
  } catch { /* ignore */ }

  let resolvedMint = isMint(query) ? query.trim() : dbRow?.mint || null;
  if (!resolvedMint) resolvedMint = await dexFindMint(query);
  const dex = resolvedMint ? await dexByMint(resolvedMint) : null;

  const [be, hx, jp] = await Promise.all([
    resolvedMint ? birdeyeOverview(resolvedMint) : Promise.resolve(null),
    resolvedMint ? heliusAsset(resolvedMint) : Promise.resolve(null),
    resolvedMint ? jupiterPrice(resolvedMint) : Promise.resolve(null),
  ]);

  const dbPart = dbRow
    ? { source: "internal-db", mint: dbRow.mint, name: dbRow.name, symbol: dbRow.symbol, priceUsd: num(dbRow.current_price), marketCap: num(dbRow.market_cap), holders: num(dbRow.holders_count), top10Pct: num(dbRow.top_10_holders_pct) }
    : null;

  const merged = mergeToken([jp, be, dex, hx, dbPart]);
  if (merged) {
    // Prefer Birdeye market cap; otherwise compute from authoritative price * UI supply.
    const price = num(jp?.priceUsd) ?? num(be?.priceUsd) ?? num(merged.priceUsd);
    const beMc = num(be?.marketCap);
    let uiSupply: number | null = null;
    if (num(be?.supply) != null) uiSupply = num(be?.supply);
    else if (num(hx?.supply) != null && num(hx?.decimals) != null) uiSupply = (num(hx?.supply) as number) / Math.pow(10, num(hx?.decimals) as number);
    const computedMc = price != null && uiSupply != null ? price * uiSupply : null;
    merged.marketCap = beMc ?? computedMc ?? num(merged.marketCap);
    if (price != null) merged.priceUsd = price;
    merged.circulatingSupply = uiSupply;
  }
  return { merged, mint: resolvedMint };
}

async function executeTool(toolName: string, params: any, supabase: any): Promise<string> {
  try {
    if (toolName === "lookupToken") {
      const { merged } = await resolveToken(String(params.query || ""), supabase);
      return JSON.stringify(merged || { error: "Token not found across DexScreener, Birdeye, Helius, Jupiter, or internal DB" });
    }

    if (toolName === "getTokenPrice") {
      const q = String(params.query || "");
      const mint = isMint(q) ? q : await dexFindMint(q);
      if (!mint) return JSON.stringify({ error: "Token not found" });
      const [jp, dex, be] = await Promise.all([jupiterPrice(mint), dexByMint(mint), birdeyeOverview(mint)]);
      const priceUsd = jp?.priceUsd ?? dex?.priceUsd ?? be?.priceUsd ?? null;
      if (priceUsd == null) return JSON.stringify({ error: "Price unavailable" });
      return JSON.stringify({ mint, priceUsd, priceChange24h: dex?.priceChange?.h24 ?? be?.priceChange24h ?? null, source: jp ? "jupiter" : dex ? "dexscreener" : "birdeye" });
    }

    if (toolName === "getHolderData") {
      const mint = String(params.mint || "");
      if (!isMint(mint)) return JSON.stringify({ error: "Valid mint address required" });
      let dbHolders: number | null = null, dbTop10: number | null = null;
      try {
        const { data } = await supabase.from("tokens").select("holders_count, top_10_holders_pct").eq("mint", mint).maybeSingle();
        if (data) { dbHolders = num(data.holders_count); dbTop10 = num(data.top_10_holders_pct); }
      } catch { /* ignore */ }
      const [be, holders] = await Promise.all([birdeyeOverview(mint), birdeyeHolders(mint)]);
      const count = dbHolders ?? be?.holders ?? null;
      if (count == null && (!holders || !holders.length)) {
        return JSON.stringify({ error: "Holder count unavailable (no indexed data; Birdeye quota may be exhausted)" });
      }
      return JSON.stringify({ mint, holders: count, top10Pct: dbTop10, topHolders: holders || null });
    }

    if (toolName === "getTokenActivity") {
      const mint = String(params.mint || "");
      if (!isMint(mint)) return JSON.stringify({ error: "Valid mint address required" });
      const dex = await dexByMint(mint);
      if (!dex) return JSON.stringify({ error: "Activity unavailable" });
      return JSON.stringify({ mint, volume24h: dex.volume24h, txns24h: dex.txns24h, priceChange: dex.priceChange, liquidityUsd: dex.liquidityUsd });
    }

    if (toolName === "getWalletData") {
      const addr = String(params.address || "");
      if (!isMint(addr)) return JSON.stringify({ error: "Valid wallet address required" });
      const w = await heliusWallet(addr);
      return JSON.stringify(w || { error: "Wallet data unavailable" });
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

async function callNvidia(payload: Record<string, unknown>) {
  const res = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, parsed, text };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!NVIDIA_API_KEY) return json({ error: "NVIDIA_API_KEY not configured" }, 500);

    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const { messages, context } = body || {};
    if (!messages || !Array.isArray(messages)) return json({ error: "messages required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const systemPrompt =
      `You are OG Scan's blockchain intelligence expert for Solana.\n` +
      `You have live data tools: lookupToken, getTokenPrice, getHolderData, getTokenActivity, getWalletData. ` +
      `ALWAYS call the relevant tool to fetch real, current on-chain/market data before answering — never guess prices, market caps, or holders. ` +
      `Use the fetched data to give clear, concise, data-backed analysis. If a tool returns an error, say what's missing.` +
      (context ? `\n\nContext:\n${context}` : "");

    const convo: any[] = [{ role: "system", content: systemPrompt }, ...messages];
    const toolsUsed: string[] = [];

    // Agentic loop: let the model call tools, feed results back, up to 4 rounds.
    let finalContent = "";
    for (let round = 0; round < 4; round++) {
      let result = await callNvidia({
        model: MODEL,
        messages: convo,
        tools: TOOLS.map((t) => ({ type: "function", function: t })),
        tool_choice: "auto",
        temperature: 0.6,
        max_tokens: 1200,
      });
      // Retry without tools if the endpoint rejects them
      if (!result.ok && round === 0) {
        result = await callNvidia({ model: MODEL, messages: convo, temperature: 0.6, max_tokens: 1200 });
      }
      if (!result.ok) {
        const msg = result.parsed?.error?.message || result.text || `NVIDIA error ${result.status}`;
        return json({ error: `Model error: ${msg}` }, 502);
      }

      const message = result.parsed?.choices?.[0]?.message;
      if (!message) return json({ error: "No response from model" }, 502);

      const toolCalls = message.tool_calls || [];
      if (!toolCalls.length) {
        finalContent = message.content || "";
        break;
      }

      // Execute tools and append results to the conversation
      convo.push({ role: "assistant", content: message.content || "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: any = {};
        try { args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments || "{}") : tc.function.arguments; } catch { /* ignore */ }
        toolsUsed.push(tc.function.name);
        const toolResult = await executeTool(tc.function.name, args, supabase);
        convo.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: toolResult });
      }
    }

    if (!finalContent) finalContent = "I gathered the data but couldn't compose a final answer. Please rephrase.";

    return json({
      content: finalContent,
      model: MODEL,
      modelsUsed: [MODEL],
      consensus: 0.85,
      toolsUsed: [...new Set(toolsUsed)],
    });
  } catch (error: any) {
    console.error("enhanced-intelligence error:", error);
    return json({ error: error?.message || "Internal server error" }, 500);
  }
});
