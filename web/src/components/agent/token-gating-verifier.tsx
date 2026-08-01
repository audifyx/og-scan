import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import {
  AGENT_HOLD_MINT,
  AGENT_HOLD_MIN_USD,
  isTokenGateExemptWallet,
  resolveAuthWallet,
  verifyAgentHold,
  type HoldVerifyResult,
} from "@/lib/agentTokenGate";
import { linkAgentWallet } from "@/lib/orbitxMcp";
import "./agent-terminal.css";

export function TokenGatingVerifier({
  onUnlocked,
}: {
  onUnlocked?: (result: HoldVerifyResult) => void;
}) {
  const { publicKey } = useWallet();
  const { user, profile } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [last, setLast] = useState<HoldVerifyResult | null>(null);

  const walletAddress = useMemo(
    () =>
      resolveAuthWallet({
        connectedPk: publicKey?.toBase58() ?? null,
        email: user?.email,
        userMetadata: (user?.user_metadata as Record<string, unknown> | undefined) ?? null,
        profileWallet:
          (profile as { wallet_address?: string | null; sol_wallet?: string | null } | null)
            ?.wallet_address ||
          (profile as { sol_wallet?: string | null } | null)?.sol_wallet ||
          null,
      }),
    [publicKey, user?.email, user?.user_metadata, profile],
  );

  const connectWallet = async (name: string) => {
    setError(null);
    try {
      await signInWith(name, { replaceEmailSession: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  };

  const verify = async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await verifyAgentHold(walletAddress);
      setLast(result);
      if (result.meetsRequirement || result.exempt) {
        if (walletAddress) {
          try {
            await linkAgentWallet(walletAddress);
          } catch {
            /* optional */
          }
        }
        onUnlocked?.(result);
      } else {
        setError(result.message || "ORBITX hold requirement not met");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  if (isTokenGateExemptWallet(walletAddress)) {
    return (
      <div className="ox-term__loading">
        <span>unlocking exempt wallet</span>
        <span className="ox-term__cursor" />
      </div>
    );
  }

  return (
    <div className="ox-term__inner">
      <div className="ox-term__bar">
        <div className="ox-term__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="ox-term__bar-title">orbitx://agent/gate — tty</div>
        <span className="ox-term__badge">locked</span>
      </div>

      <h1 className="ox-term__brand">
        Hold required
        <span className="ox-term__cursor" aria-hidden />
      </h1>
      <p className="ox-term__sub">
        Agent MCP is gated. Hold at least ${AGENT_HOLD_MIN_USD} of ORBITX, then verify. Owner / DEF
        wallets skip this block.
      </p>

      <section className="ox-term__section">
        <div className="ox-term__section-h">
          <div className="ox-term__prompt">verify_hold</div>
          <div className="ox-term__hint">token gate</div>
        </div>
        <div className="ox-term__body">
          <div className="ox-term__row">
            <div className="ox-term__label">wallet</div>
            <div className="ox-term__value">{walletAddress || "none — connect below"}</div>
          </div>
          <div className="ox-term__row">
            <div className="ox-term__label">orbitx mint</div>
            <div className="ox-term__value">{AGENT_HOLD_MINT}</div>
            {last && !last.exempt && (
              <div className="ox-term__hint" style={{ marginTop: 6 }}>
                holding ~${Number(last.holdingUsd || 0).toFixed(2)} (
                {Number(last.holdingAmount || 0).toFixed(2)} tokens)
              </div>
            )}
          </div>

          {(error || (last && !last.meetsRequirement && last.message)) && (
            <div className="ox-term__err">{error || last?.message}</div>
          )}

          <div className="ox-term__flex">
            {!walletAddress &&
              pickable.slice(0, 4).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  className="ox-term__btn"
                  disabled={busy === w.name}
                  onClick={() => connectWallet(w.name)}
                >
                  {busy === w.name ? "connecting…" : `connect ${w.name}`}
                </button>
              ))}
            <button
              type="button"
              className="ox-term__btn ox-term__btn--fill"
              disabled={checking || !walletAddress}
              onClick={verify}
            >
              {checking ? "checking…" : "verify holdings"}
            </button>
            <a
              className="ox-term__btn"
              href={`https://jup.ag/swap/SOL-${AGENT_HOLD_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              buy orbitx
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
