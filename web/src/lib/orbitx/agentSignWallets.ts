/**
 * Telegram /agent/sign auto-buy must use Phantom — never Jupiter.
 * WalletProvider autoConnect restores the last adapter from localStorage
 * (`walletName`). If that was Jupiter, connect() loads jup.ag/mobile and
 * the Phantom prompt never appears.
 */

export function isJupiterAdapterName(name?: string | null): boolean {
  return Boolean(name && /jupiter/i.test(name));
}

export function isPhantomAdapterName(name?: string | null): boolean {
  return Boolean(name && /phantom/i.test(name));
}

export function rankAgentSignWallet(name: string): number {
  if (isPhantomAdapterName(name)) return 0;
  if (isJupiterAdapterName(name)) return 2;
  return 1;
}

export function pickPhantomWallet<T extends { name: string }>(wallets: readonly T[]): T | null {
  return wallets.find((w) => isPhantomAdapterName(w.name)) ?? null;
}

export function sortAgentSignWallets<T extends { name: string }>(
  wallets: readonly T[],
  hideJupiter: boolean,
): T[] {
  const list = hideJupiter ? wallets.filter((w) => !isJupiterAdapterName(w.name)) : [...wallets];
  return [...list].sort(
    (a, b) => rankAgentSignWallet(a.name) - rankAgentSignWallet(b.name) || a.name.localeCompare(b.name),
  );
}

/** WalletProvider stores JSON.stringify(name) under `walletName`. */
export function storedAdapterName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return raw;
  }
}

export function shouldClearStoredJupiter(raw: string | null | undefined): boolean {
  return isJupiterAdapterName(storedAdapterName(raw));
}

export function clearStoredJupiterWallet(): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (shouldClearStoredJupiter(localStorage.getItem("walletName"))) {
      localStorage.removeItem("walletName");
    }
  } catch {
    /* private mode */
  }
}

/** Skip WalletProvider autoConnect of Jupiter on Telegram auto-buy pages. */
export function shouldSkipWalletAutoConnect(
  adapterName: string,
  pathname: string,
  search: string,
): boolean {
  if (!/\/agent\/sign/i.test(pathname)) return false;
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const auto = sp.get("auto") === "1" || sp.get("auto") === "true" || sp.get("autoconfirm") === "1";
  if (!auto) return false;
  return isJupiterAdapterName(adapterName);
}

export function fetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
