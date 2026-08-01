import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { approveMcpOAuth, mcpOAuthCredentials, mcpPublicUrl } from "@/lib/orbitxMcp";
import { resolveAuthWallet } from "@/lib/agentTokenGate";
import "@/components/agent/agent-terminal.css";

/**
 * OAuth consent — terminal UI (Claude/ChatGPT Authenticate).
 */
export default function McpAuthPage() {
  const [params] = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = params.get("redirect_uri") || "";
  const state = params.get("state") || "";
  const clientId = params.get("client_id") || "orbitx-mcp";
  const codeChallenge = params.get("code_challenge") || undefined;
  const codeChallengeMethod = params.get("code_challenge_method") || undefined;
  const mcpUrl = params.get("mcp_url") || mcpPublicUrl();
  const oauth = useMemo(() => mcpOAuthCredentials(), []);

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

  const clientLabel =
    clientId.toLowerCase().includes("openai") || clientId.toLowerCase().includes("chatgpt")
      ? "ChatGPT"
      : clientId.toLowerCase().includes("anthropic") || clientId.toLowerCase().includes("claude")
        ? "Claude"
        : "your AI assistant";

  const onConfirm = async () => {
    setError(null);
    if (!redirectUri) {
      setError("Missing redirect_uri from the MCP client.");
      return;
    }
    if (!user) {
      setError("Sign in with your Solana wallet first.");
      return;
    }

    setSubmitting(true);
    try {
      const { redirect } = await approveMcpOAuth({
        redirect_uri: redirectUri,
        state,
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        ...(walletAddress ? { walletAddress } : {}),
      });
      window.location.href = redirect;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Authorization failed";
      setError(
        /token_hold|ORBITX|hold/i.test(msg)
          ? `${msg} Open /agent to verify your ORBITX hold, then try Authenticate again.`
          : msg,
      );
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="ox-term__loading">
        <span>loading session</span>
        <span className="ox-term__cursor" />
      </div>
    );
  }

  return (
    <div className="ox-term">
      <div className="ox-term__inner" style={{ maxWidth: 32 * 16 }}>
        <div className="ox-term__bar">
          <div className="ox-term__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <div className="ox-term__bar-title">orbitx://agent/mcp-auth — tty</div>
          <span className="ox-term__badge">oauth</span>
        </div>

        <h1 className="ox-term__brand">
          Authorize MCP
          <span className="ox-term__cursor" aria-hidden />
        </h1>
        <p className="ox-term__sub">
          Let {clientLabel} use your OrbitX agent — non-custodial, revoke anytime on /agent.
        </p>

        <section className="ox-term__section">
          <div className="ox-term__section-h">
            <div className="ox-term__prompt">consent</div>
            <div className="ox-term__hint">review connection</div>
          </div>
          <div className="ox-term__body">
            <div className="ox-term__row">
              <div className="ox-term__label">mcp server</div>
              <div className="ox-term__value">{mcpUrl}</div>
            </div>
            <div className="ox-term__row">
              <div className="ox-term__label">client id</div>
              <div className="ox-term__value">{clientId}</div>
            </div>
            {redirectUri ? (
              <div className="ox-term__row">
                <div className="ox-term__label">return to</div>
                <div className="ox-term__value">{redirectUri}</div>
              </div>
            ) : null}
            <div className="ox-term__row">
              <div className="ox-term__label">wallet</div>
              <div className="ox-term__value">
                {walletAddress
                  ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
                  : "not connected"}
              </div>
            </div>

            {!redirectUri && (
              <div className="ox-term__err" style={{ marginTop: 8 }}>
                missing redirect_uri — open Authenticate from ChatGPT/Claude, or copy OAuth fields
                from <Link to="/agent">/agent</Link>.
              </div>
            )}

            {!user ? (
              <div className="ox-term__flex" style={{ marginTop: 12 }}>
                {pickable.slice(0, 4).map((w) => (
                  <button
                    key={w.name}
                    type="button"
                    className="ox-term__btn"
                    disabled={busy === w.name}
                    onClick={() =>
                      signInWith(w.name, { replaceEmailSession: true }).catch((e) =>
                        setError(e.message),
                      )
                    }
                  >
                    {busy === w.name ? "connecting…" : `continue with ${w.name}`}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {!walletAddress && (
                  <p className="ox-term__sub">
                    wallet optional for auth — link later for buy/sell/claim
                  </p>
                )}
                <button
                  type="button"
                  className="ox-term__btn ox-term__btn--fill"
                  style={{ width: "100%" }}
                  disabled={submitting || !redirectUri}
                  onClick={onConfirm}
                >
                  {submitting
                    ? "connecting…"
                    : walletAddress
                      ? "authenticate & link wallet"
                      : "authenticate session"}
                </button>
              </div>
            )}

            {error && <div className="ox-term__err" style={{ marginTop: 12 }}>ERR {error}</div>}

            <p className="ox-term__footer" style={{ marginTop: 16 }}>
              revoke keys anytime on <Link to="/agent">/agent</Link>
              {!redirectUri && oauth.authorizationUrl ? (
                <span style={{ display: "block", marginTop: 6, opacity: 0.5 }}>
                  {oauth.authorizationUrl}
                </span>
              ) : null}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
