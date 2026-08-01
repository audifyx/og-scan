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

  const clientLabel = clientId.toLowerCase().includes("openai") || clientId.toLowerCase().includes("chatgpt")
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
      setError(e instanceof Error ? e.message : "Authorization failed");
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05070d] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Connect OrbitX MCP</h1>
              <p className="text-sm text-white/50">Authorize {clientLabel} to use your agent</p>
            </div>
          </div>

          <div className="mb-5 space-y-2 rounded-xl border border-white/8 bg-black/30 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-white/45">MCP server</span>
              <span className="max-w-[60%] truncate font-mono text-xs text-white/80">{mcpUrl}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Client ID</span>
              <span className="max-w-[60%] truncate font-mono text-xs text-white/80">{clientId}</span>
            </div>
            {redirectUri ? (
              <div className="flex justify-between gap-3">
                <span className="text-white/45">Return to</span>
                <span className="max-w-[60%] truncate font-mono text-[10px] text-white/55">{redirectUri}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <span className="text-white/45">Wallet</span>
              <span className="font-mono text-xs text-white/80">
                {walletAddress
                  ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
                  : "Not connected"}
              </span>
            </div>
            {!redirectUri && (
              <p className="pt-1 text-[11px] text-amber-200/70">
                Missing redirect_uri — open Authenticate from ChatGPT/Claude, or paste OAuth fields from{" "}
                <Link to="/agent" className="underline">
                  /agent
                </Link>
                : auth <code className="text-white/50">{oauth.authorizationUrl}</code>
              </p>
            )}
          </div>

          {!user ? (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-white/55">Sign in with Solana to authorize Claude / ChatGPT.</p>
              {pickable.slice(0, 4).map((w) => (
                <button
                  key={w.name}
                  type="button"
                  disabled={busy === w.name}
                  onClick={() => signInWith(w.name, { replaceEmailSession: true }).catch((e) => setError(e.message))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {w.icon ? <img src={w.icon} alt="" className="h-5 w-5 rounded" /> : <Wallet className="h-4 w-4" />}
                  {busy === w.name ? `Connecting ${w.name}…` : `Continue with ${w.name}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-3 space-y-2">
              {!walletAddress && (
                <p className="text-xs text-amber-200/70">
                  Wallet optional for auth — link one for buy/sell/claim tools. You can still approve now.
                </p>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={onConfirm}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black hover:bg-emerald-300 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {submitting ? "Connecting…" : walletAddress ? "Authenticate & link wallet" : "Authenticate session"}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <p className="text-center text-xs text-white/35">
            This grants {clientLabel} access to OrbitX intel tools for your linked wallet.
            You can revoke API keys anytime on{" "}
            <Link to="/agent" className="text-emerald-400/90 underline-offset-2 hover:underline">
              /agent
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
