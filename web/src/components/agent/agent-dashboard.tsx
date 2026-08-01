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
  mcpOAuthCredentials,
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
  const oauth = useMemo(() => mcpOAuthCredentials(), []);
  const exempt = isTokenGateExemptWallet(walletAddress);
  const linkedWallet = boot?.agent.walletAddress || walletAddress;
  const hasKey = Boolean(revealedKey || (boot?.keys?.length ?? 0) > 0);
  const bearerToken = revealedKey;
  const bearerHeader = bearerToken ? `Bearer ${bearerToken}` : "";

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
      } else {
        try {
          const cached = localStorage.getItem("agent_api_key");
          if (cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) {
            setRevealedKey((prev) => prev || cached);
          }
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
    try {
      const cached = localStorage.getItem("agent_api_key");
      if (cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) {
        setRevealedKey(cached);
      }
    } catch {
      /* ignore */
    }
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
            Link your wallet, create an API key, then connect Claude or ChatGPT — DEX buy/sell,
            launch, claim fees, rent refund, burn, NFT market, and OrbitX communities.
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
          {(error.includes("FUNCTION_INVOCATION") || error.includes("restarting") || error.includes("500")) && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-red-200/80">
              <button
                type="button"
                onClick={() => refresh()}
                className="rounded-lg border border-red-300/30 px-2 py-1 font-semibold hover:bg-red-500/20"
              >
                Retry now
              </button>
              <span>Claude MCP URL: https://orbitx.world/api/mcp</span>
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

      {/* Step 3 — MCP + OAuth credentials */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Plug className="h-4 w-4 text-emerald-400" />
          MCP + OAuth credentials
        </div>
        <p className="mb-4 text-xs text-white/45">
          ChatGPT asks for these when you add a custom MCP connector. Copy each field — leave Client Secret
          blank. Use the Bearer token as the connector request header when OAuth is flaky.
        </p>

        <div className="mb-5 space-y-2">
          {(
            [
              { id: "mcp", label: "MCP URL (Claude)", value: oauth.mcpUrl },
              {
                id: "mcpAlias",
                label: "Short alias",
                value: "https://orbitx.world/mcp",
              },
              {
                id: "mcpLegacy",
                label: "Legacy alias",
                value: "https://orbitx.world/api/orbitx-mcp",
              },
              { id: "auth", label: "Authorization URL", value: oauth.authorizationUrl },
              { id: "token", label: "Token URL", value: oauth.tokenUrl },
              { id: "client", label: "Client ID", value: oauth.clientId },
              { id: "secret", label: "Client secret", value: "(leave blank)", copyValue: "" },
              { id: "scope", label: "Scope", value: oauth.scope },
              {
                id: "authMethod",
                label: "Token auth method",
                value: oauth.tokenEndpointAuthMethod,
              },
              {
                id: "bearer",
                label: "Bearer token",
                value: bearerToken || "(create an API key above — shown once)",
                copyValue: bearerToken || "",
                emphasize: true,
              },
              {
                id: "bearerHeader",
                label: "Authorization header",
                value: bearerHeader || "Bearer <create API key first>",
                copyValue: bearerHeader || "",
                emphasize: true,
              },
            ] as Array<{
              id: string;
              label: string;
              value: string;
              copyValue?: string;
              emphasize?: boolean;
            }>
          ).map((row) => (
            <div
              key={row.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
                row.emphasize
                  ? "border-emerald-400/25 bg-emerald-400/8"
                  : "border-white/8 bg-black/30"
              }`}
            >
              <div className="min-w-[8rem] text-[11px] font-semibold uppercase tracking-wide text-white/35">
                {row.label}
              </div>
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-white/80">{row.value}</code>
              {row.copyValue !== "" && (
                <button
                  type="button"
                  onClick={() => copy(row.id, row.copyValue ?? row.value)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/5"
                >
                  {copied === row.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied === row.id ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          ))}
        </div>

        {bearerToken ? (
          <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/8 px-3 py-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              How to use the Bearer token
            </p>
            <p className="text-[11px] text-white/45">
              Claude / ChatGPT → connector Advanced / Request headers → name{" "}
              <code className="text-white/60">Authorization</code>, value{" "}
              <code className="text-white/60">Bearer {"<token>"}</code> (copy the Authorization header
              row above). Preview: <code className="text-white/60">{shortKey(bearerToken)}</code>
            </p>
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-3 text-[11px] text-amber-100/80">
            Create an API key in step 2 — the full Bearer token appears here so you can paste it into
            the connector.
          </div>
        )}

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

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">ChatGPT setup</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-xs text-white/45">
              <li>Settings → Apps &amp; connectors → enable Developer mode.</li>
              <li>Create a custom MCP connector; paste the MCP server URL.</li>
              <li>
                When asked for OAuth: Client ID <code className="text-white/60">{oauth.clientId}</code>, leave
                Client secret empty, paste Auth + Token URLs, scope{" "}
                <code className="text-white/60">{oauth.scope}</code>.
              </li>
              <li>
                Click Authenticate → approve on OrbitX (link wallet) → return to ChatGPT.
              </li>
            </ol>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Claude setup</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-xs text-white/45">
              <li>
                Use MCP URL ending in <code className="text-white/60">/mcp</code> (required by Claude.ai).
              </li>
              <li>Add custom connector → paste URL → Client ID <code className="text-white/60">orbitx-mcp</code>, secret blank.</li>
              <li>Authenticate → link wallet on OrbitX → reconnect if tools were empty.</li>
            </ol>
          </div>
        </div>
      </section>

      {chatgptGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setChatgptGuide(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0c111a] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold">ChatGPT OAuth fields</h3>
            <p className="mb-4 text-xs text-white/45">
              Paste these into ChatGPT when it asks for auth credentials. Client secret stays empty.
            </p>
            <div className="mb-4 space-y-2">
              {(
                [
                  ["MCP URL", oauth.mcpUrl, "mcp"],
                  ["Authorization URL", oauth.authorizationUrl, "auth"],
                  ["Token URL", oauth.tokenUrl, "token"],
                  ["Client ID", oauth.clientId, "client"],
                  ["Scope", oauth.scope, "scope"],
                  [
                    "Bearer token",
                    bearerToken || "(create API key on this page first)",
                    "bearer",
                    bearerToken || "",
                  ],
                  [
                    "Authorization header",
                    bearerHeader || "Bearer <create API key first>",
                    "bearerHeader",
                    bearerHeader || "",
                  ],
                ] as Array<[string, string, string, string?]>
              ).map(([label, value, id, copyValue]) => (
                <div key={id} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-white/40">{label}</span>
                    {copyValue !== "" && (
                      <button
                        type="button"
                        onClick={() => copy(id, copyValue ?? value)}
                        className="text-[11px] font-semibold text-emerald-300 hover:underline"
                      >
                        {copied === id ? "Copied" : "Copy"}
                      </button>
                    )}
                  </div>
                  <code className="block break-all font-mono text-[11px] text-white/75">{value}</code>
                </div>
              ))}
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-100/80">
                Client secret: <strong>leave blank</strong> (public PKCE client)
              </div>
            </div>
            <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-white/65">
              <li>Enable Developer mode in ChatGPT settings.</li>
              <li>Add connector → paste MCP URL above.</li>
              <li>Fill OAuth fields from this dialog.</li>
              <li>Authenticate → approve + link wallet on OrbitX.</li>
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
