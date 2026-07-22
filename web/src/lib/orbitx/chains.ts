/**
 * OrbitX multi-chain launch registry — single source of truth for the API lane.
 *
 * Chains and launch-API providers are data, not code paths: the UI renders
 * whatever is registered here, and each provider flips from "soon" → "beta"
 * → "live" as its adapter + config lands. Solana is fully live today through
 * PumpPortal (pump.fun) and the OrbitX Token-2022 custom lane.
 */

export type ChainFamily = "svm" | "evm";
export type RolloutStatus = "live" | "beta" | "soon";

export interface ChainDef {
  id: string;
  name: string;
  symbol: string;
  family: ChainFamily;
  /** EVM chain id (hex) where applicable. */
  chainIdHex?: string;
  explorer: string;
  /** Brand accent for chips/rails. */
  color: string;
  status: RolloutStatus;
  note?: string;
}

export const CHAINS: ChainDef[] = [
  { id: "solana",    name: "Solana",          symbol: "SOL",  family: "svm", explorer: "https://solscan.io",              color: "#14F195", status: "live" },
  { id: "base",      name: "Base",            symbol: "ETH",  family: "evm", chainIdHex: "0x2105",  explorer: "https://basescan.org",       color: "#0052FF", status: "beta" },
  { id: "ethereum",  name: "Ethereum",        symbol: "ETH",  family: "evm", chainIdHex: "0x1",     explorer: "https://etherscan.io",       color: "#627EEA", status: "beta" },
  { id: "bnb",       name: "BNB Chain",       symbol: "BNB",  family: "evm", chainIdHex: "0x38",    explorer: "https://bscscan.com",        color: "#F0B90B", status: "beta" },
  { id: "arbitrum",  name: "Arbitrum One",    symbol: "ETH",  family: "evm", chainIdHex: "0xa4b1",  explorer: "https://arbiscan.io",        color: "#28A0F0", status: "soon" },
  { id: "robinhood", name: "Robinhood Chain", symbol: "ETH",  family: "evm", explorer: "",                                 color: "#00C805", status: "soon", note: "Arbitrum Orbit L2 — adapter lands as public mainnet APIs open" },
  { id: "optimism",  name: "OP Mainnet",      symbol: "ETH",  family: "evm", chainIdHex: "0xa",     explorer: "https://optimistic.etherscan.io", color: "#FF0420", status: "soon" },
  { id: "polygon",   name: "Polygon PoS",     symbol: "POL",  family: "evm", chainIdHex: "0x89",    explorer: "https://polygonscan.com",    color: "#8247E5", status: "soon" },
  { id: "avalanche", name: "Avalanche C",     symbol: "AVAX", family: "evm", chainIdHex: "0xa86a",  explorer: "https://snowtrace.io",       color: "#E84142", status: "soon" },
  { id: "blast",     name: "Blast",           symbol: "ETH",  family: "evm", chainIdHex: "0x13e31", explorer: "https://blastscan.io",       color: "#FCFC03", status: "soon" },
  { id: "monad",     name: "Monad",           symbol: "MON",  family: "evm", explorer: "",                                 color: "#836EF9", status: "soon" },
  { id: "sonic",     name: "Sonic",           symbol: "S",    family: "evm", chainIdHex: "0x92",    explorer: "https://sonicscan.org",      color: "#4CC9F0", status: "soon" },
  { id: "hyperevm",  name: "HyperEVM",        symbol: "HYPE", family: "evm", explorer: "https://hyperevmscan.io",          color: "#97FCE4", status: "soon" },
];

export interface LaunchProviderDef {
  id: string;
  name: string;
  /** Chain ids this provider can deploy to. */
  chains: string[];
  status: RolloutStatus;
  /** How the adapter talks to it. */
  api: string;
  desc: string;
  docs?: string;
  /** Config that must land before this flips live (shown on the card). */
  requires?: string[];
  /** In-app route when the provider is live. */
  route?: string;
}

export const LAUNCH_PROVIDERS: LaunchProviderDef[] = [
  {
    id: "pumpportal", name: "PumpPortal · pump.fun", chains: ["solana"], status: "live",
    api: "trade-local — unsigned tx, you sign in-wallet",
    desc: "The exact pump.fun bonding-curve system: zero seeded liquidity, auto-graduation, creator fees claimable in-app across all your coins.",
    docs: "https://pumpportal.fun", route: "/orbitxlaunch/create/pump",
  },
  {
    id: "orbitx-token22", name: "OrbitX Custom · Token-2022", chains: ["solana"], status: "live",
    api: "on-chain — tx built in your browser",
    desc: "Your own mint with on-chain 0.30% creator fee, revocable authorities, optional Raydium pool and OBX vanity address.",
    route: "/orbitxlaunch/create/custom",
  },
  {
    id: "clanker", name: "Clanker", chains: ["base"], status: "beta",
    api: "REST deploy API",
    desc: "Base's leading token deployer — Uniswap v4 pool out of the box with creator fee split.",
    docs: "https://clanker.world", requires: ["Clanker API key", "Base RPC"],
  },
  {
    id: "flaunch", name: "Flaunch", chains: ["base"], status: "soon",
    api: "REST + SDK",
    desc: "Memecoin launches on Base with programmable revenue splits.",
    requires: ["Flaunch API key"],
  },
  {
    id: "fourmeme", name: "Four.meme", chains: ["bnb"], status: "soon",
    api: "REST deploy API",
    desc: "BNB Chain bonding-curve launches, pump-style.",
    requires: ["Four.meme API access"],
  },
  {
    id: "virtuals", name: "Virtuals Protocol", chains: ["base", "ethereum"], status: "soon",
    api: "Agent launch API",
    desc: "Agent-token launches with bonded liquidity.",
    requires: ["Virtuals API access"],
  },
  {
    id: "orbitx-evm", name: "OrbitX EVM Factory",
    chains: ["ethereum", "base", "bnb", "arbitrum", "robinhood", "optimism", "polygon", "avalanche", "blast", "monad", "sonic", "hyperevm"],
    status: "soon",
    api: "audited factory contract — deploy, seed LP, lock, verify in one flow",
    desc: "One OrbitX-owned ERC-20 factory across every EVM chain: fixed or curve supply, LP lock, fee routing back to creators — the custom lane, everywhere.",
    requires: ["per-chain RPC + deployer", "factory audit"],
  },
];

export const chainById = (id: string): ChainDef | undefined => CHAINS.find((c) => c.id === id);
export const providersForChain = (chainId: string): LaunchProviderDef[] =>
  LAUNCH_PROVIDERS.filter((p) => p.chains.includes(chainId));
