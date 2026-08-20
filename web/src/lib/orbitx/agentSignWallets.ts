/**
 * Telegram /agent/sign auto-buy uses Jupiter Wallet only.
 * Never auto-open jup.ag/mobile (Loadable connect hangs). Connect only when
 * the Jupiter inject is Installed. Never wrap sign URLs in Phantom UL.
 */

export function isJupiterAdapterName(name?: string | null): boolean {
  return Boolean(name && /jupiter/i.test(name));
}

export function isPhantomAdapterName(name?: string | null): boolean {
  return Boolean(name && /phantom/i.test(name));
}

export function rankAgentSignWallet(name: string): number {
  if (isJupiterAdapterName(name)) return 0;
  if (isPhantomAdapterName(name)) return 2;
  return 1;
}

export function isInstalledWallet(readyState?: string | null): boolean {
  return String(readyState || "") === "Installed";
}

export function pickJupiterWallet<T extends { name: string; readyState?: string }>(
  wallets: readonly T[],
): T | null {
  const jup = wallets.filter((w) => isJupiterAdapterName(w.name));
  return jup.find((w) => isInstalledWallet(w.readyState)) ?? jup[0] ?? null;
}

export function sortAgentSignWallets<T extends { name: string }>(
  wallets: readonly T[],
  hidePhantom: boolean,
): T[] {
  const list = hidePhantom ? wallets.filter((w) => !isPhantomAdapterName(w.name)) : [...wallets];
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

export function shouldClearStoredPhantom(raw: string | null | undefined): boolean {
  return isPhantomAdapterName(storedAdapterName(raw));
}

export function clearStoredPhantomWallet(): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (shouldClearStoredPhantom(localStorage.getItem("walletName"))) {
      localStorage.removeItem("walletName");
    }
  } catch {
    /* private mode */
  }
}

/** Skip WalletProvider autoConnect of Phantom on Telegram auto-buy pages. */
export function shouldSkipWalletAutoConnect(
  adapterName: string,
  pathname: string,
  search: string,
): boolean {
  if (!/\/agent\/sign/i.test(pathname)) return false;
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const auto = sp.get("auto") === "1" || sp.get("auto") === "true" || sp.get("autoconfirm") === "1";
  if (!auto) return false;
  return isPhantomAdapterName(adapterName);
}

export function fetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
