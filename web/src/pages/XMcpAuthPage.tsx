import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { approveXMcpOAuth, xMcpOAuthCredentials, xMcpPublicUrl } from "@/lib/xMcp";
import { AgentLoading, AgentShell } from "@/components/agent/AgentShell";

/**
 * OAuth consent for OrbitX X MCP — Claude / ChatGPT / Grok Authenticate lands here.
 */
export default function XMcpAuthPage() {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = params.get("redirect_uri") || "";
  const state = params.get("state") || "";
  const clientId = params.get("client_id") || "orbitx-x-mcp";
  const codeChallenge = params.get("code_challenge") || undefined;
  const codeChallengeMethod = params.get("code_challenge_method") || undefined;
  const mcpUrl = params.get("mcp_url") || xMcpPublicUrl();
  const oauth = useMemo(() => xMcpOAuthCredentials(), []);

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
      const { redirect } = await approveXMcpOAuth({
        redirect_uri: redirectUri,
        state,
        client_id: clientId,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
      });
      window.location.href = redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed");
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <AgentLoading label="Loading session…" />;
  }

  return (
    <AgentShell
      showTabs={false}
      statusLabel="X MCP consent"
      statusWarn={!redirectUri}
      brandHref="/x"
      brandSub="X MCP"
      footerBrand="OrbitX X MCP"
      mcpUrl="https://www.orbitx.world/api/x/mcp"
    >
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">Authorize X MCP</h1>
        <p className="ox-agent__lead">
          Let {clientLabel} post to your linked X account via OrbitX. Revoke anytime on /x.
        </p>
      </div>

      <section className="ox-agent__panel">
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Consent</h2>
          <span className="ox-agent__panel-hint">X posting only</span>
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

          {!redirectUri && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              Missing redirect_uri — open Authenticate from Grok/Claude/ChatGPT, or copy OAuth fields from{" "}
              <Link to="/x">/x</Link>.
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
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                disabled={submitting || !redirectUri}
                onClick={onConfirm}
              >
                {submitting ? "Connecting…" : "Authenticate X MCP"}
              </button>
            </div>
          )}

          {error && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          <p className="ox-agent__note">
            This is separate from Agent MCP on <Link to="/agent">/agent</Link>. Manage X posting on{" "}
            <Link to="/x">/x</Link>
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
