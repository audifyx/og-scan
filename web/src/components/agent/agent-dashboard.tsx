import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
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

function maskSecret(value: string, kind: "key" | "header" = "key") {
  if (!value) return "—";
  if (kind === "header" && value.startsWith("Bearer ")) {
    const tok = value.slice(7);
    return `Bearer ${shortKey(tok)}`;
  }
  if (value.startsWith("oxo_") || value.startsWith("oxk_")) return shortKey(value);
  if (value.length <= 12) return "••••••••";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function SecretRow({
  label,
  value,
  emptyLabel,
  accent,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  emptyLabel?: string;
  accent?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const has = Boolean(value);

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        accent ? "border-emerald-400/20 bg-emerald-400/[0.06]" : "border-white/[0.07] bg-black/35"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</span>
        <div className="flex items-center gap-1">
          {has && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white/55 hover:bg-white/5 hover:text-white/80"
            >
              {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {visible ? "Hide" : "View"}
            </button>
          )}
          {has && (
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-300/90 hover:bg-emerald-400/10"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>
      <code className="block break-all font-mono text-[12px] leading-relaxed text-white/75">
        {!has ? emptyLabel || "Create an API key first" : visible ? value : maskSecret(value, label.toLowerCase().includes("header") ? "header" : "key")}
      </code>
    </div>
  );
}

function CredRow({
  label,
  value,
  copyValue,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyValue?: string | null;
  copied: boolean;
  onCopy?: () => void;
}) {
  const canCopy = copyValue !== "" && copyValue != null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-black/35 px-3 py-2.5">
      <div className="w-full text-[10px] font-bold uppercase tracking-[0.14em] text-white/35 sm:w-36 sm:shrink-0">
        {label}
      </div>
      <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-white/75">{value}</code>
      {canCopy && onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/5 hover:text-white/85"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

export function AgentDashboard() {
  const { user, profile } = useAuth();
  const { publicKey } = useWallet();
  const { pickable, signInWith, busy } = useWalletSignIn();

  const [boot, setBoot] = useState<AgentBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("Claude / ChatGPT");
  const [creating, setCreating] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [chatgptGuide, setChatgptGuide] = useState(false);
  const [linking, setLinking] = useState(false);
  const [setupOpen, setSetupOpen] = useState<"claude" | "chatgpt" | null>("claude");

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
  const hasKey = Boolean(storedKey || (boot?.keys?.length ?? 0) > 0);
  const bearerToken = storedKey;
  const bearerHeader = bearerToken ? `Bearer ${bearerToken}` : "";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bootstrapAgent();
      setBoot(data);
      if (data.mintedKey?.key) {
        setStoredKey(data.mintedKey.key);
        setShowKeyPanel(true);
        try {
          localStorage.setItem("agent_api_key", data.mintedKey.key);
        } catch {
          /* ignore */
        }
      } else {
        try {
          const cached = localStorage.getItem("agent_api_key");
          if (cached?.startsWith("oxo_") || cached?.startsWith("oxk_")) {
            setStoredKey((prev) => prev || cached);
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
        setStoredKey(cached);
      }
    } catch {
      /* ignore */
    }
    refresh();
  }, [refresh]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1800);
  };

  const onCreateKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const minted = await createAgentApiKey(keyName.trim() || "MCP Key");
      setStoredKey(minted.key);
      setShowKeyPanel(true);
      try {
        localStorage.setItem("agent_api_key", minted.key);
      } catch {
        /* ignore */
      }
      const keys = await listAgentApiKeys();
      setBoot((prev) => (prev ? { ...prev, keys: keys.keys, mintedKey: minted } : prev));
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

  const openClaude = () => {
    window.open(claudeConnectUrl(mcpUrl), "_blank", "noopener,noreferrer");
  };

  const openChatgpt = () => {
    setChatgptGuide(true);
    window.open(chatgptConnectUrl(), "_blank", "noopener,noreferrer");
  };

  const steps = [
    { ok: Boolean(linkedWallet), label: "Wallet", n: "01" },
    { ok: hasKey, label: "API key", n: "02" },
    { ok: hasKey && Boolean(linkedWallet), label: "Connect", n: "03" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-white/50">
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
            "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(52,211,153,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 0%, rgba(212,165,116,0.08), transparent 50%), linear-gradient(180deg, #070a12 0%, #05070d 40%, #05070d 100%)",
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

      <div className="relative mx-auto max-w-3xl space-y-8 px-5 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <header className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400/80">
                OrbitX Agent
              </p>
              <h1 className="text-4xl font-black tracking-tight sm:text-[2.75rem] sm:leading-none">
                MCP Control
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/45">
                Connect Claude or ChatGPT to OrbitX — trade, launch, mint, and manage communities.
                Non-custodial. You sign in Phantom.
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-white/55 hover:bg-white/[0.06] hover:text-white/80"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <div
                key={s.label}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  s.ok
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 bg-white/[0.03] text-white/35"
                }`}
              >
                <span className="font-mono text-[10px] opacity-60">{s.n}</span>
                {s.label}
                {s.ok && <Check className="h-3 w-3" />}
              </div>
            ))}
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
            {(error.includes("agents") || error.includes("schema") || error.includes("relation")) && (
              <p className="mt-1 text-xs text-red-200/60">
                Apply SQL from <code className="font-mono">sql/Aug_SQL/</code> in Supabase if tables are missing.
              </p>
            )}
          </div>
        )}

        {/* 1 — Identity */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10">
              <Wallet className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Identity</h2>
              <p className="text-[11px] text-white/35">Solana wallet linked to your agent</p>
            </div>
            {exempt && (
              <span className="ml-auto rounded-full bg-amber-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                Exempt
              </span>
            )}
          </div>

          {linkedWallet ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-black/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sm font-semibold text-white/85">
                      {linkedWallet.slice(0, 4)}…{linkedWallet.slice(-4)}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy("wallet", linkedWallet)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-300/90 hover:bg-emerald-400/10"
                    >
                      {copied === "wallet" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === "wallet" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-white/28">{linkedWallet}</p>
                  {boot?.agent?.id && (
                    <p className="mt-2 text-[10px] text-white/30">
                      Agent{" "}
                      <span className="font-mono text-white/45">
                        {boot.agent.id.slice(0, 8)}…
                      </span>
                    </p>
                  )}
                </div>
                {walletAddress && walletAddress !== boot?.agent.walletAddress && (
                  <button
                    type="button"
                    disabled={linking}
                    onClick={onLinkWallet}
                    className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50"
                  >
                    {linking ? "Linking…" : "Link connected wallet"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-white/45">Connect a wallet to authorize MCP actions.</p>
              <div className="grid gap-2 sm:grid-cols-2">
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
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold hover:bg-white/[0.04] disabled:opacity-50"
                  >
                    {w.icon ? <img src={w.icon} alt="" className="h-5 w-5 rounded" /> : null}
                    {busy === w.name ? `Connecting…` : w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 2 — API keys (masked) */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10">
              <KeyRound className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold">API key</h2>
              <p className="text-[11px] text-white/35">Hidden by default — View to reveal</p>
            </div>
          </div>

          {storedKey && (
            <div className="mb-4 space-y-2">
              <SecretRow
                label="Bearer token"
                value={storedKey}
                accent
                copied={copied === "key"}
                onCopy={() => copy("key", storedKey)}
              />
              <SecretRow
                label="Authorization header"
                value={bearerHeader}
                accent
                copied={copied === "bearerHeader"}
                onCopy={() => copy("bearerHeader", bearerHeader)}
              />
              {showKeyPanel && (
                <p className="text-[11px] text-emerald-300/70">
                  New key ready — use View → Copy, then paste into your connector request headers.
                </p>
              )}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key label"
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-emerald-400/35"
            />
            <button
              type="button"
              disabled={creating}
              onClick={onCreateKey}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create key"}
            </button>
          </div>

          <div className="space-y-2">
            {(boot?.keys || []).length === 0 ? (
              <p className="text-sm text-white/35">No active keys yet.</p>
            ) : (
              boot?.keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{k.name}</p>
                    <p className="text-[11px] text-white/30">
                      {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRevoke(k.id)}
                    className="rounded-lg p-2 text-red-300/70 hover:bg-red-500/10"
                    title="Revoke"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 3 — Connect */}
        <section className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10">
              <Plug className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Connect</h2>
              <p className="text-[11px] text-white/35">Add OrbitX to Claude or ChatGPT</p>
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={openClaude}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#d4a574] px-4 py-3.5 text-sm font-bold text-black hover:brightness-110"
            >
              Add to Claude <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={openChatgpt}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-bold text-black hover:bg-white/90"
            >
              Add to ChatGPT <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mb-4 flex gap-2 border-b border-white/[0.06] pb-1">
            {(
              [
                ["claude", "Claude"],
                ["chatgpt", "ChatGPT"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSetupOpen(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  setupOpen === id ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60"
                }`}
              >
                {label} setup
              </button>
            ))}
          </div>

          {setupOpen === "claude" && (
            <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-white/45">
              <li>
                MCP URL must end in <code className="text-white/60">/mcp</code>
              </li>
              <li>
                Client ID <code className="text-white/60">orbitx-mcp</code>, secret blank
              </li>
              <li>
                Advanced → header <code className="text-white/60">Authorization</code> = Bearer token
                (View + Copy above)
              </li>
            </ol>
          )}
          {setupOpen === "chatgpt" && (
            <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-white/45">
              <li>Enable Developer mode in ChatGPT settings</li>
              <li>Create custom MCP connector with MCP URL</li>
              <li>OAuth: Client ID orbitx-mcp, secret blank, scope orbitx</li>
              <li>Authenticate → approve on OrbitX</li>
            </ol>
          )}

          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            Connector fields
          </h3>
          <div className="space-y-2">
            <CredRow
              label="MCP URL"
              value={oauth.mcpUrl}
              copied={copied === "mcp"}
              onCopy={() => copy("mcp", oauth.mcpUrl)}
            />
            <CredRow
              label="Auth URL"
              value={oauth.authorizationUrl}
              copied={copied === "auth"}
              onCopy={() => copy("auth", oauth.authorizationUrl)}
            />
            <CredRow
              label="Token URL"
              value={oauth.tokenUrl}
              copied={copied === "token"}
              onCopy={() => copy("token", oauth.tokenUrl)}
            />
            <CredRow
              label="Client ID"
              value={oauth.clientId}
              copied={copied === "client"}
              onCopy={() => copy("client", oauth.clientId)}
            />
            <CredRow label="Client secret" value="(leave blank)" copyValue="" />
            <CredRow
              label="Scope"
              value={oauth.scope}
              copied={copied === "scope"}
              onCopy={() => copy("scope", oauth.scope)}
            />
          </div>
        </section>

        <p className="pb-8 text-center text-[11px] text-white/25">
          Keys never leave your browser until you copy them. OrbitX does not hold wallet keys.
        </p>
      </div>

      {chatgptGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setChatgptGuide(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0c111a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold">ChatGPT OAuth</h3>
            <p className="mb-4 text-xs text-white/40">Paste into ChatGPT. Client secret stays empty.</p>
            <div className="mb-4 space-y-2">
              {(
                [
                  ["MCP URL", oauth.mcpUrl, "mcp"],
                  ["Authorization URL", oauth.authorizationUrl, "auth"],
                  ["Token URL", oauth.tokenUrl, "token"],
                  ["Client ID", oauth.clientId, "client"],
                  ["Scope", oauth.scope, "scope"],
                ] as const
              ).map(([label, value, id]) => (
                <CredRow
                  key={id}
                  label={label}
                  value={value}
                  copied={copied === id}
                  onCopy={() => copy(id, value)}
                />
              ))}
              <SecretRow
                label="Bearer token"
                value={bearerToken || ""}
                emptyLabel="Create an API key on this page first"
                accent
                copied={copied === "bearer"}
                onCopy={() => bearerToken && copy("bearer", bearerToken)}
              />
            </div>
            <button
              type="button"
              onClick={() => setChatgptGuide(false)}
              className="w-full rounded-xl bg-white py-2.5 text-sm font-bold text-black"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
