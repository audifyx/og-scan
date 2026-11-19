/**
 * evm.ts — EVM wallet + on-chain launch helpers (viem).
 *
 * The Launchpad already has a Solana (Phantom) path; this adds the EVM side so
 * a launch on Robinhood/BSC/Base/… can be signed by the user's injected wallet
 * (MetaMask, Rabby, Phantom-EVM, …). Uses the wallet's own transport for both
 * sending and receipts, so we never depend on a specific RPC being up.
 */
import {
  createWalletClient, createPublicClient, custom, defineChain,
  parseUnits, type Address, type Chain,
} from "viem";
import { ChainConfig } from "../chains";
import { ORBITX_TOKEN_ABI, ORBITX_TOKEN_BYTECODE } from "./erc20-artifact";

export function getEthereum(): any {
  const w = window as any;
  // Prefer a generic injected provider; fall back to Phantom's EVM provider.
  return w.ethereum || w?.phantom?.ethereum || null;
}

export function hasEvmWallet(): boolean {
  return !!getEthereum();
}

/** viem Chain built from our ChainConfig, using the wallet's transport. */
function viemChain(c: ChainConfig): Chain {
  return defineChain({
    id: c.evmChainId!,
    name: c.name,
    nativeCurrency: { name: c.nativeCurrency, symbol: c.nativeCurrency, decimals: 18 },
    rpcUrls: { default: { http: c.rpcUrl ? [c.rpcUrl] : [] } },
    blockExplorers: { default: { name: "Explorer", url: c.explorerUrl } },
  });
}

export async function connectEvm(): Promise<Address> {
  const eth = getEthereum();
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask (or another EVM wallet).");
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No account authorized");
  return accounts[0] as Address;
}

export function getEvmAddress(): Address | null {
  const eth = getEthereum();
  const a = eth?.selectedAddress;
  return a ? (a as Address) : null;
}

const toHexChainId = (id: number) => "0x" + id.toString(16);

/**
 * Make sure the wallet is on the target chain — switch, and add it first if
 * the wallet doesn't know it yet (common for Robinhood Chain).
 */
export async function ensureChain(c: ChainConfig): Promise<void> {
  const eth = getEthereum();
  if (!eth) throw new Error("No EVM wallet found");
  if (!c.evmChainId) throw new Error(`${c.name} is not an EVM chain`);
  const hexId = toHexChainId(c.evmChainId);
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
  } catch (err: any) {
    // 4902 = chain not added to the wallet yet → add it, then it becomes active.
    if (err?.code === 4902 || /Unrecognized chain|not been added/i.test(err?.message || "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexId,
          chainName: c.name,
          nativeCurrency: { name: c.nativeCurrency, symbol: c.nativeCurrency, decimals: 18 },
          rpcUrls: c.rpcUrl ? [c.rpcUrl] : [],
          blockExplorerUrls: [c.explorerUrl],
        }],
      });
    } else {
      throw err;
    }
  }
}

export interface Erc20DeployParams {
  chain: ChainConfig;
  name: string;
  symbol: string;
  decimals: number;
  /** whole-token supply (not base units); converted with `decimals` */
  supply: string | number;
  owner: Address;
}

export interface Erc20DeployResult {
  address: Address;
  txHash: string;
}

/**
 * Deploy the verified OrbitXToken ERC-20 to the selected chain via the user's
 * wallet. Returns the new token address + deploy tx hash once mined.
 */
export async function deployErc20(p: Erc20DeployParams): Promise<Erc20DeployResult> {
  const eth = getEthereum();
  if (!eth) throw new Error("No EVM wallet found");
  await ensureChain(p.chain);

  const chain = viemChain(p.chain);
  const transport = custom(eth);
  const wallet = createWalletClient({ account: p.owner, chain, transport });
  const pub = createPublicClient({ chain, transport });

  const supplyBase = parseUnits(String(p.supply || "0"), p.decimals);

  const hash = await wallet.deployContract({
    abi: ORBITX_TOKEN_ABI,
    bytecode: ORBITX_TOKEN_BYTECODE as `0x${string}`,
    args: [p.name, p.symbol, p.decimals, supplyBase, p.owner],
    account: p.owner,
    chain,
  });

  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== "success" || !rcpt.contractAddress)
    throw new Error("Token deployment failed on-chain");
  return { address: rcpt.contractAddress, txHash: hash };
}

/** Optionally renounce ownership so supply is permanently fixed. */
export async function renounceOwnership(c: ChainConfig, token: Address, owner: Address): Promise<string> {
  const eth = getEthereum();
  const chain = viemChain(c);
  const wallet = createWalletClient({ account: owner, chain, transport: custom(eth) });
  return wallet.writeContract({ address: token, abi: ORBITX_TOKEN_ABI, functionName: "renounceOwnership", args: [], account: owner, chain });
}
