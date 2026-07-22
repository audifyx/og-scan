/**
 * OrbitX multi-chain launch registry — single source of truth for the API lane.
 *
 * Every chain with `evm` network params is LIVE for OrbitX Direct Deploy:
 * connect any EVM wallet (EIP-6963 injected or WalletConnect — incl. Robinhood
 * Wallet), the app switches/adds the network, and the fixed-supply ERC-20
 * deploys straight from the user's wallet. No third-party API needed.
 * Bonding-curve providers (PumpPortal on Solana today; Clanker on Base next)
 * are registered separately and flip live per adapter + config.
 */

export type ChainFamily = "svm" | "evm";
export type RolloutStatus = "live" | "beta" | "soon";

export interface EvmNetworkParams {
  chainIdHex: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export interface ChainDef {
  id: string;
  name: string;
  symbol: string;
  family: ChainFamily;
  explorer: string;
  color: string;
  status: RolloutStatus;
  evm?: EvmNetworkParams;
  note?: string;
}

export const CHAINS: ChainDef[] = [
  { id: "solana", name: "Solana", symbol: "SOL", family: "svm", explorer: "https://solscan.io", color: "#14F195", status: "live" },
  {
    id: "base", name: "Base", symbol: "ETH", family: "evm", explorer: "https://basescan.org", color: "#0052FF", status: "live",
    evm: { chainIdHex: "0x2105", chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] },
  },
  {
    id: "ethereum", name: "Ethereum", symbol: "ETH", family: "evm", explorer: "https://etherscan.io", color: "#627EEA", status: "live",
    evm: { chainIdHex: "0x1", chainName: "Ethereum Mainnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://eth.llamarpc.com", "https://cloudflare-eth.com"], blockExplorerUrls: ["https://etherscan.io"] },
  },
  {
    id: "bnb", name: "BNB Chain", symbol: "BNB", family: "evm", explorer: "https://bscscan.com", color: "#F0B90B", status: "live",
    evm: { chainIdHex: "0x38", chainName: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.bnbchain.org"], blockExplorerUrls: ["https://bscscan.com"] },
  },
  {
    id: "arbitrum", name: "Arbitrum One", symbol: "ETH", family: "evm", explorer: "https://arbiscan.io", color: "#28A0F0", status: "live",
    evm: { chainIdHex: "0xa4b1", chainName: "Arbitrum One", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://arb1.arbitrum.io/rpc"], blockExplorerUrls: ["https://arbiscan.io"] },
  },
  {
    id: "optimism", name: "OP Mainnet", symbol: "ETH", family: "evm", explorer: "https://optimistic.etherscan.io", color: "#FF0420", status: "live",
    evm: { chainIdHex: "0xa", chainName: "OP Mainnet", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.optimism.io"], blockExplorerUrls: ["https://optimistic.etherscan.io"] },
  },
  {
    id: "polygon", name: "Polygon PoS", symbol: "POL", family: "evm", explorer: "https://polygonscan.com", color: "#8247E5", status: "live",
    evm: { chainIdHex: "0x89", chainName: "Polygon PoS", nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, rpcUrls: ["https://polygon-rpc.com"], blockExplorerUrls: ["https://polygonscan.com"] },
  },
  {
    id: "avalanche", name: "Avalanche C", symbol: "AVAX", family: "evm", explorer: "https://snowtrace.io", color: "#E84142", status: "live",
    evm: { chainIdHex: "0xa86a", chainName: "Avalanche C-Chain", nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 }, rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"], blockExplorerUrls: ["https://snowtrace.io"] },
  },
  {
    id: "blast", name: "Blast", symbol: "ETH", family: "evm", explorer: "https://blastscan.io", color: "#FCFC03", status: "live",
    evm: { chainIdHex: "0x13e31", chainName: "Blast", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.blast.io"], blockExplorerUrls: ["https://blastscan.io"] },
  },
  {
    id: "sonic", name: "Sonic", symbol: "S", family: "evm", explorer: "https://sonicscan.org", color: "#4CC9F0", status: "live",
    evm: { chainIdHex: "0x92", chainName: "Sonic", nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 }, rpcUrls: ["https://rpc.soniclabs.com"], blockExplorerUrls: ["https://sonicscan.org"] },
  },
  {
    id: "hyperevm", name: "HyperEVM", symbol: "HYPE", family: "evm", explorer: "https://hyperevmscan.io", color: "#97FCE4", status: "live",
    evm: { chainIdHex: "0x3e7", chainName: "HyperEVM", nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 }, rpcUrls: ["https://rpc.hyperliquid.xyz/evm"], blockExplorerUrls: ["https://hyperevmscan.io"] },
  },
  {
    id: "monad", name: "Monad", symbol: "MON", family: "evm", explorer: "https://monadexplorer.com", color: "#836EF9", status: "beta",
    evm: { chainIdHex: "0x8f", chainName: "Monad", nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 }, rpcUrls: ["https://rpc.monad.xyz"], blockExplorerUrls: ["https://monadexplorer.com"] },
    note: "Fresh mainnet — RPC/explorer may move",
  },
  {
    id: "robinhood", name: "Robinhood Chain", symbol: "ETH", family: "evm", explorer: "https://robinhoodchain.blockscout.com", color: "#00C805", status: "live",
    evm: { chainIdHex: "0x1237", chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"], blockExplorerUrls: ["https://robinhoodchain.blockscout.com"] },
    note: "Arbitrum-Nitro L2, mainnet since Jul 1 2026 — public RPC, no key",
  },
];

export interface LaunchProviderDef {
  id: string;
  name: string;
  chains: string[];
  status: RolloutStatus;
  api: string;
  desc: string;
  docs?: string;
  requires?: string[];
  route?: string;
}

const EVM_LIVE = CHAINS.filter((c) => c.family === "evm" && c.evm).map((c) => c.id);

export const LAUNCH_PROVIDERS: LaunchProviderDef[] = [
  {
    id: "pumpportal", name: "PumpPortal · pump.fun", chains: ["solana"], status: "live",
    api: "trade-local — unsigned tx, you sign in-wallet (keyless)",
    desc: "The exact pump.fun bonding-curve system: zero seeded liquidity, auto-graduation, creator fees claimable in-app — with OBX vanity CA.",
    docs: "https://pumpportal.fun", route: "/orbitxlaunch/create/pump",
  },
  {
    id: "orbitx-token22", name: "OrbitX Custom · Token-2022", chains: ["solana"], status: "live",
    api: "on-chain — tx built in your browser (keyless)",
    desc: "Your own mint with on-chain 0.30% creator fee, revocable authorities, optional Raydium pool and OBX vanity address.",
    route: "/orbitxlaunch/create/custom",
  },
  {
    id: "orbitx-direct", name: "OrbitX Direct Deploy", chains: EVM_LIVE, status: "live",
    api: "in-wallet contract creation — keyless, optional CREATE2 vanity",
    desc: "Fixed-supply ERC-20 deployed straight from your connected wallet: no owner keys, no mint function, immutable from block one. Optional hex-vanity CA via CREATE2 salt grinding.",
    route: "/orbitxlaunch/create/api",
  },
  {
    id: "pons", name: "Pons (ex-NOXA)", chains: ["robinhood"], status: "soon",
    api: "external third-party launchpad — link out",
    desc: "A separate launchpad on Robinhood Chain (NOXA relaunched as Pons). OrbitX does not copy or reverse-engineer its contracts; we only link out to it. For a native keyless launch, use OrbitX Curve instead.",
    docs: "https://robinhoodchain.blockscout.com",
  },
  {
    id: "flapsh", name: "flap.sh", chains: ["robinhood"], status: "soon",
    api: "external third-party launchpad — link out",
    desc: "A separate bonding-curve launchpad on Robinhood Chain. OrbitX does not copy or reverse-engineer its contracts; we only reference it. For a native keyless launch, use OrbitX Curve instead.",
  },
  {
    id: "orbitx-curve-evm", name: "OrbitX Curve (EVM)", chains: EVM_LIVE, status: "beta",
    api: "OrbitX's own bonding-curve factory — pump economics on EVM, keyless",
    desc: "OrbitX-owned, MIT-licensed curve factory: virtual-reserve pricing, on-chain creator fees, auto-graduation. The full pump experience on every EVM chain incl. Robinhood Chain, launched straight from your wallet. Beta: the factory is unaudited pending review.",
    requires: ["factory audit before mainnet promotion", "VITE_ORBITX_FEE_WALLET set per deploy"],
    route: "/orbitxlaunch/create/curve",
  },
];

export const chainById = (id: string): ChainDef | undefined => CHAINS.find((c) => c.id === id);
export const providersForChain = (chainId: string): LaunchProviderDef[] =>
  LAUNCH_PROVIDERS.filter((p) => p.chains.includes(chainId));
export const evmChains = (): ChainDef[] => CHAINS.filter((c) => c.family === "evm" && !!c.evm);
export const explorerTxUrl = (c: ChainDef, hash: string): string =>
  c.evm?.blockExplorerUrls?.[0] ? `${c.evm.blockExplorerUrls[0]}/tx/${hash}` : "";
export const explorerAddressUrl = (c: ChainDef, addr: string): string =>
  c.evm?.blockExplorerUrls?.[0] ? `${c.evm.blockExplorerUrls[0]}/address/${addr}` : "";
