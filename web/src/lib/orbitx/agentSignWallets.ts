/**
 * /supercomputer/sign: Jupiter Wallet in-app + browser extensions (Phantom, Solflare, …).
 * Never Phantom Connect universal links. Telegram in-app cannot sign.
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

/** Sell amounts are "50%" / "100%". URL encoding can leave "100%25". */
export function parseAgentSignTradeAmount(action: string, raw: string): string | number {
  const t = String(raw || "").trim();
  if (action === "sell") {
    let s = t;
    try {
      s = decodeURIComponent(s);
    } catch {
      s = t.replace(/%25/gi, "%");
    }
    const pct = s.match(/^(\d+(?:\.\d+)?)\s*%+/);
    if (pct) return `${pct[1]}%`;
    if (/%/.test(t)) {
      const n = s.match(/^(\d+(?:\.\d+)?)/);
      if (n) return `${n[1]}%`;
    }
  }
  const n = Number(t);
  return n;
}

export function pickJupiterWallet<T extends { name: string }>(wallets: readonly T[]): T | null {
  return wallets.find((w) => isJupiterAdapterName(w.name)) ?? null;
}

export function pickAutoSignWallet<T extends { name: string }>(wallets: readonly T[]): T | null {
  return pickJupiterWallet(wallets) || wallets[0] || null;
}

export function pickPhantomWallet<T extends { name: string }>(wallets: readonly T[]): T | null {
  return wallets.find((w) => isPhantomAdapterName(w.name)) ?? null;
}

export function isTelegramWebView(ua?: string | null): boolean {
  const raw = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (/telegram/i.test(raw)) return true;
  try {
    return Boolean((window as Window & { TelegramWebviewProxy?: unknown }).TelegramWebviewProxy);
  } catch {
    return false;
  }
}

export function sortAgentSignWallets<T extends { name: string }>(
  wallets: readonly T[],
  hidePhantom = false,
): T[] {
  const list = hidePhantom ? wallets.filter((w) => !isPhantomAdapterName(w.name)) : [...wallets];
  return [...list].sort(
    (a, b) => rankAgentSignWallet(a.name) - rankAgentSignWallet(b.name) || a.name.localeCompare(b.name),
  );
}

/** WalletProvider stores JSON.stringify(name) under `walletName`. */
export function storedAdapterName(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
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

export function shouldClearStoredJupiter(raw: string | null | undefined): boolean {
  return isJupiterAdapterName(storedAdapterName(raw));
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

/** Kept for tests / other callers — auto-sign must not clear Jupiter. */
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

/**
 * Skip WalletProvider autoConnect of Phantom inside Telegram's in-app browser
 * (that path used to open Phantom Connect UL). Desktop Chrome + Phantom
 * extension must auto-connect. Never skip Jupiter.
 */
export function shouldSkipWalletAutoConnect(
  adapterName: string,
  pathname: string,
  search: string,
  ua?: string | null,
): boolean {
  if (!/\/supercomputer\/sign/i.test(pathname)) return false;
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const auto = sp.get("auto") === "1" || sp.get("auto") === "true" || sp.get("autoconfirm") === "1";
  if (!auto) return false;
  if (isJupiterAdapterName(adapterName)) return false;
  return isPhantomAdapterName(adapterName) && isTelegramWebView(ua);
}

export function fetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}
