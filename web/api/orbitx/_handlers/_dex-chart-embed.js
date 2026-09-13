/**
 * High-quality DexScreener embed charts for OrbitX MCP chat.
 * Resolve CA / pair → best liquidity pair → markdown + embed URLs for Grok/Claude.
 */

const DEX_API = "https://api.dexscreener.com";
const ORBITX_HOST = "https://www.orbitx.world";

const CHAIN_ALIASES = {
  sol: "solana",
  solana: "solana",
  eth: "ethereum",
  ethereum: "ethereum",
  bsc: "bsc",
  base: "base",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  polygon: "polygon",
  avax: "avalanche",
  avalanche: "avalanche",
  sui: "sui",
  ton: "ton",
};

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "12h", "24h"];

function normalizeChain(raw) {
  const s = String(raw || "solana").trim().toLowerCase();
  return CHAIN_ALIASES[s] || s || "solana";
}

function isAddress(v) {
  const s = String(v || "").trim();
  // Solana base58 or EVM 0x
  if (/^0x[a-fA-F0-9]{40}$/.test(s)) return true;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return true;
  return false;
}

function fmtUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const x = Number(n);
  if (Math.abs(x) >= 1e9) return `$${(x / 1e9).toFixed(2)}B`;
  if (Math.abs(x) >= 1e6) return `$${(x / 1e6).toFixed(2)}M`;
  if (Math.abs(x) >= 1e3) return `$${(x / 1e3).toFixed(1)}K`;
  if (Math.abs(x) >= 1) return `$${x.toFixed(4)}`;
  if (Math.abs(x) >= 0.0001) return `$${x.toFixed(6)}`;
  return `$${x.toExponential(2)}`;
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const x = Number(n);
  const sign = x > 0 ? "+" : "";
  return `${sign}${x.toFixed(2)}%`;
}

function pickBestPair(pairs, preferChain) {
  const list = Array.isArray(pairs) ? pairs.filter(Boolean) : [];
  if (!list.length) return null;
  const scored = [...list].sort((a, b) => {
    const chainBoost = (p) =>
      preferChain && String(p.chainId || "").toLowerCase() === preferChain ? 1e15 : 0;
    const liq = (p) => Number(p.liquidity?.usd) || 0;
    const vol = (p) => Number(p.volume?.h24) || 0;
    return chainBoost(b) + liq(b) + vol(b) * 0.1 - (chainBoost(a) + liq(a) + vol(a) * 0.1);
  });
  return scored[0];
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * Resolve mint CA or pair address to DexScreener pairs.
 */
export async function resolveDexPairs(ca, { chain = "solana" } = {}) {
  const address = String(ca || "").trim();
  if (!isAddress(address)) {
    return { ok: false, error: "invalid_ca", message: "Pass a token CA (mint) or pair address." };
  }
  const preferChain = normalizeChain(chain);

  // 1) Token endpoint (mint → pairs)
  let data =
    (await fetchJson(`${DEX_API}/latest/dex/tokens/${encodeURIComponent(address)}`)) ||
    (await fetchJson(`${DEX_API}/tokens/v1/${preferChain}/${encodeURIComponent(address)}`));

  let pairs = data?.pairs || (Array.isArray(data) ? data : []);

  // 2) Pair-by-address
  if (!pairs.length) {
    const byPair = await fetchJson(
      `${DEX_API}/latest/dex/pairs/${preferChain}/${encodeURIComponent(address)}`,
    );
    if (byPair?.pair) pairs = [byPair.pair];
    else if (Array.isArray(byPair?.pairs)) pairs = byPair.pairs;
  }

  // 3) Search fallback
  if (!pairs.length) {
    const search = await fetchJson(`${DEX_API}/latest/dex/search?q=${encodeURIComponent(address)}`);
    pairs = Array.isArray(search?.pairs) ? search.pairs : [];
  }

  if (!pairs.length) {
    return {
      ok: false,
      error: "not_found",
      message: `No DexScreener pairs for ${address}. Token may be too new or unindexed.`,
      ca: address,
      chain: preferChain,
    };
  }

  const best = pickBestPair(pairs, preferChain);
  const alts = [...pairs]
    .sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))
    .slice(0, 5);

  return { ok: true, ca: address, chain: preferChain, best, pairs: alts };
}

function embedUrl(pair, { theme = "dark", trades = false, info = false, interval = "15m" } = {}) {
  const chainId = String(pair.chainId || "solana");
  const pairAddress = String(pair.pairAddress || "");
  const params = new URLSearchParams({
    embed: "1",
    theme: theme === "light" ? "light" : "dark",
    trades: trades ? "1" : "0",
    info: info ? "1" : "0",
  });
  if (interval && INTERVALS.includes(String(interval))) {
    params.set("interval", String(interval));
  }
  return `https://dexscreener.com/${chainId}/${pairAddress}?${params.toString()}`;
}

function pageUrl(pair) {
  return (
    pair.url ||
    `https://dexscreener.com/${pair.chainId || "solana"}/${pair.pairAddress}`
  );
}

function tokenLogo(pair, mint) {
  return (
    pair?.info?.imageUrl ||
    pair?.baseToken?.imageUrl ||
    (mint ? `https://dd.dexscreener.com/ds-data/tokens/${pair?.chainId || "solana"}/${mint}.png` : null)
  );
}

function mapPairSummary(pair) {
  const mint = pair.baseToken?.address || null;
  return {
    chainId: pair.chainId,
    dexId: pair.dexId,
    pairAddress: pair.pairAddress,
    mint,
    symbol: pair.baseToken?.symbol || "???",
    name: pair.baseToken?.name || "Unknown",
    quote: pair.quoteToken?.symbol || "SOL",
    priceUsd: pair.priceUsd != null ? Number(pair.priceUsd) : null,
    change5m: pair.priceChange?.m5 ?? null,
    change1h: pair.priceChange?.h1 ?? null,
    change6h: pair.priceChange?.h6 ?? null,
    change24h: pair.priceChange?.h24 ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    volume24h: pair.volume?.h24 ?? null,
    marketCap: pair.marketCap ?? pair.fdv ?? null,
    fdv: pair.fdv ?? null,
    txns24h: {
      buys: pair.txns?.h24?.buys ?? null,
      sells: pair.txns?.h24?.sells ?? null,
    },
    logoUrl: tokenLogo(pair, mint),
    pageUrl: pageUrl(pair),
    embedUrl: embedUrl(pair),
    embedUrlTrades: embedUrl(pair, { trades: true, info: true }),
  };
}

function buildChartMarkdown(summary, { interval = "15m", showIframe = true, alts = [] } = {}) {
  const chg = summary.change24h;
  const chgEmoji = chg == null ? "·" : chg >= 0 ? "▲" : "▼";
  const logo = summary.logoUrl
    ? `![$${summary.symbol}](${summary.logoUrl})`
    : "";
  const embed = embedUrl(
    { chainId: summary.chainId, pairAddress: summary.pairAddress },
    { interval, trades: false, info: false },
  );
  const embedFull = summary.embedUrlTrades;
  const lines = [
    logo,
    ``,
    `# $${summary.symbol} · ${summary.name}`,
    `**DexScreener live chart** · ${summary.chainId}/${summary.dexId || "dex"}`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Price | ${fmtUsd(summary.priceUsd)} |`,
    `| 5m / 1h / 6h / 24h | ${fmtPct(summary.change5m)} · ${fmtPct(summary.change1h)} · ${fmtPct(summary.change6h)} · ${chgEmoji} ${fmtPct(chg)} |`,
    `| Liquidity | ${fmtUsd(summary.liquidityUsd)} |`,
    `| Volume 24h | ${fmtUsd(summary.volume24h)} |`,
    `| Market cap | ${fmtUsd(summary.marketCap)} |`,
    `| Pair | \`${summary.pairAddress}\` |`,
    `| CA | \`${summary.mint || "—"}\` |`,
    ``,
    `### 📊 Live chart`,
    `[**Open DexScreener chart (embed)**](${embed})`,
    ``,
    `[Full chart + trades](${embedFull}) · [DexScreener page](${summary.pageUrl})`,
    ``,
  ];

  if (showIframe) {
    lines.push(
      `<!-- DexScreener embed — paste/open in clients that render HTML iframes -->`,
      `<iframe src="${embed}" title="$${summary.symbol} DexScreener chart" width="100%" height="480" style="border:0;border-radius:12px;min-height:420px;background:#0b0e11" allow="clipboard-write" allowfullscreen></iframe>`,
      ``,
    );
  }

  // Interval quick links
  lines.push(`**Intervals:** ` + INTERVALS.map((iv) => {
    const u = embedUrl(
      { chainId: summary.chainId, pairAddress: summary.pairAddress },
      { interval: iv },
    );
    return `[${iv}](${u})`;
  }).join(" · "));
  lines.push(``);

  if (summary.mint) {
    lines.push(
      `**Trade on OrbitX** · [DEX](${ORBITX_HOST}/ORBITX_DEX/token/${summary.mint}) · [Intel](${ORBITX_HOST}/intel)`,
      ``,
    );
  }

  if (alts.length > 1) {
    lines.push(`### Other pools`);
    for (const p of alts.slice(1, 4)) {
      const s = mapPairSummary(p);
      lines.push(
        `- **${s.dexId}** · liq ${fmtUsd(s.liquidityUsd)} · [chart](${s.embedUrl}) · \`${s.pairAddress.slice(0, 6)}…\``,
      );
    }
    lines.push(``);
  }

  lines.push(
    `_Show this markdown in chat (links + iframe). Call \`orbitx_dex_chart\` again with interval=1h|4h|24h for another timeframe._`,
  );

  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

/**
 * MCP tool handler — returns markdown embed payload for chat.
 */
export async function buildDexChartEmbed(args = {}) {
  const ca = String(args.ca || args.mint || args.address || args.pair || args.q || "").trim();
  const chain = normalizeChain(args.chain || "solana");
  const interval = INTERVALS.includes(String(args.interval || ""))
    ? String(args.interval)
    : "15m";
  const theme = String(args.theme || "dark").toLowerCase() === "light" ? "light" : "dark";
  const showIframe = args.iframe !== false && args.showIframe !== false;

  const resolved = await resolveDexPairs(ca, { chain });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      message: resolved.message,
      ca,
      chain,
      tip: "Pass a Solana mint CA (or EVM token address). Example: orbitx_dex_chart with ca=<mint>",
    };
  }

  const summary = mapPairSummary(resolved.best);
  // Re-build embed with requested theme/interval
  summary.embedUrl = embedUrl(resolved.best, { theme, interval, trades: false, info: false });
  summary.embedUrlTrades = embedUrl(resolved.best, { theme, interval, trades: true, info: true });

  const markdown = buildChartMarkdown(summary, {
    interval,
    showIframe,
    alts: resolved.pairs,
  });

  return {
    ok: true,
    __mcpFormat: "markdown",
    markdown,
    action: "dex_chart_embed",
    ca: resolved.ca,
    chain: summary.chainId,
    symbol: summary.symbol,
    name: summary.name,
    mint: summary.mint,
    pairAddress: summary.pairAddress,
    priceUsd: summary.priceUsd,
    change24h: summary.change24h,
    liquidityUsd: summary.liquidityUsd,
    volume24h: summary.volume24h,
    marketCap: summary.marketCap,
    logoUrl: summary.logoUrl,
    embedUrl: summary.embedUrl,
    embedUrlTrades: summary.embedUrlTrades,
    pageUrl: summary.pageUrl,
    orbitxDex: summary.mint
      ? `${ORBITX_HOST}/ORBITX_DEX/token/${summary.mint}`
      : `${ORBITX_HOST}/ORBITX_DEX`,
    interval,
    theme,
    instructions: [
      "Render the markdown in chat so the user sees stats + chart links.",
      "Prefer opening embedUrl — DexScreener live chart (theme dark).",
      "If the chat UI supports HTML, the iframe block shows an in-chat chart.",
    ],
  };
}
