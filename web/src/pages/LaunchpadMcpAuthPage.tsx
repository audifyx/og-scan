import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AgentLoading, AgentShell } from "@/components/agent/AgentShell";

const LAUNCHPAD_MCP_URL = "https://www.orbitx.world/api/mcp-launchpad";

/**
 * OAuth consent for the OrbitX Launchpad MCP (separate from main MCP).
 * Claude / ChatGPT / Grok Authenticate lands here for launchpad access.
 */
export default function LaunchpadMcpAuthPage() {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = params.get("redirect_uri") || "";
  const state = params.get("state") || "";
  const clientId = params.get("client_id") || "orbitx-launchpad-mcp";

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
      setError("Sign in at /auth first. Same OrbitX account.");
      return;
    }

    setSubmitting(true);
    try {
      // Call the launchpad MCP auth endpoint
      const res = await fetch("/api/orbitx-hub/launchpad-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uri: redirectUri,
          state,
          client_id: clientId,
          user_id: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authorization failed");
      window.location.href = data.redirect;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed");
      setSubmitting(false);
    }
  };

  const authCode = useMemo(() => {
    // Generate a display code for manual entry
    return user ? `LP-${user.id.slice(0, 8).toUpperCase()}` : "";
  }, [user]);

  if (authLoading) {
    return <AgentLoading label="Loading session…" />;
  }

  return (
    <AgentShell showTabs={false} statusLabel="Launchpad OAuth" statusWarn={!redirectUri}>
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">Authorize Launchpad MCP</h1>
        <p className="ox-agent__lead">
          Let {clientLabel} launch tokens via your OrbitX Launchpad. Uses your desk wallet —
          no manual signing. Revoke anytime.
        </p>
      </div>

      <section className="ox-agent__panel">
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Launchpad Connection</h2>
          <span className="ox-agent__panel-hint">separate from main MCP</span>
        </div>
        <div className="ox-agent__panel-b">
          <div className="ox-agent__row">
            <div className="ox-agent__label">MCP server</div>
            <div className="ox-agent__value" style={{ fontFamily: "monospace", fontSize: "12px" }}>
              {LAUNCHPAD_MCP_URL}
            </div>
            <span />
          </div>
          <div className="ox-agent__row">
            <div className="ox-agent__label">Client</div>
            <div className="ox-agent__value">{clientLabel}</div>
            <span />
          </div>
          {redirectUri && (
            <div className="ox-agent__row">
              <div className="ox-agent__label">Return to</div>
              <div className="ox-agent__value" style={{ fontSize: "12px" }}>{redirectUri}</div>
              <span />
            </div>
          )}

          {user && (
            <div className="ox-agent__row">
              <div className="ox-agent__label">Your code</div>
              <div className="ox-agent__value" style={{ fontFamily: "monospace" }}>{authCode}</div>
              <span />
            </div>
          )}

          {!user ? (
            <div className="ox-agent__btn-row">
              <Link className="ox-agent__btn ox-agent__btn--primary" to="/auth">
                Sign in with your OrbitX account
              </Link>
            </div>
          ) : (
            <div className="ox-agent__btn-row">
              <button
                type="button"
                className="ox-agent__btn ox-agent__btn--primary"
                disabled={submitting || !redirectUri}
                onClick={onConfirm}
              >
                {submitting ? "Connecting…" : "Authorize Launchpad"}
              </button>
            </div>
          )}

          {error && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          <p className="ox-agent__note">
            This is separate from the main OrbitX MCP. Launchpad auth only grants
            token launching and trading — not access to your main workspace.
          </p>
        </div>
      </section>
    </AgentShell>
  );
}
