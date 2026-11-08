/**
 * SmartWalletWatch — user-added smart wallet watchlist (W4).
 *
 * The user adds any wallet address; each watched wallet is read through
 * the SAME existing wallet route the dev wallet watch uses
 * (`fetchWalletIntel` → /api/ogdex/wallet) and shows SOL balance, holding
 * % of the token in scope, and trade count. That is all the route returns
 * — there is NO win-rate or PnL here, because no source exists for those
 * and they are never invented.
 *
 * Honesty, same as the dev watch: every read is a SNAPSHOT. It does not
 * stream — hit Refresh (or re-scan) for a fresh read. The watchlist
 * persists in localStorage per device. No new API endpoint, no new DB.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchWalletIntel, type DevWalletIntel } from "../api/client";

export const SMART_WALLET_WATCH_KEY = "orbitx:smart-wallet-watch";
const MAX_WATCHED = 20;

export function isValidWalletAddress(v: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadWatchedWallets(): string[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(store.getItem(SMART_WALLET_WATCH_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w): w is string => typeof w === "string" && isValidWalletAddress(w)).slice(0, MAX_WATCHED);
  } catch {
    return [];
  }
}

export function saveWatchedWallets(wallets: string[]): void {
  try {
    safeStorage()?.setItem(SMART_WALLET_WATCH_KEY, JSON.stringify(wallets.slice(0, MAX_WATCHED)));
  } catch {
    /* storage full/blocked — in-memory state still works for the session */
  }
}

type WalletRead = {
  address: string;
  status: "loading" | "ready" | "error";
  intel: DevWalletIntel | null;
  checkedAt: number | null;
};

function shortAddr(a: string): string {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

const MUTED: React.CSSProperties = { color: "#b8b8b8", fontSize: "0.85rem" };
const INPUT_STYLE: React.CSSProperties = {
  background: "#111111",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 8,
  padding: "0.5rem 0.65rem",
  fontSize: "0.85rem",
  width: "100%",
  boxSizing: "border-box",
};
const GOLD_BTN: React.CSSProperties = {
  background: "#e8b84a",
  color: "#000000",
  border: "none",
  borderRadius: 999,
  padding: "0.45rem 0.9rem",
  fontWeight: 700,
  fontSize: "0.85rem",
  cursor: "pointer",
};
const GHOST_BTN: React.CSSProperties = {
  background: "transparent",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 999,
  padding: "0.35rem 0.7rem",
  fontSize: "0.8rem",
  cursor: "pointer",
};

export function SmartWalletWatch({ mint }: { mint?: string | null }) {
  const [wallets, setWallets] = useState<string[]>([]);
  const [reads, setReads] = useState<Record<string, WalletRead>>({});
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setWallets(loadWatchedWallets());
  }, []);

  const refreshOne = useCallback(
    async (address: string) => {
      setReads((prev) => ({
        ...prev,
        [address]: { address, status: "loading", intel: prev[address]?.intel ?? null, checkedAt: prev[address]?.checkedAt ?? null },
      }));
      const intel = await fetchWalletIntel(address, mint ?? undefined);
      setReads((prev) => ({
        ...prev,
        [address]: {
          address,
          status: intel ? "ready" : "error",
          intel: intel ?? null,
          checkedAt: Date.now(),
        },
      }));
    },
    [mint],
  );

  useEffect(() => {
    if (wallets.length === 0) return;
    for (const w of wallets) void refreshOne(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.join(","), refreshTick, mint]);

  function addWallet() {
    setError("");
    const addr = draft.trim();
    if (!isValidWalletAddress(addr)) {
      setError("Enter a valid Solana wallet address.");
      return;
    }
    if (wallets.includes(addr)) {
      setError("That wallet is already on your watchlist.");
      return;
    }
    if (wallets.length >= MAX_WATCHED) {
      setError(`Watchlist is full (${MAX_WATCHED} wallets max). Remove one first.`);
      return;
    }
    const next = [...wallets, addr];
    setWallets(next);
    saveWatchedWallets(next);
    setDraft("");
    void refreshOne(addr);
  }

  function removeWallet(addr: string) {
    const next = wallets.filter((w) => w !== addr);
    setWallets(next);
    saveWatchedWallets(next);
    setReads((prev) => {
      const copy = { ...prev };
      delete copy[addr];
      return copy;
    });
  }

  return (
    <div data-testid="smart-wallet-watch">
      <p style={{ ...MUTED, margin: "0 0 0.75rem" }}>
        Watch any wallet. Each read is a snapshot from the wallet route — it
        does not stream. Refresh for a fresh read. No win-rate or PnL is
        shown: no source exists for those.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Wallet address to watch…"
          aria-label="Wallet address to watch"
          spellCheck={false}
          style={INPUT_STYLE}
        />
        <button type="button" onClick={addWallet} style={{ ...GOLD_BTN, whiteSpace: "nowrap" }}>
          Watch wallet
        </button>
      </div>
      {error && <p style={{ color: "#ff5c5c", margin: "0 0 0.75rem", fontSize: "0.85rem" }}>{error}</p>}

      {wallets.length === 0 ? (
        <p style={{ ...MUTED, margin: 0 }}>No wallets watched yet — add one above.</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
            <button type="button" onClick={() => setRefreshTick((t) => t + 1)} style={GHOST_BTN}>
              Refresh all
            </button>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
            {wallets.map((addr) => {
              const read = reads[addr];
              const intel = read?.intel ?? null;
              return (
                <li key={addr} style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "0.6rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className="oxc-mono" style={{ fontWeight: 700, color: "#ffffff", fontSize: "0.9rem" }}>
                      {shortAddr(addr)}
                    </span>
                    <span style={{ ...MUTED, fontSize: "0.75rem" }}>{addr}</span>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => void refreshOne(addr)}
                      style={GHOST_BTN}
                      aria-label={`Refresh ${shortAddr(addr)}`}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWallet(addr)}
                      style={{ ...GHOST_BTN, color: "#ff5c5c", borderColor: "rgba(255,92,92,0.5)" }}
                      aria-label={`Stop watching ${shortAddr(addr)}`}
                    >
                      Remove
                    </button>
                  </div>
                  {read?.status === "loading" && !intel ? (
                    <p style={{ ...MUTED, margin: "0.4rem 0 0" }}>Reading wallet…</p>
                  ) : read?.status === "error" || (read?.status === "ready" && intel && !intel.available) ? (
                    <p style={{ ...MUTED, margin: "0.4rem 0 0" }}>
                      Wallet route unavailable — nothing was returned for this wallet. Refresh to retry; no balance
                      is shown rather than a guessed zero.
                    </p>
                  ) : intel ? (
                    <dl style={{ margin: "0.4rem 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.4rem 1rem" }}>
                      <div>
                        <dt style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>SOL balance</dt>
                        <dd style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>
                          {intel.solBalance != null ? `${intel.solBalance.toFixed(2)} SOL` : "Unknown"}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Holding of this token</dt>
                        <dd style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>
                          {mint == null
                            ? "Unknown — no token in scope"
                            : intel.holdingPctOfToken != null
                              ? `${intel.holdingPctOfToken.toFixed(2)}%`
                              : "Unknown"}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent trades</dt>
                        <dd style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>
                          {intel.tradeCount != null ? `${intel.tradeCount}` : "Unknown"}
                        </dd>
                      </div>
                      <div>
                        <dt style={{ ...MUTED, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Portfolio value</dt>
                        <dd style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>
                          {intel.totalUsd != null ? `$${intel.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "Unknown"}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p style={{ ...MUTED, margin: "0.4rem 0 0" }}>Reading wallet…</p>
                  )}
                  {read?.checkedAt != null && (
                    <p style={{ ...MUTED, margin: "0.4rem 0 0", fontSize: "0.75rem" }}>
                      Snapshot from {new Date(read.checkedAt).toLocaleTimeString()} — does not stream.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default SmartWalletWatch;
