import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { approveMcpOAuth, mcpOAuthCredentials, mcpPublicUrl } from "@/lib/orbitxMcp";
import { resolveAuthWallet } from "@/lib/agentTokenGate";
import { AgentLoading, AgentShell } from "@/components/agent/AgentShell";

/**
 * OAuth consent — Claude / ChatGPT / Grok Authenticate lands here.
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

  const cid = clientId.toLowerCase();
  const clientLabel =
    cid.includes("openai") || cid.includes("chatgpt")
      ? "ChatGPT"
      : cid.includes("anthropic") || cid.includes("claude")
        ? "Claude"
        : cid.includes("grok") || cid.includes("xai") || cid.includes("x.ai")
          ? "Grok"
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
          ? `${msg} Open Super Computer Setup to verify your ORBITX hold, then try Authenticate again.`
          : msg,
      );
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <AgentLoading label="Loading session…" />;
  }

  return (
    <AgentShell showTabs={false} statusLabel="OAuth consent" statusWarn={!redirectUri}>
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">Authorize MCP</h1>
        <p className="ox-agent__lead">
          Let {clientLabel} use your OrbitX workspace. Non-custodial — revoke anytime from Super Computer Setup.
        </p>
      </div>

      <section className="ox-agent__panel">
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Consent</h2>
          <span className="ox-agent__panel-hint">review connection</span>
        </div>
        <div className="ox-agent__panel-b">
          <div className="ox-agent__row">
            <div className="ox-agent__label">MCP server</div>
            <div className="ox-agent__value">{mcpUrl}</div>
            <span />
          </div>
          <div className="ox-agent__row">
            <div className="ox-agent__label">Client ID</div>
            <div className="ox-agent__value">{clientId}</div>
            <span />
          </div>
          {redirectUri ? (
            <div className="ox-agent__row">
              <div className="ox-agent__label">Return to</div>
              <div className="ox-agent__value">{redirectUri}</div>
              <span />
            </div>
          ) : null}
          <div className="ox-agent__row">
            <div className="ox-agent__label">Wallet</div>
            <div className="ox-agent__value">
              {walletAddress
                ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
                : "Not connected"}
            </div>
            <span />
          </div>

          {!redirectUri && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              Missing redirect_uri — open Authenticate from Grok/Claude/ChatGPT, or copy OAuth fields from{" "}
              <Link to="/supercomputer?tab=setup">Super Computer Setup</Link>.
            </div>
          )}

          {!user ? (
            <div className="ox-agent__btn-row">
              {pickable.slice(0, 4).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  className="ox-agent__btn ox-agent__btn--primary"
                  disabled={busy === w.name}
                  onClick={() =>
                    signInWith(w.name, { replaceEmailSession: true }).catch((e) =>
                      setError(e.message),
                    )
                  }
                >
                  {busy === w.name ? "Connecting…" : `Continue with ${w.name}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="ox-agent__btn-row">
              {!walletAddress && (
                <p className="ox-agent__note" style={{ width: "100%", marginTop: 0 }}>
                  Wallet optional for auth — link later for buy/sell/claim.
                </p>
              )}
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                disabled={submitting || !redirectUri}
                onClick={onConfirm}
              >
                {submitting
                  ? "Connecting…"
                  : walletAddress
                    ? "Authenticate & link wallet"
                    : "Authenticate session"}
              </button>
            </div>
          )}

          {error && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          <p className="ox-agent__note">
            Revoke keys anytime from <Link to="/supercomputer?tab=workspace&focus=keys">Super Computer Keys</Link>
            {!redirectUri && oauth.authorizationUrl ? (
              <span style={{ display: "block", marginTop: 6, opacity: 0.6 }}>
                {oauth.authorizationUrl}
              </span>
            ) : null}
          </p>
        </div>
      </section>
    </AgentShell>
  );
}
