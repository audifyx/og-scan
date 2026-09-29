/**
 * Pattern-locked private vault (idea 34).
 *
 * A vault is a folder of apps hidden from every layout until the owner's
 * pattern is drawn. The pattern is stored as a salted SHA-256 hash in
 * localStorage (local device only — same convention as the agency
 * dashboard lock). Unlock lasts for the tab session.
 *
 * Vault membership lives here too so the OS home can filter vaulted
 * apps out of layouts while locked.
 */

export const VAULT_HASH_KEY = "orbitx-vault-hash";
export const VAULT_SALT_KEY = "orbitx-vault-salt";
export const VAULT_APPS_KEY = "orbitx-vault-apps";

const SESSION_KEY = "orbitx-vault-unlocked";

function rnd(n: number): string {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure-context fallback (simple FNV-1a chain, hex). Local-only anyway.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[(i * 7) % bytes.length], 0x811c9dc5) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** A pattern is an ordered list of dot indexes (0..8) on a 3x3 pad. */
export type VaultPattern = number[];

export function hasVaultPattern(): boolean {
  try {
    return !!localStorage.getItem(VAULT_HASH_KEY);
  } catch {
    return false;
  }
}

/** First draw (or re-draw) sets/confirms the pattern. Needs 2 matching draws — handled by the UI. */
export async function setVaultPattern(pattern: VaultPattern): Promise<void> {
  if (pattern.length < 4) throw new Error("Pattern needs at least 4 dots");
  const salt = rnd(16);
  const hash = await sha256Hex(salt + ":" + pattern.join(","));
  try {
    localStorage.setItem(VAULT_SALT_KEY, salt);
    localStorage.setItem(VAULT_HASH_KEY, hash);
  } catch {
    throw new Error("Storage unavailable");
  }
}

export async function checkVaultPattern(pattern: VaultPattern): Promise<boolean> {
  try {
    const salt = localStorage.getItem(VAULT_SALT_KEY) ?? "";
    const hash = localStorage.getItem(VAULT_HASH_KEY) ?? "";
    if (!salt || !hash) return false;
    return (await sha256Hex(salt + ":" + pattern.join(","))) === hash;
  } catch {
    return false;
  }
}

export async function unlockVault(pattern: VaultPattern): Promise<boolean> {
  const ok = await checkVaultPattern(pattern);
  if (ok) {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("orbitx:vault"));
  }
  return ok;
}

export function lockVault() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:vault"));
}

export function isVaultUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearVaultPattern() {
  try {
    localStorage.removeItem(VAULT_HASH_KEY);
    localStorage.removeItem(VAULT_SALT_KEY);
    localStorage.removeItem(VAULT_APPS_KEY);
  } catch {
    /* ignore */
  }
  lockVault();
}

/* ---------------- vault membership ---------------- */

function readIds(key: string): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getVaultApps(): string[] {
  return readIds(VAULT_APPS_KEY);
}

export function setVaultApps(ids: string[]) {
  try {
    localStorage.setItem(VAULT_APPS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:vault"));
}

export function isAppVaulted(appId: string): boolean {
  return getVaultApps().includes(appId);
}
