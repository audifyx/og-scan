/**
 * Phantom + Jupiter login via extension inject + Wallet Standard.
 * Does not use @solana/wallet-adapter — that path reported "connected" with no key.
 */
import { coercePublicKey, normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";
import { signInWithWallet } from "@/lib/walletAuth";
import {
  connectStandardWallet,
  findStandardWallet,
  startWalletStandardDiscovery,
  subscribeWalletStandard,
} from "@/lib/walletStandard";

export type InjectWallet = "phantom" | "jupiter";

type InjectedProvider = {
  isPhantom?: boolean;
  isJupiter?: boolean;
  publicKey?: unknown;
  connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: unknown } | void>;
  disconnect?: () => Promise<void>;
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<unknown>;
  signTransaction?: (tx: unknown) => Promise<unknown>;
  signAllTransactions?: (txs: unknown[]) => Promise<unknown[]>;
  signAndSendTransaction?: (tx: unknown, opts?: unknown) => Promise<unknown>;
};

function win(): {
  phantom?: { solana?: InjectedProvider };
  jupiter?: { solana?: InjectedProvider } & InjectedProvider;
  solana?: InjectedProvider;
} {
  if (typeof window === "undefined") return {};
  return window as typeof window & {
    phantom?: { solana?: InjectedProvider };
    jupiter?: { solana?: InjectedProvider } & InjectedProvider;
    solana?: InjectedProvider;
  };
}

function providerUsable(p: InjectedProvider | null | undefined): p is InjectedProvider {
  if (!p) return false;
  return typeof p.connect === "function"
    || typeof p.signMessage === "function"
    || typeof p.request === "function"
    || p.publicKey != null;
}

function getGenericSolana(): InjectedProvider | null {
  const s = win().solana;
  return providerUsable(s) ? s : null;
}

export function getPhantomProvider(): InjectedProvider | null {
  startWalletStandardDiscovery();
  const w = win();
  if (providerUsable(w.phantom?.solana)) return w.phantom!.solana!;
  if (w.solana?.isPhantom && providerUsable(w.solana)) return w.solana;
  return null;
}

export function getJupiterProvider(): InjectedProvider | null {
  startWalletStandardDiscovery();
  const w = win();
  if (providerUsable(w.jupiter?.solana)) return w.jupiter!.solana!;
  if (w.jupiter && typeof w.jupiter.connect === "function") return w.jupiter;
  if (w.solana?.isJupiter && providerUsable(w.solana)) return w.solana;
  // Jupiter in-app browser injects a generic window.solana without isJupiter.
  const generic = getGenericSolana();
  if (generic && !generic.isPhantom) return generic;
  return null;
}

/** In-app browsers (Jupiter/Phantom) often expose only window.solana. */
function getInAppFallback(name: InjectWallet): InjectedProvider | null {
  const generic = getGenericSolana();
  if (!generic) return null;
  if (name === "phantom" && generic.isJupiter) return null;
  if (name === "jupiter" && generic.isPhantom) return null;
  return generic;
}

export function resolveInjectProvider(name: InjectWallet): InjectedProvider | null {
  const named = name === "phantom" ? getPhantomProvider() : getJupiterProvider();
  if (named) return named;
  return getInAppFallback(name);
}

export function isInjectWalletReady(name: InjectWallet): boolean {
  return Boolean(resolveInjectProvider(name) || findStandardWallet(name));
}

export function subscribeInjectWallets(cb: () => void): () => void {
  startWalletStandardDiscovery();
  const unsub = subscribeWalletStandard(cb);
  if (typeof window === "undefined") return unsub;
  const onEvent = () => cb();
  window.addEventListener("wallet-standard:register-wallet", onEvent);
  const id = window.setInterval(onEvent, 400);
  onEvent();
  return () => {
    unsub();
    window.removeEventListener("wallet-standard:register-wallet", onEvent);
    window.clearInterval(id);
  };
}

function readPk(value: unknown, fallback?: unknown): string | null {
  try {
    return coercePublicKey(value, fallback).toBase58();
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
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

export function injectInstallHint(name: InjectWallet): string {
  if (name === "jupiter") {
    return "Jupiter isn't detected. Unlock the Jupiter app/extension, then tap Connect again.";
  }
  return "Phantom isn't detected. Unlock the Phantom extension, then tap Connect again.";
}

export function hubWalletFromName(name?: string | null): InjectWallet | null {
  const raw = String(name || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith("jupiter") || raw.includes("mobile wallet adapter")) return "jupiter";
  if (raw.startsWith("phantom")) return "phantom";
  return null;
}

export type InjectWalletSession = {
  name: InjectWallet;
  publicKey: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
  disconnect: () => Promise<void>;
};

function detectWaitMs(): number {
  try {
    if (typeof process !== "undefined" && process.env?.VITEST) return 0;
  } catch { /* ignore */ }
  return 1500;
}

async function waitForWallet(name: InjectWallet, ms = detectWaitMs()): Promise<{
  inject: InjectedProvider | null;
  standard: ReturnType<typeof findStandardWallet>;
}> {
  startWalletStandardDiscovery();
  const deadline = Date.now() + ms;
  for (;;) {
    const inject = resolveInjectProvider(name);
    const standard = findStandardWallet(name);
    if (inject || standard) return { inject, standard };
    if (Date.now() >= deadline) return { inject: resolveInjectProvider(name), standard: findStandardWallet(name) };
    await sleep(50);
  }
}

async function connectInjectProvider(
  name: InjectWallet,
  provider: InjectedProvider,
): Promise<InjectWalletSession> {
  const label = name === "jupiter" ? "Jupiter" : "Phantom";
  let connected: unknown;
  if (typeof provider.connect === "function") {
    connected = await withTimeout(
      provider.connect(),
      20_000,
      `${label} did not respond. Unlock the extension and retry.`,
    );
  } else if (typeof provider.request === "function") {
    connected = await withTimeout(
      provider.request({ method: "connect" }).catch(() => provider.request!({ method: "solana_connect" })),
      20_000,
      `${label} did not respond. Unlock the extension and retry.`,
    );
  } else if (!readPk(provider.publicKey)) {
    throw new Error(injectInstallHint(name));
  }

  const connectedPk = connected && typeof connected === "object"
    ? (connected as { publicKey?: unknown }).publicKey
    : undefined;
  const publicKey = readPk(provider.publicKey, connectedPk);
  if (!publicKey) {
    throw new Error(`${label} connected but returned no public key — unlock the extension and retry`);
  }
  if (typeof provider.signMessage !== "function") {
    throw new Error(`${label} can't sign the login message in this tab. Open OrbitX in a normal browser window.`);
  }
  const sign = provider.signMessage.bind(provider);
  const signTx = provider.signTransaction?.bind(provider);
  const signAll = provider.signAllTransactions?.bind(provider);
  const disc = provider.disconnect?.bind(provider);
  return {
    name,
    publicKey,
    signMessage: async (message: Uint8Array) => {
      const raw = name === "phantom" ? await sign(message, "utf8") : await sign(message);
      return normalizeSignatureBytes(raw);
    },
    signTransaction: async <T>(tx: T) => {
      if (!signTx) throw new Error(`${label} can't sign transactions in this tab.`);
      return await signTx(tx) as T;
    },
    signAllTransactions: async <T>(txs: T[]) => {
      if (signAll) return await signAll(txs) as T[];
      if (!signTx) throw new Error(`${label} can't sign transactions in this tab.`);
      const out: T[] = [];
      for (const tx of txs) out.push(await signTx(tx) as T);
      return out;
    },
    disconnect: async () => {
      if (disc) await disc();
    },
  };
}

export async function connectInjectWallet(name: InjectWallet): Promise<InjectWalletSession> {
  const { inject, standard } = await waitForWallet(name);
  if (inject) return connectInjectProvider(name, inject);
  if (standard) {
    const wrapped = await connectStandardWallet(standard);
    return { name, ...wrapped };
  }
  throw new Error(injectInstallHint(name));
}

export async function signInWithInjectWallet(name: InjectWallet): Promise<{ isNew: boolean }> {
  const session = await connectInjectWallet(name);
  return signInWithWallet(session.publicKey, session.signMessage, { replaceEmailSession: true });
}
