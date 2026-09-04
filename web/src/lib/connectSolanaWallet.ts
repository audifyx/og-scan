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
  adapter: Adapter & { isLegacyInject?: boolean };
  readyState: WalletReadyState | string;
};

/**
 * The Jupiter extension can appear twice: once via our window.jupiter inject
 * adapter and once via Wallet Standard. Standard signs more reliably in Chrome,
 * so prefer it whenever both are ready under the same name.
 */
function preferStandard(matches: WalletLike[]): WalletLike | null {
  if (!matches.length) return null;
  return matches.find((w) => !w.adapter.isLegacyInject) ?? matches[0];
}

const PREFERRED = ["Phantom", "Jupiter", "Solflare", "Backpack"] as const;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { globalThis.clearTimeout(timer); resolve(value); },
      (error) => { globalThis.clearTimeout(timer); reject(error); },
    );
  });
}

/** Wallet Standard registers "Jupiter Wallet"; legacy adapter is "Jupiter". */
export function walletNameAliases(name?: string | null): string[] {
  const raw = String(name || "").trim();
  if (!raw) return [];
  if (/^jupiter(\s+wallet)?$/i.test(raw)) return ["Jupiter", "Jupiter Wallet"];
  return [raw];
}

export function adapterNameMatches(adapterName: string, preferred?: string | null): boolean {
  if (!preferred) return false;
  const left = String(adapterName || "").toLowerCase();
  return walletNameAliases(preferred).some((alias) => alias.toLowerCase() === left);
}

function isReady(rs: string): boolean {
  return rs === WalletReadyState.Installed || rs === WalletReadyState.Loadable || rs === "Installed" || rs === "Loadable";
}

export function findConnectableWallet(
  wallets: readonly WalletLike[],
  preferredName?: string,
): WalletLike | null {
  // When the user (or UI) names a wallet, connect ONLY that adapter — never
  // silently fall through to Solflare / whatever else happens to be installed.
  if (preferredName) {
    const named = wallets.filter(
      (w) => adapterNameMatches(String(w.adapter.name), preferredName) && isReady(String(w.readyState)),
    );
    return preferStandard(named);
  }
  for (const name of PREFERRED) {
    const hits = wallets.filter(
      (w) => adapterNameMatches(String(w.adapter.name), name) && isReady(String(w.readyState)),
    );
    const hit = preferStandard(hits);
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
    const listed = opts.wallets.find((w) => adapterNameMatches(String(w.adapter.name), wanted));
    if (listed && !isReady(String(listed.readyState))) {
      throw new Error(phantomInstallHint(wanted));
    }
    throw new Error(phantomInstallHint(wanted));
  }

  const adapter = pick.adapter;
  opts.select(adapter.name as WalletName);
  // Allow WalletProvider to adopt the selected adapter before context.connect().
  await new Promise((r) => setTimeout(r, 100));

  if (!adapter.connected) {
    try {
      await withTimeout(opts.connect(), 5000, `${adapter.name} did not respond. Try another detected wallet.`);
    } catch {
      /* context connect can race — fall through */
    }
  }
  if (!adapter.connected) {
    await withTimeout(adapter.connect(), 12000, `${adapter.name} timed out. Open its app or extension, then try again.`);
  }
  // Some Standard wallets set publicKey a tick after connect resolves.
  if (!adapter.publicKey) {
    await new Promise((r) => setTimeout(r, 80));
  }
  const pk = adapter.publicKey?.toBase58();
  if (!pk) throw new Error(`${adapter.name} connected but returned no public key — unlock the extension and retry`);
  return pk;
}
