import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import {
  AGENT_HOLD_MINT,
  AGENT_HOLD_MIN_USD,
  isAgentHoldExempt,
  resolveAuthWallet,
  verifyAgentHold,
  type HoldVerifyResult,
} from "@/lib/agentTokenGate";
import { linkAgentWallet } from "@/lib/orbitxMcp";
import { AgentLoading } from "./AgentShell";
import "./agent-shell.css";

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

  const exempt = isAgentHoldExempt({ wallet: walletAddress, email: user?.email });

  useEffect(() => {
    if (!exempt) return;
    onUnlocked?.({
      ok: true,
      meetsRequirement: true,
      exempt: true,
      wallet: walletAddress,
      mint: AGENT_HOLD_MINT,
      minUsd: AGENT_HOLD_MIN_USD,
      message: "Owner/DEF exempt",
    });
  }, [exempt, onUnlocked, walletAddress]);

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

  if (exempt) {
    return <AgentLoading label="Unlocking exempt owner…" />;
  }

  return (
    <>
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">Hold required</h1>
        <p className="ox-agent__lead">
          Agent MCP needs at least ${AGENT_HOLD_MIN_USD} of ORBITX. Owner and DEF wallets skip this
          gate.
        </p>
      </div>

      <section className="ox-agent__panel">
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Verify hold</h2>
          <span className="ox-agent__panel-hint">token gate</span>
        </div>
        <div className="ox-agent__panel-b">
          <div className="ox-agent__row">
            <div className="ox-agent__label">Wallet</div>
            <div className="ox-agent__value">{walletAddress || "None — connect below"}</div>
            <span />
          </div>
          <div className="ox-agent__row">
            <div className="ox-agent__label">ORBITX mint</div>
            <div className="ox-agent__value">{AGENT_HOLD_MINT}</div>
            <span />
          </div>
          {last && !last.exempt && (
            <p className="ox-agent__note">
              Holding ~${Number(last.holdingUsd || 0).toFixed(2)} (
              {Number(last.holdingAmount || 0).toFixed(2)} tokens)
            </p>
          )}

          {(error || (last && !last.meetsRequirement && last.message)) && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              {error || last?.message}
            </div>
          )}

          <div className="ox-agent__btn-row">
            {!walletAddress &&
              pickable.slice(0, 4).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  className="ox-agent__btn"
                  disabled={busy === w.name}
                  onClick={() => connectWallet(w.name)}
                >
                  {busy === w.name ? "Connecting…" : `Connect ${w.name}`}
                </button>
              ))}
            <button
              type="button"
              className="ox-agent__btn ox-agent__btn--primary"
              disabled={checking || !walletAddress}
              onClick={verify}
            >
              {checking ? "Checking…" : "Verify holdings"}
            </button>
            <a
              className="ox-agent__btn"
              href={`https://jup.ag/swap/SOL-${AGENT_HOLD_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy ORBITX
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
