/**
 * useOrbitxBilling — the shared ORBITX billing primitive.
 *
 * Contract (locked with the game core team):
 *   ready:   boolean  — auth-once complete, backend spendable
 *   balance: number|null — on-chain ORBITX in the in-app (desk) wallet
 *   spend:   ({amount, reason, ref}) => Promise<{signature}> — backend-signed burn
 *   beginAuth: () => void — kicks the dashboard auth-code flow if not authed
 *
 * Every spend is a backend-signed ORBITX burn (orbitx_app_burn →
 * createBurnInstruction → signAndSendUserTx). No signing popups, ever.
 * The game team and all module teams build on this hook — do not change
 * its shape without coordinating.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import {
  clearBillingAuth,
  getBillingAuthCode,
  requestBillingAuth,
} from "./auth";
import { burnOrbitxViaDesk, fetchDeskWallet } from "./mcpClient";
import {
  BILLING_LEDGER_KEY,
  ORBITX_MINT,
} from "./constants";
import { browserWalletRpcUrl } from "@/lib/solanaRpc";

export type SpendArgs = {
  /** Whole ORBITX tokens to burn. */
  amount: number;
  /** Namespaced reason, e.g. "city-bank:tattoo" (see spendReason). */
  reason: string;
  /** Idempotency / ledger ref. Auto-generated when omitted. */
  ref?: string;
};

export type SpendLedgerEntry = SpendArgs & {
  signature: string;
  at: number;
};

function readLedger(): SpendLedgerEntry[] {
  try {
    const raw = localStorage.getItem(BILLING_LEDGER_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function appendLedger(entry: SpendLedgerEntry): void {
  try {
    const next = [entry, ...readLedger()].slice(0, 200);
    localStorage.setItem(BILLING_LEDGER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getSpendLedger(): SpendLedgerEntry[] {
  return readLedger();
}

async function fetchOrbitxBalance(deskPubkey: string): Promise<number | null> {
  try {
    const conn = new Connection(browserWalletRpcUrl(), "confirmed");
    const ata = await getAssociatedTokenAddress(
      new PublicKey(ORBITX_MINT),
      new PublicKey(deskPubkey),
    );
    const bal = await conn.getTokenAccountBalance(ata, "confirmed");
    return Number(bal.value.uiAmount ?? 0);
  } catch {
    return null;
  }
}

export function useOrbitxBilling(): {
  ready: boolean;
  balance: number | null;
  /** Desk wallet address once resolved (null until auth + wallet lookup). */
  wallet: string | null;
  spend: (opts: SpendArgs) => Promise<{ signature: string }>;
  beginAuth: () => void;
  /** Forget the stored authCode (user re-links). */
  resetAuth: () => void;
  /** Last auth/burn error, for UI display. */
  error: string | null;
  /** Re-read desk wallet + balance. */
  refresh: () => void;
} {
  const [authCode, setAuthCode] = useState<string | null>(() => getBillingAuthCode());
  const [wallet, setWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const authInFlight = useRef(false);

  const ready = Boolean(authCode);

  const beginAuth = useCallback(() => {
    if (authInFlight.current) return;
    authInFlight.current = true;
    setError(null);
    requestBillingAuth()
      .then((code) => setAuthCode(code))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        authInFlight.current = false;
      });
  }, []);

  const resetAuth = useCallback(() => {
    clearBillingAuth();
    setAuthCode(null);
    setWallet(null);
    setBalance(null);
    setError(null);
  }, []);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  // Resolve desk wallet + ORBITX balance whenever auth is present.
  useEffect(() => {
    if (!authCode) {
      setWallet(null);
      setBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await fetchDeskWallet(authCode);
        if (cancelled) return;
        if (!info.ok || !info.exists || !info.publicKey) {
          setError(
            info.error === "auth_required"
              ? "Billing auth expired — link again to continue spending."
              : info.message || "No in-app wallet found for this auth.",
          );
          if (info.error === "auth_required") {
            clearBillingAuth();
            setAuthCode(null);
          }
          return;
        }
        setWallet(info.publicKey);
        const bal = await fetchOrbitxBalance(info.publicKey);
        if (!cancelled) setBalance(bal);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authCode, nonce]);

  const spend = useCallback(
    async (opts: SpendArgs): Promise<{ signature: string }> => {
      const code = getBillingAuthCode();
      if (!code) {
        throw new Error("auth_required: call beginAuth() first — one dashboard link, then spends are seamless.");
      }
      const amount = Math.floor(Number(opts.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Spend amount must be a positive whole number of ORBITX.");
      }
      const ref = opts.ref || (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ref-${Date.now()}-${Math.floor(Math.random() * 1e9)}`);
      const res = await burnOrbitxViaDesk({ authCode: code, amount });
      if (!res.ok || !res.signature) {
        throw new Error(res.message || res.error || "Burn failed.");
      }
      appendLedger({ amount, reason: opts.reason, ref, signature: res.signature, at: Date.now() });
      // Refresh balance in the background.
      setNonce((n) => n + 1);
      return { signature: res.signature };
    },
    [],
  );

  return useMemo(
    () => ({ ready, balance, wallet, spend, beginAuth, resetAuth, error, refresh }),
    [ready, balance, wallet, spend, beginAuth, resetAuth, error, refresh],
  );
}
