/**
 * CREATE2 vanity deploys — fully keyless.
 *
 * Uses the deterministic-deployment proxy (Arachnid), deployed at the same
 * address on virtually every EVM chain. Anyone can call it: tx.to = proxy,
 * tx.data = 32-byte salt ++ init code, and the contract lands at
 * keccak256(0xff ++ proxy ++ salt ++ keccak256(initCode))[12:].
 * Address prediction fuzz-verified against ethers getCreate2Address (500 vectors).
 *
 * EVM addresses are hex-only, so grind targets must be hex chars (0-9 a-f).
 */
import { keccak256, hexToBytes, bytesToHex } from "./keccak";
import type { Eip1193Provider } from "./wallet";

export const CREATE2_PROXY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

export function predictCreate2Address(saltHex: string, initCodeHex: string): string {
  const buf = new Uint8Array(85);
  buf[0] = 0xff;
  buf.set(hexToBytes(CREATE2_PROXY), 1);
  buf.set(hexToBytes(saltHex), 21);
  buf.set(keccak256(hexToBytes(initCodeHex)), 53);
  return "0x" + bytesToHex(keccak256(buf).subarray(12));
}

export interface GrindResult { saltHex: string; address: string; attempts: number }

/** Grind a salt so the CREATE2 address ends with `suffix` (lowercase hex). */
export async function grindVanitySalt(
  initCodeHex: string,
  suffix: string,
  opts: { onProgress?: (attempts: number) => void; shouldStop?: () => boolean } = {},
): Promise<GrindResult | null> {
  const target = suffix.toLowerCase();
  if (!/^[0-9a-f]{1,6}$/.test(target)) throw new Error("Vanity pattern must be 1-6 hex characters (0-9, a-f)");
  const buf = new Uint8Array(85);
  buf[0] = 0xff;
  buf.set(hexToBytes(CREATE2_PROXY), 1);
  buf.set(keccak256(hexToBytes(initCodeHex)), 53);
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  let attempts = 0;
  for (;;) {
    for (let batch = 0; batch < 256; batch++) {
      for (let i = 0; i < 32; i++) { if (++salt[i] !== 0) break; }
      buf.set(salt, 21);
      const h = keccak256(buf);
      attempts++;
      const addr = bytesToHex(h.subarray(12));
      if (addr.endsWith(target)) {
        return { saltHex: "0x" + bytesToHex(salt), address: "0x" + addr, attempts };
      }
    }
    opts.onProgress?.(attempts);
    if (opts.shouldStop?.()) return null;
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** tx.data for the proxy: salt ++ init code. */
export function buildProxyDeployData(saltHex: string, initCodeHex: string): string {
  return "0x" + saltHex.replace(/^0x/, "") + initCodeHex.replace(/^0x/, "");
}

/** Is the deterministic-deployment proxy live on the connected chain? */
export async function isProxyDeployed(provider: Eip1193Provider): Promise<boolean> {
  const code = (await provider.request({ method: "eth_getCode", params: [CREATE2_PROXY, "latest"] })) as string;
  return typeof code === "string" && code.length > 2;
}

/** Post-deploy sanity: bytecode exists at the predicted address. */
export async function hasCodeAt(provider: Eip1193Provider, address: string): Promise<boolean> {
  const code = (await provider.request({ method: "eth_getCode", params: [address, "latest"] })) as string;
  return typeof code === "string" && code.length > 2;
}
