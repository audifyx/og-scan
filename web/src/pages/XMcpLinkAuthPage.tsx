import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { approveXMcpLinkAuth, getXMcpLinkStatus } from "@/lib/xMcp";
import { AgentLoading, AgentShell } from "@/components/agent/AgentShell";

/**
 * Clickable Grok link-auth — user opens URL from chat, signs in, authorizes OrbitX X MCP.
 */
export default function XMcpLinkAuthPage() {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [prestatus, setPrestatus] = useState<string | null>(null);

  const code = (params.get("code") || "").trim();

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    getXMcpLinkStatus(code)
      .then((s) => {
        if (cancelled) return;
        setPrestatus(s.status || null);
        if (s.status === "completed") setDone(true);
        if (s.status === "expired") setError("This link expired. Ask Grok for a new auth link.");
      })
      .catch(() => {
        /* ignore — approve will surface errors */
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const onConfirm = async () => {
    setError(null);
    if (!code) {
      setError("Missing link code. Ask Grok to send a fresh auth link.");
      return;
    }
    if (!user) {
      setError("Sign in with your Solana wallet first.");
      return;
    }
    setSubmitting(true);
    try {
      await approveXMcpLinkAuth(code);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <AgentLoading label="Loading session…" />;
  }

  return (
    <AgentShell
      showTabs={false}
      statusLabel="Grok link auth"
      statusWarn={!code}
      brandHref="/x"
      brandSub="X MCP"
      footerBrand="OrbitX X MCP"
      mcpUrl="https://www.orbitx.world/api/x/mcp"
    >
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">{done ? "Connected" : "Authorize Grok"}</h1>
        <p className="ox-agent__lead">
          {done
            ? "Return to Grok and say you’re authenticated. Grok can use your OrbitX X tools in that chat."
            : "Grok sent you this link. Sign in with OrbitX, then authorize X MCP for this chat."}
        </p>
      </div>

      <section className="ox-agent__panel">
        <div className="ox-agent__panel-h">
          <h2 className="ox-agent__panel-title">Link auth</h2>
          <span className="ox-agent__panel-hint">{prestatus || "pending"}</span>
        </div>
        <div className="ox-agent__panel-b">
          {!code && (
            <div className="ox-agent__alert">
              Missing code — ask Grok: “authenticate my OrbitX account” for a new link.
            </div>
          )}

          {done ? (
            <div className="ox-agent__btn-row">
              <Link to="/x" className="ox-agent__btn ox-agent__btn--primary">
                Open /x hub
              </Link>
            </div>
          ) : !user ? (
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
                disabled={submitting || !code}
                onClick={onConfirm}
              >
                {submitting ? "Connecting…" : "Authorize Grok"}
              </button>
            </div>
          )}

          {error && (
            <div className="ox-agent__alert" style={{ marginTop: 12 }}>
              {error}
            </div>
          )}

          <p className="ox-agent__note">
            Make sure your X account is connected on <Link to="/x">/x</Link> so Grok can post and DM.
            This is separate from Agent MCP on <Link to="/agent">/agent</Link>.
          </p>
        </div>
      </section>
    </AgentShell>
  );
}
