/**
 * Phantom + Jupiter login via the extension inject APIs.
 * Does not use @solana/wallet-adapter — that path reported "connected" with no key.
 */
import { coercePublicKey, normalizeSignatureBytes } from "@/lib/wallets/walletNormalize";
import { signInWithWallet } from "@/lib/walletAuth";

export type InjectWallet = "phantom" | "jupiter";

type InjectedProvider = {
  isPhantom?: boolean;
  isJupiter?: boolean;
  publicKey?: unknown;
  connect?: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: unknown } | void>;
  signMessage?: (message: Uint8Array, encoding?: string) => Promise<unknown>;
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

export function getPhantomProvider(): InjectedProvider | null {
  const w = win();
  if (w.phantom?.solana) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

export function getJupiterProvider(): InjectedProvider | null {
  const w = win();
  if (w.jupiter?.solana) return w.jupiter.solana;
  if (w.jupiter && typeof w.jupiter.connect === "function") return w.jupiter;
  if (w.solana?.isJupiter) return w.solana;
  return null;
}

export function isInjectWalletReady(name: InjectWallet): boolean {
  const provider = name === "phantom" ? getPhantomProvider() : getJupiterProvider();
  return Boolean(provider && typeof provider.connect === "function");
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

export function injectInstallHint(name: InjectWallet): string {
  if (name === "jupiter") {
    return "Jupiter isn't detected. Install the Jupiter Wallet extension, then refresh.";
  }
  return "Phantom isn't detected. Install the Phantom extension, then refresh.";
}

export async function connectInjectWallet(name: InjectWallet): Promise<{
  publicKey: string;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}> {
  const label = name === "jupiter" ? "Jupiter" : "Phantom";
  const provider = name === "phantom" ? getPhantomProvider() : getJupiterProvider();
  if (!provider || typeof provider.connect !== "function") {
    throw new Error(injectInstallHint(name));
  }

  const connected = await withTimeout(
    provider.connect(),
    20_000,
    `${label} did not respond. Unlock the extension and retry.`,
  );
  const publicKey = readPk(provider.publicKey, connected && typeof connected === "object" ? (connected as { publicKey?: unknown }).publicKey : undefined);
  if (!publicKey) {
    throw new Error(`${label} connected but returned no public key — unlock the extension and retry`);
  }
  if (typeof provider.signMessage !== "function") {
    throw new Error(`${label} can't sign the login message in this tab. Open OrbitX in a normal browser window.`);
  }
  const sign = provider.signMessage.bind(provider);
  return {
    publicKey,
    signMessage: async (message: Uint8Array) => {
      const raw = name === "phantom" ? await sign(message, "utf8") : await sign(message);
      return normalizeSignatureBytes(raw);
    },
  };
}

export async function signInWithInjectWallet(name: InjectWallet): Promise<{ isNew: boolean }> {
  const session = await connectInjectWallet(name);
  return signInWithWallet(session.publicKey, session.signMessage, { replaceEmailSession: true });
}
