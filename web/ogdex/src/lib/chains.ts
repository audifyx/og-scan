/**
 * chains.ts — Multi-chain launch registry for the OrbitX Launchpad.
 *
 * Focused on what LAUNCHING needs: EVM numeric chainId, RPC + explorer for
 * wallet_addEthereumChain, native currency, and the launchpads available on
 * each chain. DexScreener slug (`id`) stays the canonical key so it lines up
 * with the token-data side (TokenDetail ?chain=, _evm.js, chart.js).
 *
 * Launchpad `kind`:
 *   pumpfun     → Solana bonding-curve launcher (pump.fun) — LIVE
 *   erc20       → deploy a standard ERC-20 on any EVM chain — LIVE (universal)
 *   bondingcurve→ third-party EVM meme launchpad (NOXA/Four.Meme/WOW/…) — per-adapter
 *
 * `status`:
 *   live  → adapter implemented + wired
 *   soon  → selectable but the on-chain adapter isn't verified yet (shows a
 *           notice instead of sending a transaction — never risks funds)
 */

export type LaunchKind = "pumpfun" | "erc20" | "bondingcurve";
export type LaunchStatus = "live" | "soon";

export interface Launchpad {
  id: string;
  name: string;
  emoji: string;
  kind: LaunchKind;
  status: LaunchStatus;
  description: string;
  website?: string;
}

export interface ChainConfig {
  id: string;              // DexScreener slug — canonical key
  name: string;
  shortName: string;
  isEvm: boolean;
  evmChainId?: number;     // numeric EVM chain id (undefined for Solana)
  rpcUrl?: string;         // public RPC (for wallet_addEthereumChain + reads)
  nativeCurrency: string;
  explorerUrl: string;
  emoji: string;
  accent: string;          // tailwind classes for the chain pill
  launchpads: Launchpad[];
}

const ERC20 = (chainName: string): Launchpad => ({
  id: "erc20",
  name: "Standard Token",
  emoji: "🪙",
  kind: "erc20",
  status: "live",
  description: `Deploy a real ERC-20 on ${chainName} (name, symbol, supply, mint/burn options)`,
});

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: "solana", name: "Solana", shortName: "SOL", isEvm: false,
    nativeCurrency: "SOL", explorerUrl: "https://solscan.io", emoji: "◎",
    accent: "border-[#9945FF]/30 bg-[#9945FF]/10 text-[#14F195]",
    launchpads: [
      { id: "pumpfun", name: "Pump.fun", emoji: "🎪", kind: "pumpfun", status: "live", description: "Bonding-curve meme launcher — instant trading", website: "https://pump.fun" },
    ],
  },
  {
    id: "robinhood", name: "Robinhood Chain", shortName: "HOOD", isEvm: true,
    evmChainId: 4663, rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    nativeCurrency: "ETH", explorerUrl: "https://robinhoodchain.blockscout.com", emoji: "🪽",
    accent: "border-[#00C805]/30 bg-[#00C805]/10 text-[#00C805]",
    launchpads: [
      { id: "noxafun", name: "NOXA Fun", emoji: "🐳", kind: "bondingcurve", status: "soon", description: "Hybrid Uniswap-V3 launchpad, permanently locked LP", website: "https://fun.noxa.fi/robinhood" },
      ERC20("Robinhood Chain"),
    ],
  },
  {
    id: "bsc", name: "BNB Smart Chain", shortName: "BSC", isEvm: true,
    evmChainId: 56, rpcUrl: "https://bsc-dataseed.binance.org",
    nativeCurrency: "BNB", explorerUrl: "https://bscscan.com", emoji: "🔶",
    accent: "border-[#F3BA2F]/30 bg-[#F3BA2F]/10 text-[#F3BA2F]",
    launchpads: [
      { id: "four-meme", name: "Four.Meme", emoji: "4️⃣", kind: "bondingcurve", status: "soon", description: "BNB Chain meme launcher — instant PancakeSwap listing", website: "https://four.meme" },
      ERC20("BNB Chain"),
    ],
  },
  {
    id: "base", name: "Base", shortName: "BASE", isEvm: true,
    evmChainId: 8453, rpcUrl: "https://mainnet.base.org",
    nativeCurrency: "ETH", explorerUrl: "https://basescan.org", emoji: "🔵",
    accent: "border-[#0052FF]/30 bg-[#0052FF]/10 text-[#0052FF]",
    launchpads: [
      { id: "wow", name: "WOW.xyz", emoji: "🎉", kind: "bondingcurve", status: "soon", description: "Base memecoin launcher (Zora protocol)", website: "https://wow.xyz" },
      ERC20("Base"),
    ],
  },
  {
    id: "ethereum", name: "Ethereum", shortName: "ETH", isEvm: true,
    evmChainId: 1, rpcUrl: "https://eth.llamarpc.com",
    nativeCurrency: "ETH", explorerUrl: "https://etherscan.io", emoji: "⟠",
    accent: "border-[#627EEA]/30 bg-[#627EEA]/10 text-[#627EEA]",
    launchpads: [ERC20("Ethereum")],
  },
  {
    id: "arbitrum", name: "Arbitrum", shortName: "ARB", isEvm: true,
    evmChainId: 42161, rpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeCurrency: "ETH", explorerUrl: "https://arbiscan.io", emoji: "🔷",
    accent: "border-[#28A0F0]/30 bg-[#28A0F0]/10 text-[#28A0F0]",
    launchpads: [ERC20("Arbitrum")],
  },
  {
    id: "polygon", name: "Polygon", shortName: "POL", isEvm: true,
    evmChainId: 137, rpcUrl: "https://polygon-rpc.com",
    nativeCurrency: "POL", explorerUrl: "https://polygonscan.com", emoji: "💜",
    accent: "border-[#8247E5]/30 bg-[#8247E5]/10 text-[#8247E5]",
    launchpads: [ERC20("Polygon")],
  },
  {
    id: "avalanche", name: "Avalanche", shortName: "AVAX", isEvm: true,
    evmChainId: 43114, rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    nativeCurrency: "AVAX", explorerUrl: "https://snowscan.xyz", emoji: "🔺",
    accent: "border-[#E84142]/30 bg-[#E84142]/10 text-[#E84142]",
    launchpads: [ERC20("Avalanche")],
  },
  {
    id: "optimism", name: "Optimism", shortName: "OP", isEvm: true,
    evmChainId: 10, rpcUrl: "https://mainnet.optimism.io",
    nativeCurrency: "ETH", explorerUrl: "https://optimistic.etherscan.io", emoji: "🔴",
    accent: "border-[#FF0420]/30 bg-[#FF0420]/10 text-[#FF0420]",
    launchpads: [ERC20("Optimism")],
  },
  {
    id: "blast", name: "Blast", shortName: "BLAST", isEvm: true,
    evmChainId: 81457, rpcUrl: "https://rpc.blast.io",
    nativeCurrency: "ETH", explorerUrl: "https://blastscan.io", emoji: "💥",
    accent: "border-[#FCFC03]/30 bg-[#FCFC03]/10 text-[#FCFC03]",
    launchpads: [ERC20("Blast")],
  },
  {
    id: "sonic", name: "Sonic", shortName: "S", isEvm: true,
    evmChainId: 146, rpcUrl: "https://rpc.soniclabs.com",
    nativeCurrency: "S", explorerUrl: "https://sonicscan.org", emoji: "🔊",
    accent: "border-[#5B6EF5]/30 bg-[#5B6EF5]/10 text-[#5B6EF5]",
    launchpads: [ERC20("Sonic")],
  },
  {
    id: "berachain", name: "Berachain", shortName: "BERA", isEvm: true,
    evmChainId: 80094, rpcUrl: "https://rpc.berachain.com",
    nativeCurrency: "BERA", explorerUrl: "https://berascan.com", emoji: "🐻",
    accent: "border-[#F6A627]/30 bg-[#794B29]/10 text-[#F6A627]",
    launchpads: [ERC20("Berachain")],
  },
  {
    id: "linea", name: "Linea", shortName: "LINEA", isEvm: true,
    evmChainId: 59144, rpcUrl: "https://rpc.linea.build",
    nativeCurrency: "ETH", explorerUrl: "https://lineascan.build", emoji: "➖",
    accent: "border-[#61DFFF]/30 bg-[#61DFFF]/10 text-[#61DFFF]",
    launchpads: [ERC20("Linea")],
  },
  {
    id: "scroll", name: "Scroll", shortName: "SCROLL", isEvm: true,
    evmChainId: 534352, rpcUrl: "https://rpc.scroll.io",
    nativeCurrency: "ETH", explorerUrl: "https://scrollscan.com", emoji: "📜",
    accent: "border-[#EBC28E]/30 bg-[#EBC28E]/10 text-[#EBC28E]",
    launchpads: [ERC20("Scroll")],
  },
  {
    id: "zksync", name: "zkSync Era", shortName: "ZK", isEvm: true,
    evmChainId: 324, rpcUrl: "https://mainnet.era.zksync.io",
    nativeCurrency: "ETH", explorerUrl: "https://era.zksync.network", emoji: "🔗",
    accent: "border-[#8C8DFC]/30 bg-[#8C8DFC]/10 text-[#8C8DFC]",
    launchpads: [ERC20("zkSync Era")],
  },
  {
    id: "mantle", name: "Mantle", shortName: "MNT", isEvm: true,
    evmChainId: 5000, rpcUrl: "https://rpc.mantle.xyz",
    nativeCurrency: "MNT", explorerUrl: "https://mantlescan.xyz", emoji: "🟩",
    accent: "border-[#65B3AE]/30 bg-[#65B3AE]/10 text-[#65B3AE]",
    launchpads: [ERC20("Mantle")],
  },
  {
    id: "celo", name: "Celo", shortName: "CELO", isEvm: true,
    evmChainId: 42220, rpcUrl: "https://forno.celo.org",
    nativeCurrency: "CELO", explorerUrl: "https://celoscan.io", emoji: "🌿",
    accent: "border-[#35D07F]/30 bg-[#35D07F]/10 text-[#35D07F]",
    launchpads: [ERC20("Celo")],
  },
];

export const CHAIN_MAP = new Map(SUPPORTED_CHAINS.map((c) => [c.id, c]));
export const getChain = (id: string): ChainConfig => CHAIN_MAP.get(id) ?? SUPPORTED_CHAINS[0];
export const isSolana = (id: string) => id === "solana";

export function explorerTxUrl(chainId: string, hash: string): string {
  const c = getChain(chainId);
  return c.isEvm ? `${c.explorerUrl}/tx/${hash}` : `${c.explorerUrl}/tx/${hash}`;
}
export function explorerTokenUrl(chainId: string, address: string): string {
  const c = getChain(chainId);
  return c.isEvm ? `${c.explorerUrl}/token/${address}` : `${c.explorerUrl}/token/${address}`;
}
export function getLaunchpad(chainId: string, launchpadId: string): Launchpad | undefined {
  return getChain(chainId).launchpads.find((l) => l.id === launchpadId);
}
