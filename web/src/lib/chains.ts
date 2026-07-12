/**
 * chains.ts — Multi-chain registry for OrbitX.
 *
 * All supported EVM chains + Solana in one place.
 * DexScreener chainId slugs are used as the canonical identifier.
 * Etherscan V2 chainIds are numeric and used for the unified API.
 */

export interface ChainConfig {
  /** DexScreener slug — used as the primary key everywhere */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short label for tight UI */
  shortName: string;
  /** Etherscan V2 numeric chain ID (undefined for non-EVM like Solana) */
  etherscanChainId?: number;
  /** Native currency symbol */
  nativeCurrency: string;
  /** Chain logo emoji (fallback when no image) */
  emoji: string;
  /** Color used in UI gradients */
  color: string;
  /** Tailwind border/bg accent */
  accent: string;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Whether this chain is EVM-compatible */
  isEvm: boolean;
  /** Popular DEX on this chain */
  mainDex: string;
  /** DEX URL for swap links */
  dexUrl: string;
  /** DexScreener network slug (sometimes differs from id) */
  dexScreenerSlug: string;
  /** GeckoTerminal network slug */
  geckoTerminalSlug?: string;
  /** Category for grouping in UI */
  category: "l1" | "l2" | "sidechain";
  /** Popular launchpads / token factories on this chain */
  launchpads?: { id: string; name: string; emoji: string; description: string; searchTerms: string[]; website?: string }[];
}

/**
 * ETHERSCAN_API_KEY — Free tier, works across all V2-supported chains.
 * 5 req/s, 100k req/day.
 */
export const ETHERSCAN_API_KEY = import.meta.env.VITE_ETHERSCAN_API_KEY ?? "";
export const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";

/** All supported chains — Solana first (existing), then EVM by popularity */
export const SUPPORTED_CHAINS: ChainConfig[] = [
  // ─── Existing: Solana ───
  {
    id: "solana",
    name: "Solana",
    shortName: "SOL",
    nativeCurrency: "SOL",
    emoji: "◎",
    color: "from-[#9945FF]/20 to-[#14F195]/20",
    accent: "border-[#9945FF]/30 bg-[#9945FF]/10 text-[#14F195]",
    explorerUrl: "https://solscan.io",
    isEvm: false,
    mainDex: "Jupiter",
    dexUrl: "https://jup.ag/swap",
    dexScreenerSlug: "solana",
    geckoTerminalSlug: "solana",
    category: "l1",
    launchpads: [
      { id: "pumpfun", name: "Pump.fun", emoji: "🎪", description: "Bonding curve meme launcher", searchTerms: ["pump", "pumpfun"], website: "https://pump.fun" },
      { id: "moonshot", name: "Moonshot", emoji: "🌙", description: "Mobile-first token launcher", searchTerms: ["moonshot"], website: "https://moonshot.money" },
      { id: "believe", name: "Believe", emoji: "✨", description: "Creator coin platform", searchTerms: ["believe", "launchcoin", "printrr"], website: "https://believe.app" },
      { id: "raydium", name: "Raydium", emoji: "⚡", description: "Solana's leading AMM DEX", searchTerms: ["raydium"], website: "https://raydium.io" },
      { id: "meteora", name: "Meteora", emoji: "☄️", description: "Dynamic liquidity protocol", searchTerms: ["meteora"], website: "https://meteora.ag" },
    ],
  },
  // ─── EVM L1s ───
  {
    id: "ethereum",
    name: "Ethereum",
    shortName: "ETH",
    etherscanChainId: 1,
    nativeCurrency: "ETH",
    emoji: "⟠",
    color: "from-[#627EEA]/20 to-[#627EEA]/5",
    accent: "border-[#627EEA]/30 bg-[#627EEA]/10 text-[#627EEA]",
    explorerUrl: "https://etherscan.io",
    isEvm: true,
    mainDex: "Uniswap",
    dexUrl: "https://app.uniswap.org/swap",
    dexScreenerSlug: "ethereum",
    geckoTerminalSlug: "eth",
    category: "l1",
    launchpads: [
      { id: "uniswap", name: "Uniswap", emoji: "🦄", description: "Largest Ethereum DEX", searchTerms: ["uniswap"], website: "https://uniswap.org" },
      { id: "ethervista", name: "EtherVista", emoji: "👁️", description: "ETH token launcher", searchTerms: ["ethervista", "vista"], website: "https://ethervista.com" },
    ],
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    shortName: "BSC",
    etherscanChainId: 56,
    nativeCurrency: "BNB",
    emoji: "🔶",
    color: "from-[#F3BA2F]/20 to-[#F3BA2F]/5",
    accent: "border-[#F3BA2F]/30 bg-[#F3BA2F]/10 text-[#F3BA2F]",
    explorerUrl: "https://bscscan.com",
    isEvm: true,
    mainDex: "PancakeSwap",
    dexUrl: "https://pancakeswap.finance/swap",
    dexScreenerSlug: "bsc",
    geckoTerminalSlug: "bsc",
    category: "l1",
    launchpads: [
      { id: "pancakeswap", name: "PancakeSwap", emoji: "🥞", description: "BSC's top DEX", searchTerms: ["pancakeswap", "pancake"], website: "https://pancakeswap.finance" },
      { id: "four-meme", name: "Four.Meme", emoji: "4️⃣", description: "BSC meme launcher", searchTerms: ["four.meme", "fourmeme"], website: "https://four.meme" },
    ],
  },
  {
    id: "avalanche",
    name: "Avalanche",
    shortName: "AVAX",
    etherscanChainId: 43114,
    nativeCurrency: "AVAX",
    emoji: "🔺",
    color: "from-[#E84142]/20 to-[#E84142]/5",
    accent: "border-[#E84142]/30 bg-[#E84142]/10 text-[#E84142]",
    explorerUrl: "https://snowscan.xyz",
    isEvm: true,
    mainDex: "Trader Joe",
    dexUrl: "https://traderjoexyz.com/avalanche/trade",
    dexScreenerSlug: "avalanche",
    geckoTerminalSlug: "avax",
    category: "l1",
    launchpads: [
      { id: "traderjoe", name: "Trader Joe", emoji: "🎩", description: "Avalanche's leading DEX", searchTerms: ["traderjoe", "trader joe"], website: "https://traderjoexyz.com" },
    ],
  },
  {
    id: "robinhood",
    name: "Robinhood Chain",
    shortName: "HOOD",
    // No etherscanChainId — Etherscan/GoPlus don't index this chain yet;
    // only Blockscout does. Security-check calls degrade gracefully to null.
    nativeCurrency: "ETH",
    emoji: "🪽",
    color: "from-[#00C805]/20 to-[#00C805]/5",
    accent: "border-[#00C805]/30 bg-[#00C805]/10 text-[#00C805]",
    explorerUrl: "https://robinhoodchain.blockscout.com",
    isEvm: true,
    mainDex: "Uniswap",
    dexUrl: "https://app.uniswap.org/swap",
    dexScreenerSlug: "robinhood",
    geckoTerminalSlug: "robinhood",
    category: "l2",
    launchpads: [
      { id: "noxafun", name: "NOXA Fun", emoji: "🐳", description: "Hybrid Uniswap V3 launchpad, permanently locked LP", searchTerms: ["noxa", "noxa.fun", "noxafun"], website: "https://fun.noxa.fi/robinhood" },
    ],
  },
  // ─── EVM L2s ───
  {
    id: "base",
    name: "Base",
    shortName: "BASE",
    etherscanChainId: 8453,
    nativeCurrency: "ETH",
    emoji: "🔵",
    color: "from-[#0052FF]/20 to-[#0052FF]/5",
    accent: "border-[#0052FF]/30 bg-[#0052FF]/10 text-[#0052FF]",
    explorerUrl: "https://basescan.org",
    isEvm: true,
    mainDex: "Aerodrome",
    dexUrl: "https://aerodrome.finance/swap",
    dexScreenerSlug: "base",
    geckoTerminalSlug: "base",
    category: "l2",
    launchpads: [
      { id: "aerodrome", name: "Aerodrome", emoji: "✈️", description: "Base's top DEX", searchTerms: ["aerodrome"], website: "https://aerodrome.finance" },
      { id: "virtuals", name: "Virtuals", emoji: "🤖", description: "AI agent token launcher", searchTerms: ["virtuals", "virtual"], website: "https://virtuals.io" },
      { id: "wow", name: "WOW.xyz", emoji: "🎉", description: "Base memecoin launcher", searchTerms: ["wow.xyz", "wow"], website: "https://wow.xyz" },
    ],
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    shortName: "ARB",
    etherscanChainId: 42161,
    nativeCurrency: "ETH",
    emoji: "🔷",
    color: "from-[#28A0F0]/20 to-[#28A0F0]/5",
    accent: "border-[#28A0F0]/30 bg-[#28A0F0]/10 text-[#28A0F0]",
    explorerUrl: "https://arbiscan.io",
    isEvm: true,
    mainDex: "Camelot",
    dexUrl: "https://app.camelot.exchange",
    dexScreenerSlug: "arbitrum",
    geckoTerminalSlug: "arbitrum",
    category: "l2",
    launchpads: [
      { id: "camelot", name: "Camelot", emoji: "⚔️", description: "Arbitrum-native DEX", searchTerms: ["camelot"], website: "https://camelot.exchange" },
    ],
  },
  {
    id: "polygon",
    name: "Polygon",
    shortName: "MATIC",
    etherscanChainId: 137,
    nativeCurrency: "POL",
    emoji: "💜",
    color: "from-[#8247E5]/20 to-[#8247E5]/5",
    accent: "border-[#8247E5]/30 bg-[#8247E5]/10 text-[#8247E5]",
    explorerUrl: "https://polygonscan.com",
    isEvm: true,
    mainDex: "QuickSwap",
    dexUrl: "https://quickswap.exchange/#/swap",
    dexScreenerSlug: "polygon",
    geckoTerminalSlug: "polygon_pos",
    category: "sidechain",
    launchpads: [
      { id: "quickswap", name: "QuickSwap", emoji: "⚡", description: "Polygon's top DEX", searchTerms: ["quickswap"], website: "https://quickswap.exchange" },
    ],
  },
  {
    id: "optimism",
    name: "Optimism",
    shortName: "OP",
    etherscanChainId: 10,
    nativeCurrency: "ETH",
    emoji: "🔴",
    color: "from-[#FF0420]/20 to-[#FF0420]/5",
    accent: "border-[#FF0420]/30 bg-[#FF0420]/10 text-[#FF0420]",
    explorerUrl: "https://optimistic.etherscan.io",
    isEvm: true,
    mainDex: "Velodrome",
    dexUrl: "https://velodrome.finance/swap",
    dexScreenerSlug: "optimism",
    geckoTerminalSlug: "optimism",
    category: "l2",
    launchpads: [
      { id: "velodrome", name: "Velodrome", emoji: "🚴", description: "Optimism's top DEX", searchTerms: ["velodrome"], website: "https://velodrome.finance" },
    ],
  },
  {
    id: "blast",
    name: "Blast",
    shortName: "BLAST",
    etherscanChainId: 81457,
    nativeCurrency: "ETH",
    emoji: "💥",
    color: "from-[#FCFC03]/20 to-[#FCFC03]/5",
    accent: "border-[#FCFC03]/30 bg-[#FCFC03]/10 text-[#FCFC03]",
    explorerUrl: "https://blastscan.io",
    isEvm: true,
    mainDex: "Thruster",
    dexUrl: "https://app.thruster.finance/swap",
    dexScreenerSlug: "blast",
    geckoTerminalSlug: "blast",
    category: "l2",
    launchpads: [
      { id: "thruster", name: "Thruster", emoji: "🚀", description: "Blast's leading DEX", searchTerms: ["thruster"], website: "https://thruster.finance" },
    ],
  },
  {
    id: "sonic",
    name: "Sonic",
    shortName: "SONIC",
    etherscanChainId: 146,
    nativeCurrency: "S",
    emoji: "🔊",
    color: "from-[#5B6EF5]/20 to-[#5B6EF5]/5",
    accent: "border-[#5B6EF5]/30 bg-[#5B6EF5]/10 text-[#5B6EF5]",
    explorerUrl: "https://sonicscan.org",
    isEvm: true,
    mainDex: "SpookySwap",
    dexUrl: "https://spooky.fi/#/swap",
    dexScreenerSlug: "sonic",
    geckoTerminalSlug: "sonic",
    category: "l1",
    launchpads: [],
  },
  {
    id: "berachain",
    name: "Berachain",
    shortName: "BERA",
    etherscanChainId: 80094,
    nativeCurrency: "BERA",
    emoji: "🐻",
    color: "from-[#794B29]/20 to-[#F6A627]/20",
    accent: "border-[#F6A627]/30 bg-[#794B29]/10 text-[#F6A627]",
    explorerUrl: "https://berascan.com",
    isEvm: true,
    mainDex: "Kodiak",
    dexUrl: "https://app.kodiak.finance",
    dexScreenerSlug: "berachain",
    geckoTerminalSlug: "berachain",
    category: "l1",
    launchpads: [
      { id: "kodiak", name: "Kodiak", emoji: "🐻", description: "Berachain's native DEX", searchTerms: ["kodiak"], website: "https://kodiak.finance" },
    ],
  },
  {
    id: "linea",
    name: "Linea",
    shortName: "LINEA",
    etherscanChainId: 59144,
    nativeCurrency: "ETH",
    emoji: "➖",
    color: "from-[#121212]/20 to-[#61DFFF]/20",
    accent: "border-[#61DFFF]/30 bg-[#61DFFF]/10 text-[#61DFFF]",
    explorerUrl: "https://lineascan.build",
    isEvm: true,
    mainDex: "SyncSwap",
    dexUrl: "https://syncswap.xyz",
    dexScreenerSlug: "linea",
    geckoTerminalSlug: "linea",
    category: "l2",
    launchpads: [],
  },
  {
    id: "scroll",
    name: "Scroll",
    shortName: "SCROLL",
    etherscanChainId: 534352,
    nativeCurrency: "ETH",
    emoji: "📜",
    color: "from-[#FFEEDA]/20 to-[#EBC28E]/10",
    accent: "border-[#EBC28E]/30 bg-[#EBC28E]/10 text-[#EBC28E]",
    explorerUrl: "https://scrollscan.com",
    isEvm: true,
    mainDex: "Ambient",
    dexUrl: "https://ambient.finance",
    dexScreenerSlug: "scroll",
    geckoTerminalSlug: "scroll",
    category: "l2",
    launchpads: [],
  },
  {
    id: "zksync",
    name: "zkSync Era",
    shortName: "ZK",
    etherscanChainId: 324,
    nativeCurrency: "ETH",
    emoji: "🔗",
    color: "from-[#8C8DFC]/20 to-[#8C8DFC]/5",
    accent: "border-[#8C8DFC]/30 bg-[#8C8DFC]/10 text-[#8C8DFC]",
    explorerUrl: "https://era.zksync.network",
    isEvm: true,
    mainDex: "SyncSwap",
    dexUrl: "https://syncswap.xyz",
    dexScreenerSlug: "zksync",
    geckoTerminalSlug: "zksync",
    category: "l2",
    launchpads: [],
  },
  {
    id: "mantle",
    name: "Mantle",
    shortName: "MNT",
    etherscanChainId: 5000,
    nativeCurrency: "MNT",
    emoji: "🟩",
    color: "from-[#000000]/20 to-[#65B3AE]/20",
    accent: "border-[#65B3AE]/30 bg-[#65B3AE]/10 text-[#65B3AE]",
    explorerUrl: "https://mantlescan.xyz",
    isEvm: true,
    mainDex: "Agni",
    dexUrl: "https://agni.finance",
    dexScreenerSlug: "mantle",
    geckoTerminalSlug: "mantle",
    category: "l2",
    launchpads: [],
  },
  {
    id: "celo",
    name: "Celo",
    shortName: "CELO",
    etherscanChainId: 42220,
    nativeCurrency: "CELO",
    emoji: "🌿",
    color: "from-[#FCFF52]/20 to-[#35D07F]/20",
    accent: "border-[#35D07F]/30 bg-[#35D07F]/10 text-[#35D07F]",
    explorerUrl: "https://celoscan.io",
    isEvm: true,
    mainDex: "Ubeswap",
    dexUrl: "https://ubeswap.org",
    dexScreenerSlug: "celo",
    geckoTerminalSlug: "celo",
    category: "l1",
    launchpads: [],
  },
  {
    id: "gnosis",
    name: "Gnosis Chain",
    shortName: "GNO",
    etherscanChainId: 100,
    nativeCurrency: "xDAI",
    emoji: "🦉",
    color: "from-[#04795B]/20 to-[#04795B]/5",
    accent: "border-[#04795B]/30 bg-[#04795B]/10 text-[#04795B]",
    explorerUrl: "https://gnosisscan.io",
    isEvm: true,
    mainDex: "SushiSwap",
    dexUrl: "https://www.sushi.com/swap",
    dexScreenerSlug: "gnosischain",
    geckoTerminalSlug: "xdai",
    category: "sidechain",
    launchpads: [],
  },
];

/** Quick lookup by DexScreener slug */
export const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map((c) => [c.id, c]));

/** Get chain config by id, fallback to Solana */
export function getChain(id: string): ChainConfig {
  return CHAIN_MAP.get(id) ?? SUPPORTED_CHAINS[0];
}

/** All chain IDs */
export const ALL_CHAIN_IDS = SUPPORTED_CHAINS.map((c) => c.id);

/** Helper: is this chain Solana? */
export function isSolana(chainId: string): boolean {
  return chainId === "solana";
}

/** Helper: get DexScreener token URL */
export function dexScreenerTokenUrl(chainId: string, address: string): string {
  const chain = getChain(chainId);
  return `https://dexscreener.com/${chain.dexScreenerSlug}/${address}`;
}

/** Helper: get block explorer address URL */
export function explorerAddressUrl(chainId: string, address: string): string {
  const chain = getChain(chainId);
  if (chain.id === "solana") return `${chain.explorerUrl}/account/${address}`;
  return `${chain.explorerUrl}/address/${address}`;
}

/** Helper: get block explorer tx URL */
export function explorerTxUrl(chainId: string, hash: string): string {
  const chain = getChain(chainId);
  if (chain.id === "solana") return `${chain.explorerUrl}/tx/${hash}`;
  return `${chain.explorerUrl}/tx/${hash}`;
}

/** Set of all supported DexScreener chain slugs for fast filtering */
export const SUPPORTED_DEX_SLUGS = new Set(SUPPORTED_CHAINS.map((c) => c.dexScreenerSlug));

/** Resolve a DexScreener chainId slug to our chain config (if supported) */
export function chainFromDexSlug(slug: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.dexScreenerSlug === slug);
}

/** Check if a DexScreener chainId slug is in our supported set */
export function isSupportedDexChain(slug: string): boolean {
  return SUPPORTED_DEX_SLUGS.has(slug);
}
