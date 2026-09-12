import { Loader2, Wallet } from "lucide-react";
import { startSignInWithX } from "@/lib/xOAuth";
import type { LaunchIdentity } from "@/lib/launchpad/types";
import { canLaunch, launchGateReason } from "@/lib/launchpad/auth";
import { shortAddr } from "@/pages/orbitx/_shared";

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function AuthSheet({
  identity,
  connectingWallet,
  onConnectWallet,
  compact,
}: {
  identity: LaunchIdentity | null;
  connectingWallet?: boolean;
  onConnectWallet: () => void;
  compact?: boolean;
}) {
  const ready = canLaunch(identity);
  const reason = launchGateReason(identity);
  const xDone = Boolean(identity?.x_user_id);
  const wDone = Boolean(identity?.wallet_pubkey);

  return (
    <div className={`lp-auth ${compact ? "lp-auth--compact" : ""}`}>
      <div className="lp-auth-kicker">Identity · X then wallet</div>
      <div className="lp-auth-grid">
        <div className={`lp-auth-pane ${xDone ? "lp-auth-pane--on" : ""}`}>
          <div className="lp-auth-step">A</div>
          <div>
            <div className="lp-auth-title">Authenticate with X</div>
            <p className="lp-auth-copy">
              {xDone ? `@${identity?.x_handle || "linked"}` : "Creates the pad profile. No email, no guest create."}
            </p>
          </div>
          {xDone ? (
            <span className="lp-auth-done">Linked</span>
          ) : (
            <button
              type="button"
              className="lp-auth-btn"
              onClick={() => void startSignInWithX("/orbitxlaunch/create")}
            >
              <XMark className="h-3.5 w-3.5" /> Continue with X
            </button>
          )}
        </div>
        <div className={`lp-auth-pane ${wDone ? "lp-auth-pane--on" : ""}`}>
          <div className="lp-auth-step">B</div>
          <div>
            <div className="lp-auth-title">Prove wallet</div>
            <p className="lp-auth-copy">
              {wDone
                ? shortAddr(identity?.wallet_pubkey, 4)
                : "Sign in with Solana. One wallet cannot sit on two X accounts."}
            </p>
          </div>
          {wDone ? (
            <span className="lp-auth-done">Linked</span>
          ) : (
            <button type="button" className="lp-auth-btn" onClick={onConnectWallet} disabled={connectingWallet}>
              {connectingWallet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
              Prove wallet
            </button>
          )}
        </div>
      </div>
      {!ready && <p className="lp-auth-gate">{reason}</p>}
    </div>
  );
}
