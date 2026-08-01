import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Plug,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { isTokenGateExemptWallet, resolveAuthWallet } from "@/lib/agentTokenGate";
import {
  bootstrapAgent,
  chatgptConnectUrl,
  claudeConnectUrl,
  createAgentApiKey,
  linkAgentWallet,
  listAgentApiKeys,
  mcpPublicUrl,
  revokeAgentApiKey,
  shortKey,
  type AgentBootstrap,
} from "@/lib/orbitxMcp";

export function AgentDashboard() {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const [boot, setBoot] = useState<AgentBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Claude / ChatGPT");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [chatgptGuide, setChatgptGuide] = useState(false);
  const [linking, setLinking] = useState(false);

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

  const mcpUrl = mcpPublicUrl();
  const exempt = isTokenGateExemptWallet(walletAddress);
  const linkedWallet = boot?.agent.walletAddress || walletAddress;
  const hasKey = Boolean(revealedKey || (boot?.keys?.length ?? 0) > 0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bootstrapAgent();
      setBoot(data);
      if (data.mintedKey?.key) {
        setRevealedKey(data.mintedKey.key);
        try {
          localStorage.setItem("agent_api_key", data.mintedKey.key);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  const onCreateKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const minted = await createAgentApiKey(keyName.trim() || "MCP Key");
      setRevealedKey(minted.key);
      try {
        localStorage.setItem("agent_api_key", minted.key);
      } catch {
        /* ignore */
      }
      const keys = await listAgentApiKeys();
      setBoot((prev) =>
        prev
          ? { ...prev, keys: keys.keys, mintedKey: minted }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const onRevoke = async (id: string) => {
    try {
      await revokeAgentApiKey(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    }
  };

  const onLinkWallet = async () => {
    if (!walletAddress) return;
    setLinking(true);
    setError(null);
    try {
      await linkAgentWallet(walletAddress, boot?.agent.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link wallet");
    } finally {
      setLinking(false);
    }
  };

  const openClaude = async () => {
    if (revealedKey) await copy("key", revealedKey);
    else await copy("mcp", mcpUrl);
    window.open(claudeConnectUrl(mcpUrl), "_blank", "noopener,noreferrer");
  };

  const openChatgpt = async () => {
    if (revealedKey) await copy("key", revealedKey);
    else await copy("mcp", mcpUrl);
    setChatgptGuide(true);
    window.open(chatgptConnectUrl(), "_blank", "noopener,noreferrer");
  };

  const stepDone = {
    wallet: Boolean(linkedWallet),
    key: hasKey,
    mcp: hasKey && Boolean(linkedWallet),
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/60">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">OrbitX Agent MCP</h1>
          <p className="mt-1 text-sm text-white/50">
            Link your wallet, create an API key, then one-click add to Claude or ChatGPT.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Progress */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { ok: stepDone.wallet, label: "1. Wallet" },
          { ok: stepDone.key, label: "2. API key" },
          { ok: stepDone.mcp, label: "3. Connect MCP" },
        ].map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border px-3 py-2 text-center text-xs font-bold ${
              s.ok
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-white/40"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          {(error.includes("agents") || error.includes("schema") || error.includes("relation")) && (
            <p className="mt-1 text-xs text-red-200/70">
              Apply SQL from <code className="font-mono">sql/Aug_SQL/</code> in Supabase if tables are missing.
            </p>
          )}
        </div>
      )}

      {/* Step 1 — Wallet */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Wallet className="h-4 w-4 text-emerald-400" />
          Wallet
          {exempt && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
              DEF exempt
            </span>
          )}
        </div>
        {linkedWallet ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <code className="rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-white/80">
              {linkedWallet}
            </code>
            {walletAddress && walletAddress !== boot?.agent.walletAddress && (
              <button
                type="button"
                disabled={linking}
                onClick={onLinkWallet}
                className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
              >
                {linking ? "Linking…" : "Link this wallet"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-white/50">Connect Solana to authorize MCP.</p>
            {pickable.slice(0, 4).map((w) => (
              <button
                key={w.name}
                type="button"
                disabled={busy === w.name}
                onClick={() =>
                  signInWith(w.name, { replaceEmailSession: true })
                    .then(() => refresh())
                    .catch((e) => setError(e.message))
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"
              >
                {w.icon ? <img src={w.icon} alt="" className="h-5 w-5 rounded" /> : null}
                {busy === w.name ? `Connecting ${w.name}…` : `Connect ${w.name}`}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 2 — API keys */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <KeyRound className="h-4 w-4 text-emerald-400" />
          API key
        </div>

        {revealedKey && (
          <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
              Copy now — shown once
            </p>
            <code className="mb-3 block break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs">
              {revealedKey}
            </code>
            <button
              type="button"
              onClick={() => copy("key", revealedKey)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-black"
            >
              {copied === "key" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "key" ? "Copied" : "Copy key"}
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400/40"
          />
          <button
            type="button"
            disabled={creating}
            onClick={onCreateKey}
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create API key"}
          </button>
        </div>

        <div className="space-y-2">
          {(boot?.keys || []).length === 0 ? (
            <p className="text-sm text-white/40">No active keys yet.</p>
          ) : (
            boot?.keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/25 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold">{k.name}</p>
                  <p className="text-[11px] text-white/35">
                    Created {new Date(k.createdAt).toLocaleString()}
                    {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(k.id)}
                  className="rounded-lg p-2 text-red-300/80 hover:bg-red-500/10"
                  title="Revoke"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Step 3 — MCP + one-click */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Plug className="h-4 w-4 text-emerald-400" />
          MCP setup
        </div>

        <p className="mb-2 text-xs text-white/40">MCP server URL</p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all rounded-xl bg-black/40 px-3 py-2 font-mono text-xs text-white/80">
            {mcpUrl}
          </code>
          <button
            type="button"
            onClick={() => copy("mcp", mcpUrl)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5"
          >
            {copied === "mcp" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={openClaude}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#d4a574] px-4 py-3 text-sm font-bold text-black hover:brightness-110"
          >
            Add to Claude <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={openChatgpt}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black hover:bg-white/90"
          >
            Add to ChatGPT <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>

        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs text-white/45">
          <li>Create an API key above (copied when you click Add).</li>
          <li>Confirm the connector in Claude / ChatGPT with the MCP URL.</li>
          <li>
            Click <span className="text-white/70">Authenticate</span> — you&apos;ll return here to link your
            wallet, then the MCP is connected.
          </li>
          <li>
            Or paste <code className="font-mono text-white/60">Authorization: Bearer {"<key>"}</code> in
            request headers.
          </li>
        </ol>

        {revealedKey && (
          <p className="mt-3 text-[11px] text-white/35">
            Active key preview: <span className="font-mono text-white/55">{shortKey(revealedKey)}</span>
          </p>
        )}
      </section>

      {chatgptGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setChatgptGuide(false)}>
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c111a] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-bold">Add OrbitX in ChatGPT</h3>
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-white/65">
              <li>Enable Developer mode (Settings → Security).</li>
              <li>Create a connector / MCP app and paste the MCP URL (copied).</li>
              <li>Click Authenticate — link your wallet on OrbitX.</li>
              <li>Or add header Authorization Bearer with your API key.</li>
            </ol>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copy("mcp", mcpUrl)}
                className="flex-1 rounded-xl border border-white/10 py-2 text-sm font-semibold"
              >
                Copy MCP URL
              </button>
              <button
                type="button"
                onClick={() => setChatgptGuide(false)}
                className="flex-1 rounded-xl bg-white py-2 text-sm font-bold text-black"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
