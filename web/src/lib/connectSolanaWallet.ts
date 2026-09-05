/**
 * Reliable Solana extension connect for OrbitX Trade.
 *
 * WalletProvider.connect() no-ops when `wallet` is still null after select()
 * (React state hasn't flushed). Always fall back to adapter.connect().
 * Never open adapter.url / jup.ag on failure — callers toast instead.
 *
 * Wallet Standard adapters often set `publicKey` a tick after `connect()`
 * resolves, and autoConnect can leave an adapter `connected`/`connecting`
 * without a key (locked extension). Always wait/poll, and reconnect when
 * connected-but-keyless.
 */
import type { Adapter, WalletName } from "@solana/wallet-adapter-base";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";

export type WalletLike = {
  adapter: Adapter & { isLegacyInject?: boolean; connecting?: boolean };
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => globalThis.setTimeout(r, ms));
}

/** Wallet Standard registers "Jupiter Wallet"; legacy adapter is "Jupiter". */
export function walletNameAliases(name?: string | null): string[] {
  const raw = String(name || "").trim();
  if (!raw) return [];
  if (/^jupiter(\s+wallet)?$/i.test(raw)) return ["Jupiter", "Jupiter Wallet"];
  if (/^phantom(\s+wallet)?$/i.test(raw)) return ["Phantom", "Phantom Wallet"];
  if (/^solflare(\s+wallet)?$/i.test(raw)) return ["Solflare", "Solflare Wallet"];
  return [raw];
}

export function adapterNameMatches(adapterName: string, preferred?: string | null): boolean {
  if (!preferred) return false;
  const left = String(adapterName || "").toLowerCase();
  return walletNameAliases(preferred).some((alias) => alias.toLowerCase() === left);
}

export function walletDedupeKey(name: string): string {
  const raw = String(name || "").trim().toLowerCase();
  if (/^jupiter(\s+wallet)?$/.test(raw)) return "jupiter";
  if (/^phantom(\s+wallet)?$/.test(raw)) return "phantom";
  if (/^solflare(\s+wallet)?$/.test(raw)) return "solflare";
  return raw;
}

function isInstalled(rs: string): boolean {
  return rs === WalletReadyState.Installed || rs === "Installed";
}

function isLoadable(rs: string): boolean {
  return rs === WalletReadyState.Loadable || rs === "Loadable";
}

function isReady(rs: string): boolean {
  return isInstalled(rs) || isLoadable(rs);
}

function readyRank(w: WalletLike): number {
  const rs = String(w.readyState);
  const standard = !w.adapter.isLegacyInject;
  if (isInstalled(rs) && standard) return 0;
  if (isInstalled(rs)) return 1;
  if (isLoadable(rs) && standard) return 2;
  if (isLoadable(rs)) return 3;
  return 4;
}

/** One row per wallet family, preferring Installed + Wallet Standard. */
export function collapseDuplicateWallets(wallets: readonly WalletLike[]): WalletLike[] {
  const best = new Map<string, WalletLike>();
  for (const w of wallets) {
    const key = walletDedupeKey(String(w.adapter.name));
    const prev = best.get(key);
    if (!prev || readyRank(w) < readyRank(prev)) best.set(key, w);
  }
  return [...best.values()];
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
    const installed = wallets.filter(
      (w) => adapterNameMatches(String(w.adapter.name), name) && isInstalled(String(w.readyState)),
    );
    const hit = preferStandard(installed);
    if (hit) return hit;
  }
  for (const name of PREFERRED) {
    const loadable = wallets.filter(
      (w) => adapterNameMatches(String(w.adapter.name), name) && isLoadable(String(w.readyState)),
    );
    const hit = preferStandard(loadable);
    if (hit) return hit;
  }
  return wallets.find((w) => isInstalled(String(w.readyState)))
    ?? wallets.find((w) => isLoadable(String(w.readyState)))
    ?? null;
}

export function phantomInstallHint(name = "Phantom"): string {
  return `${name} isn't detected in this browser. Install the ${name} extension, then refresh — we never open external swap sites.`;
}

function toBase58(pk: unknown): string | null {
  if (!pk) return null;
  if (typeof pk === "string") {
    const s = pk.trim();
    return s.length >= 32 ? s : null;
  }
  if (typeof pk === "object") {
    const obj = pk as { toBase58?: () => string; publicKey?: unknown };
    if (typeof obj.toBase58 === "function") {
      try {
        const s = String(obj.toBase58() || "").trim();
        return s.length > 0 ? s : null;
      } catch {
        /* ignore */
      }
    }
    if (obj.publicKey && obj.publicKey !== pk) return toBase58(obj.publicKey);
  }
  return null;
}

function injectedProviders(name: string): unknown[] {
  if (typeof window === "undefined") return [];
  const w = window as unknown as {
    solana?: { isPhantom?: boolean; isJupiter?: boolean; isSolflare?: boolean; publicKey?: unknown };
    phantom?: { solana?: { publicKey?: unknown } };
    jupiter?: { solana?: { publicKey?: unknown } };
    solflare?: { publicKey?: unknown };
    backpack?: { publicKey?: unknown };
  };
  if (/phantom/i.test(name)) {
    return [w.phantom?.solana, w.solana?.isPhantom ? w.solana : null];
  }
  if (/jupiter/i.test(name)) {
    return [w.jupiter?.solana, w.solana?.isJupiter ? w.solana : null];
  }
  if (/solflare/i.test(name)) {
    return [w.solflare, w.solana?.isSolflare ? w.solana : null];
  }
  if (/backpack/i.test(name)) {
    return [w.backpack];
  }
  return [w.solana];
}

export function readAdapterPublicKey(adapter: Adapter & { connecting?: boolean }): string | null {
  const direct = toBase58(adapter.publicKey)
    ?? toBase58((adapter as { wallet?: { publicKey?: unknown } }).wallet?.publicKey);
  if (direct) return direct;
  for (const provider of injectedProviders(String(adapter.name))) {
    const pk = toBase58((provider as { publicKey?: unknown } | null)?.publicKey);
    if (pk) return pk;
  }
  return null;
}

export async function waitForPublicKey(
  adapter: Adapter,
  ms = 2500,
  extra?: () => string | null,
): Promise<string | null> {
  const deadline = Date.now() + ms;
  for (;;) {
    const pk = readAdapterPublicKey(adapter) || extra?.() || null;
    if (pk) return pk;
    if (Date.now() >= deadline) return null;
    await sleep(80);
  }
}

async function disconnectQuietly(adapter: Adapter): Promise<void> {
  try {
    await adapter.disconnect();
  } catch {
    /* already disconnected / locked */
  }
}

export async function connectSolanaWallet(opts: {
  wallets: readonly WalletLike[];
  select: (name: WalletName) => void;
  connect: () => Promise<void>;
  preferredName?: string;
  getContextPublicKey?: () => string | null;
}): Promise<string> {
  const pick = findConnectableWallet(opts.wallets, opts.preferredName);
  if (!pick) {
    const wanted = opts.preferredName || "Phantom";
    throw new Error(phantomInstallHint(wanted));
  }

  const adapter = pick.adapter;
  const extra = () => opts.getContextPublicKey?.() || null;
  opts.select(adapter.name as WalletName);
  // Allow WalletProvider to adopt the selected adapter before context.connect().
  await sleep(100);

  const connecting = Boolean(adapter.connecting);
  if (connecting) {
    const during = await waitForPublicKey(adapter, 8000, extra);
    if (during) return during;
  }

  let pk = readAdapterPublicKey(adapter) || extra();
  if (pk) return pk;

  // Stale autoConnect: adapter.connected is true but the extension never
  // handed over a public key (locked, or Standard accounts not hydrated).
  if (adapter.connected || adapter.connecting) {
    await disconnectQuietly(adapter);
    await sleep(50);
  }

  if (!adapter.connected) {
    try {
      await withTimeout(opts.connect(), 5000, `${adapter.name} did not respond. Try another detected wallet.`);
    } catch {
      /* context connect can race — fall through */
    }
  }

  pk = readAdapterPublicKey(adapter) || extra();
  if (pk) return pk;

  // Standard adapters sometimes mark connected before accounts hydrate.
  if (adapter.connected) {
    pk = await waitForPublicKey(adapter, 400, extra);
    if (pk) return pk;
  }

  if (!adapter.connected || !readAdapterPublicKey(adapter)) {
    if (adapter.connecting || (adapter.connected && !readAdapterPublicKey(adapter))) {
      await disconnectQuietly(adapter);
      await sleep(50);
    }
    await withTimeout(adapter.connect(), 12000, `${adapter.name} timed out. Open its app or extension, then try again.`);
  }

  pk = await waitForPublicKey(adapter, 2500, extra);
  if (!pk) {
    throw new Error(`${adapter.name} connected but returned no public key — unlock the extension and retry`);
  }
  return pk;
}

type InjectedProvider = {
  connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: unknown } | void>;
  publicKey?: unknown;
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<unknown>;
};

/** Direct extension inject — bypasses wallet-adapter races that report "connected" with no key. */
export function getInjectedProvider(name?: string | null): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    solana?: InjectedProvider & { isPhantom?: boolean; isJupiter?: boolean; isSolflare?: boolean };
    phantom?: { solana?: InjectedProvider };
    jupiter?: { solana?: InjectedProvider } & InjectedProvider;
    solflare?: InjectedProvider;
    backpack?: InjectedProvider;
  };
  const want = String(name || "");
  const phantom = w.phantom?.solana || (w.solana?.isPhantom ? w.solana : null);
  const jupiter = w.jupiter?.solana || (w.jupiter && typeof w.jupiter.connect === "function" ? w.jupiter : null) || (w.solana?.isJupiter ? w.solana : null);
  const solflare = w.solflare || (w.solana?.isSolflare ? w.solana : null);
  const backpack = w.backpack;
  if (/phantom/i.test(want)) return phantom || null;
  if (/jupiter/i.test(want)) return jupiter || null;
  if (/solflare/i.test(want)) return solflare || null;
  if (/backpack/i.test(want)) return backpack || null;
  if (!want) return phantom || jupiter || solflare || backpack || w.solana || null;
  return null;
}

export function isInjectedWalletPresent(name: string): boolean {
  const provider = getInjectedProvider(name);
  return Boolean(provider && (typeof provider.connect === "function" || provider.publicKey));
}

export async function connectInjectedWallet(preferredName?: string): Promise<{
  publicKey: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
} | null> {
  const provider = getInjectedProvider(preferredName);
  if (!provider) return null;
  const label = preferredName || "Wallet";
  if (typeof provider.connect === "function") {
    try {
      await withTimeout(provider.connect(), 15000, `${label} did not respond. Unlock the extension and retry.`);
    } catch (err) {
      if (!toBase58(provider.publicKey)) throw err;
    }
  }
  const pk = toBase58(provider.publicKey);
  if (!pk) {
    throw new Error(`${label} connected but returned no public key — unlock the extension and retry`);
  }
  if (typeof provider.signMessage !== "function") {
    throw new Error(`${label} can't sign the login message here. Open OrbitX in a normal browser tab with the extension enabled.`);
  }
  const sign = provider.signMessage.bind(provider);
  return {
    publicKey: pk,
    signMessage: async (message: Uint8Array) => normalizeSignatureBytes(await sign(message)),
  };
}
