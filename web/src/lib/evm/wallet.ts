/**
 * OrbitX EVM wallet layer — dependency-free EIP-1193 + EIP-6963.
 *
 * - discoverWallets(): every injected wallet announces itself via EIP-6963
 *   (MetaMask, Coinbase Wallet, Rabby, OKX, Brave, Robinhood Wallet extension,
 *   ...), with window.ethereum as fallback for older injectors.
 * - connectWalletConnect(): loads @walletconnect/ethereum-provider at runtime
 *   (no build dependency) so mobile wallets — including Robinhood Wallet —
 *   connect by QR / deep link. Requires VITE_WALLETCONNECT_PROJECT_ID.
 * - ensureChain(): wallet_switchEthereumChain with automatic
 *   wallet_addEthereumChain fallback using the registry's network params.
 */
import type { EvmNetworkParams } from "@/lib/orbitx/chains";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, cb: (...args: unknown[]) => void): void;
  removeListener?(event: string, cb: (...args: unknown[]) => void): void;
}

export interface DiscoveredWallet {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

/** Collect EIP-6963 announcements (plus window.ethereum fallback). */
export function discoverWallets(waitMs = 350): Promise<DiscoveredWallet[]> {
  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredWallet>();
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent).detail as DiscoveredWallet | undefined;
      if (detail?.info?.uuid && detail.provider) found.set(detail.info.uuid, detail);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      const list = [...found.values()];
      const injected = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (list.length === 0 && injected) {
        list.push({
          info: { uuid: "window.ethereum", name: "Browser wallet", icon: "", rdns: "injected" },
          provider: injected,
        });
      }
      resolve(list);
    }, waitMs);
  });
}

export async function connectWallet(provider: Eip1193Provider): Promise<string> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("Wallet returned no account");
  return accounts[0];
}

export async function getChainIdHex(provider: Eip1193Provider): Promise<string> {
  return String(await provider.request({ method: "eth_chainId" })).toLowerCase();
}

/** Switch the wallet to `net`, adding the network first if it's unknown. */
export async function ensureChain(provider: Eip1193Provider, net: EvmNetworkParams): Promise<void> {
  const current = await getChainIdHex(provider).catch(() => "");
  if (current === net.chainIdHex.toLowerCase()) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: net.chainIdHex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    // 4902: unknown chain. Some wallets bury it in -32603.
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: net.chainIdHex,
          chainName: net.chainName,
          nativeCurrency: net.nativeCurrency,
          rpcUrls: net.rpcUrls,
          blockExplorerUrls: net.blockExplorerUrls,
        }],
      });
    } else {
      throw err;
    }
  }
}

/** Send a contract-creation transaction (no `to`). Returns the tx hash. */
export async function sendDeployTransaction(
  provider: Eip1193Provider,
  from: string,
  data: string,
): Promise<string> {
  return (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, data }],
  })) as string;
}

export interface DeployReceipt {
  contractAddress: string | null;
  status: string;
  blockNumber: string;
}

/** Poll for the receipt through the same wallet provider. */
export async function waitForReceipt(
  provider: Eip1193Provider,
  txHash: string,
  { intervalMs = 2500, timeoutMs = 240_000 } = {},
): Promise<DeployReceipt> {
  const start = Date.now();
  for (;;) {
    const r = (await provider
      .request({ method: "eth_getTransactionReceipt", params: [txHash] })
      .catch(() => null)) as DeployReceipt | null;
    if (r?.blockNumber) return r;
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for confirmation — check the tx in the explorer");
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

/** WalletConnect v2 (Robinhood Wallet, Trust, Rainbow, mobile MetaMask, ...).
 *  Loaded at runtime from esm.sh — zero build-time dependency. */
export async function connectWalletConnect(
  projectId: string,
  chainIdsDecimal: number[],
): Promise<{ provider: Eip1193Provider; account: string }> {
  const mod = (await import(
    /* @vite-ignore */ "https://esm.sh/@walletconnect/ethereum-provider@2.21.1?bundle"
  )) as { EthereumProvider?: { init(opts: object): Promise<Eip1193Provider & { enable(): Promise<string[]> }> } };
  const EthereumProvider = mod.EthereumProvider;
  if (!EthereumProvider) throw new Error("WalletConnect failed to load");
  const provider = await EthereumProvider.init({
    projectId,
    chains: [chainIdsDecimal[0] ?? 1],
    optionalChains: chainIdsDecimal,
    showQrModal: true,
  });
  const accounts = await provider.enable();
  if (!accounts?.[0]) throw new Error("WalletConnect returned no account");
  return { provider, account: accounts[0] };
}

export const WALLETCONNECT_PROJECT_ID: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WALLETCONNECT_PROJECT_ID ?? "";

export function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
