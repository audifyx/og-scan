import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { approveMcpOAuth, mcpOAuthCredentials, mcpPublicUrl } from "@/lib/orbitxMcp";
import { resolveAuthWallet } from "@/lib/agentTokenGate";

/**
 * OAuth consent page opened by Claude/ChatGPT Authenticate.
 * Query: redirect_uri, state, client_id, code_challenge, code_challenge_method
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
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-white/50">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(52,211,153,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 0%, rgba(212,165,116,0.08), transparent 50%), linear-gradient(180deg, #070a12 0%, #05070d 45%, #05070d 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="mb-6 text-center">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400/80">
            OrbitX Agent
          </p>
          <h1 className="text-3xl font-black tracking-tight">Authorize MCP</h1>
          <p className="mt-2 text-sm text-white/45">
            Let {clientLabel} use your OrbitX agent — non-custodial, revoke anytime.
          </p>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Consent</p>
              <p className="text-[11px] text-white/35">Review connection details</p>
            </div>
          </div>

          <div className="mb-5 space-y-2.5 rounded-2xl border border-white/[0.06] bg-black/35 p-4 text-sm">
            <Row label="MCP server" value={mcpUrl} mono />
            <Row label="Client ID" value={clientId} mono />
            {redirectUri ? <Row label="Return to" value={redirectUri} mono small /> : null}
            <Row
              label="Wallet"
              value={
                walletAddress
                  ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
                  : "Not connected"
              }
              mono
            />
            {!redirectUri && (
              <p className="pt-1 text-[11px] leading-relaxed text-amber-200/70">
                Missing redirect_uri — open Authenticate from ChatGPT/Claude, or copy OAuth fields from{" "}
                <Link to="/agent" className="text-emerald-300 underline-offset-2 hover:underline">
                  /agent
                </Link>
                .
              </p>
            )}
          </div>

          {!user ? (
            <div className="mb-4 space-y-2">
              <p className="mb-3 text-sm text-white/50">Sign in with Solana to continue.</p>
              {pickable.slice(0, 4).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  disabled={busy === w.name}
                  onClick={() =>
                    signInWith(w.name, { replaceEmailSession: true }).catch((e) => setError(e.message))
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold hover:bg-white/[0.04] disabled:opacity-50"
                >
                  {w.icon ? (
                    <img src={w.icon} alt="" className="h-5 w-5 rounded" />
                  ) : (
                    <Wallet className="h-4 w-4" />
                  )}
                  {busy === w.name ? `Connecting ${w.name}…` : `Continue with ${w.name}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-3 space-y-3">
              {!walletAddress && (
                <p className="rounded-xl border border-amber-400/15 bg-amber-400/8 px-3 py-2 text-[11px] text-amber-100/75">
                  Wallet optional for auth — link one later for buy/sell/claim. You can approve now.
                </p>
              )}
              <button
                type="button"
                disabled={submitting || !redirectUri}
                onClick={onConfirm}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3.5 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {submitting
                  ? "Connecting…"
                  : walletAddress
                    ? "Authenticate & link wallet"
                    : "Authenticate session"}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <p className="text-center text-[11px] leading-relaxed text-white/30">
            Grants {clientLabel} access to OrbitX tools for your agent. Revoke keys anytime on{" "}
            <Link to="/agent" className="text-emerald-400/90 underline-offset-2 hover:underline">
              MCP Control
            </Link>
            .
            {!redirectUri && oauth.authorizationUrl ? (
              <span className="mt-1 block truncate font-mono text-[10px] text-white/20">
                {oauth.authorizationUrl}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-white/35">
        {label}
      </span>
      <span
        className={`max-w-[62%] text-right text-white/80 ${mono ? "break-all font-mono" : ""} ${
          small ? "text-[10px] text-white/50" : "text-xs"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
