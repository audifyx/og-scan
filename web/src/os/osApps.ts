/**
 * OrbitX OS — external app catalog, in-OS browser helpers, token search.
 * Everything here is public web data (DexScreener public API, DevMarket
 * public listings feed) — no keys, no auth.
 */

export interface ExternalAppDef {
  key: string;
  name: string;
  caption: string;
  href: string;
  iconBg: string;
  glyph: string;
}

/** Crypto + social apps installable from the OrbitX App Store. */
export const EXTERNAL_APPS: ExternalAppDef[] = [
  { key: "ext-axiom", name: "Axiom", caption: "Pro Solana trading terminal", href: "https://axiom.trade", iconBg: "linear-gradient(145deg,#7c6cff,#3b2fd6)", glyph: "A" },
  { key: "ext-x", name: "X", caption: "Crypto Twitter, in the OS", href: "https://x.com", iconBg: "linear-gradient(145deg,#222,#000)", glyph: "𝕏" },
  { key: "ext-telegram", name: "Telegram", caption: "Chats, groups, OrbitX community", href: "https://web.telegram.org", iconBg: "linear-gradient(145deg,#5ab8f5,#1d8fd6)", glyph: "✈" },
  { key: "ext-dexscreener", name: "DexScreener", caption: "Pairs, charts, new tokens", href: "https://dexscreener.com", iconBg: "linear-gradient(145deg,#2dd4bf,#0e7490)", glyph: "D" },
  { key: "ext-jupiter", name: "Jupiter", caption: "Solana's swap aggregator", href: "https://jup.ag", iconBg: "linear-gradient(145deg,#a3e635,#15803d)", glyph: "J" },
  { key: "ext-pumpfun", name: "Pump.fun", caption: "Meme coin launchpad", href: "https://pump.fun", iconBg: "linear-gradient(145deg,#facc15,#a16207)", glyph: "P" },
  { key: "ext-birdeye", name: "Birdeye", caption: "Solana data + trader tracking", href: "https://birdeye.so", iconBg: "linear-gradient(145deg,#60a5fa,#1e40af)", glyph: "B" },
  { key: "ext-solscan", name: "Solscan", caption: "Solana explorer", href: "https://solscan.io", iconBg: "linear-gradient(145deg,#c084fc,#6b21a8)", glyph: "S" },
  { key: "ext-magiceden", name: "Magic Eden", caption: "NFT marketplace", href: "https://magiceden.io", iconBg: "linear-gradient(145deg,#f472b6,#9d174d)", glyph: "M" },
  { key: "ext-coingecko", name: "CoinGecko", caption: "Prices, markets, portfolios", href: "https://coingecko.com", iconBg: "linear-gradient(145deg,#34d399,#065f46)", glyph: "C" },
  { key: "ext-tradingview", name: "TradingView", caption: "Charts for every market", href: "https://tradingview.com", iconBg: "linear-gradient(145deg,#38bdf8,#0c4a6e)", glyph: "T" },
  { key: "ext-hyperliquid", name: "Hyperliquid", caption: "On-chain perps", href: "https://app.hyperliquid.xyz", iconBg: "linear-gradient(145deg,#a7f3d0,#0f766e)", glyph: "H" },
];

/**
 * Hosts that refuse to render inside an iframe (X-Frame-Options / CSP
 * frame-ancestors). The Browser shows an "open in a new tab" card for
 * these instead of a blank frame — never a silent dead embed.
 */
export const BLOCKED_FRAME_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "discord.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "whatsapp.com",
  "netflix.com",
]);

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isBlockedFrame(url: string): boolean {
  const h = hostOf(url);
  return [...BLOCKED_FRAME_HOSTS].some((b) => h === b || h.endsWith(`.${b}`));
}

/** Normalize what the user typed in the address bar into a full URL. */
export function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export interface TokenSearchRow {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
}

/** DexScreener public search — no key. Dedupes by mint, best pair first. */
export async function searchTokens(q: string): Promise<TokenSearchRow[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const seen = new Set<string>();
    const out: TokenSearchRow[] = [];
    for (const p of pairs) {
      const mint = p?.baseToken?.address as string | undefined;
      if (!mint || seen.has(mint)) continue;
      seen.add(mint);
      out.push({
        mint,
        symbol: (p.baseToken.symbol as string) || "?",
        name: (p.baseToken.name as string) || mint.slice(0, 8),
        priceUsd: p?.priceUsd != null ? Number(p.priceUsd) : null,
      });
      if (out.length >= 6) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** Current USD price for one mint (DexScreener public tokens endpoint). */
export async function fetchTokenPrice(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const first = pairs.find((p: any) => p?.priceUsd != null);
    return first ? Number(first.priceUsd) : null;
  } catch {
    return null;
  }
}

export interface DevMarketListing {
  name: string;
  tagline: string;
  url: string;
  icon?: string;
  tags: string[];
  type: string;
  author: string;
}

const DEVMARKET_LISTINGS_URL =
  "https://devmarket-audifyxbeta-4145s-projects.vercel.app/api/listings?limit=200";

/** Public DevMarket feed. Returns [] on any failure — the Store still works. */
export async function fetchDevMarketListings(): Promise<DevMarketListing[]> {
  try {
    const res = await fetch(DEVMARKET_LISTINGS_URL);
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data?.items ?? data?.listings ?? []);
    if (!Array.isArray(items)) return [];
    return items
      .filter((l: any) => l && typeof l.name === "string" && typeof l.url === "string")
      .filter((l: any) => l.type === "app" || l.type === "website")
      .slice(0, 60)
      .map((l: any) => ({
        name: l.name,
        tagline: l.tagline ?? "",
        url: l.url,
        icon: l.icon,
        tags: Array.isArray(l.tags) ? l.tags : [],
        type: l.type,
        author: l.author ?? "Anonymous",
      }));
  } catch {
    return [];
  }
}
