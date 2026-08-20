import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { approveMcpLinkAuth, getMcpLinkStatus } from "@/lib/orbitxMcp";
import { resolveAuthWallet } from "@/lib/agentTokenGate";
import { AgentLoading, AgentShell } from "@/components/agent/AgentShell";
import {
  classifyOrbitXAuthPaste,
  normalizeTelegramLoginCode,
} from "../../api/orbitx/orbitx-auth-links.js";

/** Clickable Grok link-auth for OrbitX Agent MCP. */
export default function AgentLinkAuthPage() {
  const [params] = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [prestatus, setPrestatus] = useState<string | null>(null);

  const rawCode = (params.get("code") || "").trim();
  const pasted = classifyOrbitXAuthPaste(
    rawCode || (typeof window !== "undefined" ? window.location.href : ""),
  );
  const telegramCode =
    pasted.kind === "telegram_login"
      ? pasted.code
      : /^oxlink/i.test(rawCode)
        ? ""
        : normalizeTelegramLoginCode(rawCode);
  const code = telegramCode ? "" : rawCode;
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

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    getMcpLinkStatus(code)
      .then((s) => {
        if (cancelled) return;
        setPrestatus(s.status || null);
        if (s.status === "completed") setDone(true);
        if (s.status === "expired") setError("This link expired. Ask Grok for a new auth link.");
      })
      .catch(() => {});
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
      await approveMcpLinkAuth(code, walletAddress || undefined);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (telegramCode) {
    return <Navigate to={`/telegram?code=${encodeURIComponent(telegramCode)}`} replace />;
  }

  if (authLoading) return <AgentLoading label="Loading session…" />;

  return (
    <AgentShell
      showTabs={false}
      statusLabel="Grok link auth"
      statusWarn={!code}
      brandHref="/agent"
      brandSub="Agent MCP"
      footerBrand="OrbitX Agent MCP"
      mcpUrl="https://www.orbitx.world/api/mcp"
    >
      <div className="ox-agent__hero">
        <h1 className="ox-agent__title">{done ? "Connected" : "Authorize Grok"}</h1>
        <p className="ox-agent__lead">
          {done
            ? "Return to Grok and say you’re authenticated. Grok can use OrbitX Agent tools in that chat."
            : "Grok sent you this link. Sign in with OrbitX, then authorize Agent MCP for this chat."}
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
              <Link to="/agent" className="ox-agent__btn ox-agent__btn--primary">
                Open /agent
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
            Manage keys on <Link to="/agent">/agent</Link>. X posting MCP is separate on{" "}
            <Link to="/x">/x</Link>.
          </p>
        </div>
      </section>
    </AgentShell>
  );
}
