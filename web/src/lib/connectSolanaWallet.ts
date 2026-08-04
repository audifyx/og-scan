/**
 * Reliable Solana extension connect for OrbitX Trade.
 *
 * WalletProvider.connect() no-ops when `wallet` is still null after select()
 * (React state hasn't flushed). Always fall back to adapter.connect().
 * Never open adapter.url / jup.ag on failure — callers toast instead.
 */
import type { Adapter, WalletName } from "@solana/wallet-adapter-base";
import { WalletReadyState } from "@solana/wallet-adapter-base";

export type WalletLike = {
  adapter: Adapter;
  readyState: WalletReadyState | string;
};

const PREFERRED = ["Phantom", "Jupiter", "Solflare", "Backpack"] as const;

function isReady(rs: string): boolean {
  return rs === WalletReadyState.Installed || rs === WalletReadyState.Loadable || rs === "Installed" || rs === "Loadable";
}

export function findConnectableWallet(
  wallets: readonly WalletLike[],
  preferredName?: string,
): WalletLike | null {
  if (preferredName) {
    const named = wallets.find((w) => w.adapter.name === preferredName);
    if (named && isReady(String(named.readyState))) return named;
  }
  for (const name of PREFERRED) {
    const hit = wallets.find((w) => w.adapter.name === name && isReady(String(w.readyState)));
    if (hit) return hit;
  }
  return wallets.find((w) => isReady(String(w.readyState))) ?? null;
}

export function phantomInstallHint(name = "Phantom"): string {
  return `${name} isn't detected in this browser. Install the ${name} extension, then refresh — we never open external swap sites.`;
}

export async function connectSolanaWallet(opts: {
  wallets: readonly WalletLike[];
  select: (name: WalletName) => void;
  connect: () => Promise<void>;
  preferredName?: string;
}): Promise<string> {
  const pick = findConnectableWallet(opts.wallets, opts.preferredName);
  if (!pick) {
    const wanted = opts.preferredName || "Phantom";
    const listed = opts.wallets.find((w) => w.adapter.name === wanted);
    if (listed && !isReady(String(listed.readyState))) {
      throw new Error(phantomInstallHint(wanted));
    }
    throw new Error(phantomInstallHint(wanted));
  }

  const adapter = pick.adapter;
  opts.select(adapter.name as WalletName);
  // Allow WalletProvider to adopt the selected adapter before context.connect().
  await new Promise((r) => setTimeout(r, 40));

  if (!adapter.connected) {
    try {
      await opts.connect();
    } catch {
      /* context connect can race — fall through */
    }
  }
  if (!adapter.connected) {
    await adapter.connect();
  }
  const pk = adapter.publicKey?.toBase58();
  if (!pk) throw new Error(`${adapter.name} connected but returned no public key`);
  return pk;
}
