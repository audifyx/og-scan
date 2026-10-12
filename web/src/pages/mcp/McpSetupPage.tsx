import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  Plug,
  ShieldAlert,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";
import {
  mcpPublicUrl,
  mcpOAuthCredentials,
  claudeConnectUrl,
  chatgptConnectUrl,
  grokConnectUrl,
} from "@/lib/orbitxMcp";

/* ── helpers ─────────────────────────────────────────────────────────── */

function useCopied(): { copied: string | null; copy: (key: string, text: string) => void } {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const copy = useCallback((key: string, text: string) => {
    const done = () => {
      setCopied(key);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1800);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }, []);
  return { copied, copy };
}

function fallbackCopy(text: string, done: () => void) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* noop */
  }
  document.body.removeChild(ta);
  done();
}

function CopyButtonInline({ copyKey, value }: { copyKey: string; value: string }) {
  const { copied, copy } = useCopied();
  const isCopied = copied === copyKey;
  return (
    <button
      type="button"
      onClick={() => copy(copyKey, value)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-og-lime/60 hover:text-og-lime"
    >
      {isCopied ? <Check size={14} className="text-og-lime" /> : <Copy size={14} />}
      {isCopied ? "Copied" : "Copy"}
    </button>
  );
}

function FieldRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/10 bg-black/40 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="shrink-0 text-xs font-bold uppercase tracking-widest text-zinc-500 sm:w-44">{label}</div>
      <div className={`min-w-0 flex-1 break-all text-sm text-zinc-100 ${mono ? "font-mono" : ""}`}>{value}</div>
      <CopyButtonInline copyKey={`field-${label}`} value={value} />
    </div>
  );
}

function CodeBlock({ id, title, code }: { id: string; title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-sm font-bold text-white">{title}</div>
        <CopyButtonInline copyKey={`code-${id}`} value={code} />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-og-cyan">{code}</pre>
    </div>
  );
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-og-lime">{kicker}</div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-2xl text-zinc-400">{sub}</p>}
    </div>
  );
}

/* ── MCP handshake test ──────────────────────────────────────────────── */

type TestPhase = "idle" | "running" | "ok" | "error";

type TestResult =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "ok"; toolCount: number; toolNames: string[]; latencyMs: number; note?: string }
  | { phase: "error"; message: string; hint?: string };

const MCP_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

async function mcpPost(url: string, body: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(url, { method: "POST", headers: MCP_HEADERS, body: JSON.stringify(body) });
  let json: any = null;
  const text = await r.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 300) };
  }
  return { status: r.status, json };
}

async function runHandshake(url: string): Promise<TestResult> {
  const t0 = performance.now();
  const init = await mcpPost(url, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "orbitx-mcp-setup-page", version: "1.0.0" },
    },
  });
  if (init.status === 401 || init.status === 403) {
    return {
      phase: "error",
      message: `Handshake stopped at initialize — server answered HTTP ${init.status} (authentication required).`,
      hint: "The endpoint is LIVE and reachable; it just needs OAuth. Connect with one of the buttons above (Claude / ChatGPT / Grok) to get an authenticated session, then your client can list tools.",
    };
  }
  if (init.status < 200 || init.status >= 300) {
    return {
      phase: "error",
      message: `initialize failed — HTTP ${init.status}: ${summarize(init.json)}`,
      hint: corsHint(),
    };
  }
  const list = await mcpPost(url, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const latencyMs = Math.round(performance.now() - t0);
  if (list.status < 200 || list.status >= 300) {
    return {
      phase: "error",
      message: `initialize OK, but tools/list failed — HTTP ${list.status}: ${summarize(list.json)}`,
      hint: corsHint(),
    };
  }
  const tools = Array.isArray(list.json?.result?.tools) ? list.json.result.tools : [];
  return {
    phase: "ok",
    toolCount: tools.length,
    toolNames: tools.slice(0, 12).map((t: any) => String(t?.name ?? "?")),
    latencyMs,
    note: init.json?.result?.serverInfo ? `Server: ${init.json.result.serverInfo.name ?? "orbitx"} ${init.json.result.serverInfo.version ?? ""}`.trim() : undefined,
  };
}

function summarize(json: any): string {
  if (!json) return "empty response";
  if (json._raw) return json._raw.slice(0, 160);
  const msg = json?.error?.message ?? json?.message ?? json?.error;
  return typeof msg === "string" ? msg.slice(0, 160) : JSON.stringify(json).slice(0, 160);
}

function corsHint(): string {
  return "If this fails in the browser but `curl -X POST https://www.orbitx.world/api/mcp` works, the server is fine — the browser's CORS policy is blocking the cross-origin call. Connect via your app's built-in MCP connector (buttons above) instead.";
}

/* ── page ────────────────────────────────────────────────────────────── */

type LiveState = "checking" | "live" | "down";

const PRICING = [
  {
    name: "Community",
    price: "FREE",
    per: "forever",
    accent: "text-og-lime",
    border: "border-og-lime/40",
    features: ["Full MCP tool access", "Claude / ChatGPT / Grok connectors", "Community support", "No signup, no API key"],
    cta: "Connect free",
  },
  {
    name: "Dev API — Weekly",
    price: "$25",
    per: "/ week · paid in ORBITX burn",
    accent: "text-og-cyan",
    border: "border-og-cyan/40",
    features: ["Everything in Community", "Timed dev-API access window", "Higher rate limits", "Priority support"],
    cta: "Get weekly access",
  },
  {
    name: "Dev API — Monthly",
    price: "$100",
    per: "/ month · paid in ORBITX burn",
    accent: "text-og-gold",
    border: "border-og-gold/40",
    features: ["Everything in Community", "30-day dev-API access window", "Highest rate limits", "Early feature access"],
    cta: "Get monthly access",
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "I'm getting a 401 — what do I do?",
    a: "A 401 means your OAuth session expired or was never completed. Re-run the connect flow from the buttons above (Claude, ChatGPT, or Grok) and approve OrbitX again. Tokens expire — reconnecting issues a fresh one in seconds.",
  },
  {
    q: "What client_id and scope do I use?",
    a: "client_id is \"orbitx-mcp\" and scope is \"orbitx\". There is no client secret — OrbitX uses a public PKCE client (token_endpoint_auth_method: none), so leave the secret field blank in any OAuth form.",
  },
  {
    q: "Why does the docs say www.orbitx.world and not orbitx.world?",
    a: "Always use https://www.orbitx.world/api/mcp. The apex domain (orbitx.world) returns a 308 redirect on POST requests, which silently breaks MCP connectors — Claude and ChatGPT connectors fail outright. The www host serves the endpoint directly.",
  },
  {
    q: "How long do tokens last?",
    a: "Access tokens are short-lived by design. When one expires you'll get a 401 — just reconnect through your app's connector and you'll be issued a new token immediately. No keys to rotate, no secrets to store.",
  },
  {
    q: "Where do I revoke access?",
    a: "Revoke OrbitX MCP access from the Super Computer Setup page (/supercomputer), where your connected agents and keys are managed.",
  },
  {
    q: "Do I need to pay anything to use the MCP?",
    a: "No — community use is completely free, no signup and no API key. The $25/week and $100/month tiers are only for dev-API access windows, paid by burning ORBITX.",
  },
];

export default function McpSetupPage() {
  const mcpUrl = useMemo(() => mcpPublicUrl(), []);
  const creds = useMemo(() => mcpOAuthCredentials(), []);
  const [live, setLive] = useState<LiveState>("checking");
  const [test, setTest] = useState<TestResult>({ phase: "idle" });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await mcpPost(mcpUrl, {
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "orbitx-mcp-setup-ping", version: "1.0.0" } },
        });
        if (!cancelled) setLive(status > 0 ? "live" : "down");
      } catch {
        if (!cancelled) setLive("down");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mcpUrl]);

  const onTest = useCallback(async () => {
    setTest({ phase: "running" });
    try {
      setTest(await runHandshake(mcpUrl));
    } catch (e) {
      setTest({
        phase: "error",
        message: `Network error: ${e instanceof Error ? e.message : String(e)}`,
        hint: corsHint(),
      });
    }
  }, [mcpUrl]);

  const claudeDeepLink = useMemo(() => claudeConnectUrl(mcpUrl), [mcpUrl]);

  const claudeDesktopCfg = useMemo(
    () =>
      JSON.stringify(
        { mcpServers: { orbitx: { command: "npx", args: ["-y", "mcp-remote", mcpUrl] } } },
        null,
        2,
      ),
    [mcpUrl],
  );

  const cursorCfg = useMemo(
    () =>
      JSON.stringify(
        { "mcp.servers": { orbitx: { type: "streamable-http", url: mcpUrl } } },
        null,
        2,
      ),
    [mcpUrl],
  );

  const windsurfCfg = useMemo(
    () =>
      JSON.stringify(
        { mcpServers: { orbitx: { serverUrl: mcpUrl, transport: "streamable-http" } } },
        null,
        2,
      ),
    [mcpUrl],
  );

  const vscodeCfg = useMemo(
    () =>
      JSON.stringify(
        { servers: { orbitx: { type: "http", url: mcpUrl } } },
        null,
        2,
      ),
    [mcpUrl],
  );

  const testPhase: TestPhase = test.phase;

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(23,255,77,0.12),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-zinc-300">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  live === "live" ? "animate-ping bg-og-lime" : live === "down" ? "animate-ping bg-red-500" : "animate-ping bg-zinc-500"
                }`}
              />
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  live === "live" ? "bg-og-lime" : live === "down" ? "bg-red-500" : "bg-zinc-500"
                }`}
              />
            </span>
            {live === "live" ? "MCP endpoint live" : live === "down" ? "Endpoint unreachable" : "Checking endpoint…"}
          </div>

          <h1 className="mx-auto mb-5 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Plug OrbitX into <span className="text-og-lime">any AI tool</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-300">
            The official OrbitX MCP — as easy as plugging the MCP into any tool, connected in seconds.
            Free for community use.
          </p>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={claudeDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-og-lime px-8 py-3.5 font-bold text-black transition-transform hover:scale-105"
            >
              <Plug size={18} /> CONNECT
            </a>
            <button
              type="button"
              onClick={onTest}
              disabled={testPhase === "running"}
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              <Activity size={18} />
              {testPhase === "running" ? "TESTING…" : "TEST MY CONNECTION"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">Connect opens Claude's connector setup · Test runs a real MCP handshake in your browser</p>

          {/* test result */}
          {test.phase === "ok" || test.phase === "error" ? (
            <div
              className={`mx-auto mt-8 max-w-2xl rounded-2xl border p-5 text-left ${
                test.phase === "ok" ? "border-og-lime/40 bg-og-lime/5" : "border-red-500/40 bg-red-500/5"
              }`}
            >
              {test.phase === "ok" ? (
                <>
                  <div className="mb-2 flex items-center gap-2 font-bold text-og-lime">
                    <Check size={18} /> Handshake successful
                  </div>
                  <p className="text-sm text-zinc-300">
                    Server answered <b className="text-white">{test.toolCount} tools</b> in{" "}
                    <b className="text-white">{test.latencyMs} ms</b>.
                    {test.note && <span className="text-zinc-400"> {test.note}</span>}
                  </p>
                  {test.toolNames.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {test.toolNames.map((n) => (
                        <span key={n} className="rounded-md bg-black/50 px-2 py-1 font-mono text-[11px] text-og-cyan">
                          {n}
                        </span>
                      ))}
                      {test.toolCount > test.toolNames.length && (
                        <span className="px-2 py-1 text-[11px] text-zinc-500">+{test.toolCount - test.toolNames.length} more</span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2 font-bold text-red-400">
                    <ShieldAlert size={18} /> Handshake failed
                  </div>
                  <p className="font-mono text-sm text-zinc-200">{test.message}</p>
                  {test.hint && <p className="mt-3 text-sm text-zinc-400">{test.hint}</p>}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* ── 1. Connect with your app ── */}
        <SectionTitle
          kicker="Step 1"
          title="Connect with your app"
          sub="One click opens the real connector settings in each app. Paste the MCP URL, approve OrbitX with OAuth, and you're in."
        />
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { name: "Claude", desc: "Custom connector deep link", url: claudeDeepLink, color: "border-orange-400/40 hover:border-orange-400" },
            { name: "ChatGPT", desc: "Settings → Connectors", url: chatgptConnectUrl(), color: "border-og-cyan/40 hover:border-og-cyan" },
            { name: "Grok", desc: "Custom MCP connectors", url: grokConnectUrl(), color: "border-og-gold/40 hover:border-og-gold" },
          ].map((app) => (
            <a
              key={app.name}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`group rounded-2xl border bg-[#0b0d14] p-6 transition-all hover:-translate-y-0.5 ${app.color}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xl font-bold text-white">{app.name}</div>
                <ExternalLink size={18} className="text-zinc-500 transition-colors group-hover:text-white" />
              </div>
              <div className="text-sm text-zinc-400">{app.desc}</div>
            </a>
          ))}
        </div>

        <div className="mb-16 rounded-2xl border border-white/10 bg-[#0b0d14] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound size={16} className="text-og-lime" /> OAuth fields (paste into any manual connector form)
          </div>
          <div className="space-y-2.5">
            <FieldRow label="MCP URL" value={creds.mcpUrl} />
            <FieldRow label="Authorize URL" value={creds.authorizationUrl} />
            <FieldRow label="Token URL" value={creds.tokenUrl} />
            <FieldRow label="Registration URL" value={creds.registrationUrl} />
            <FieldRow label="Client ID" value={creds.clientId} />
            <FieldRow label="Scope" value={creds.scope} />
            <FieldRow label="Client secret" value="(none — public PKCE client, leave blank)" mono={false} />
          </div>
        </div>

        {/* ── 2. Config snippets ── */}
        <SectionTitle
          kicker="Step 2"
          title="Or paste a config"
          sub="Drop one of these into your editor's MCP config and restart it. Every snippet points at the real endpoint."
        />
        <div className="mb-16 space-y-6">
          <CodeBlock id="claude-desktop" title="Claude Desktop — claude_desktop_config.json" code={claudeDesktopCfg} />
          <CodeBlock id="cursor" title="Cursor — MCP settings (custom server · streamable-http)" code={cursorCfg} />
          <CodeBlock id="windsurf" title="Windsurf — MCP config" code={windsurfCfg} />
          <CodeBlock id="vscode" title="VS Code — .vscode/mcp.json" code={vscodeCfg} />
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="text-sm font-bold text-white">Generic — any Streamable-HTTP client</div>
              <CopyButtonInline copyKey="code-generic" value={mcpUrl} />
            </div>
            <div className="space-y-2 p-4 text-sm text-zinc-300">
              <p>
                Endpoint: <span className="font-mono text-og-cyan">{mcpUrl}</span>
              </p>
              <p className="text-zinc-400">
                OAuth discovery: append <span className="font-mono text-zinc-200">/.well-known/oauth-authorization-server</span> to the MCP URL
                (or use the authorize / token / register URLs above). Auth method is <span className="font-mono text-zinc-200">none</span> (public
                PKCE client).
              </p>
            </div>
          </div>
        </div>

        {/* ── 3. Pricing ── */}
        <SectionTitle kicker="Pricing" title="Free for the community" sub="Use the MCP free, forever. Timed dev-API access is paid by burning ORBITX." />
        <div className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRICING.map((t) => (
            <div key={t.name} className={`rounded-2xl border bg-[#0b0d14] p-6 ${t.border}`}>
              <div className="mb-1 text-sm font-bold uppercase tracking-widest text-zinc-400">{t.name}</div>
              <div className={`font-display text-4xl font-bold ${t.accent}`}>{t.price}</div>
              <div className="mb-5 text-xs text-zinc-500">{t.per}</div>
              <ul className="mb-6 space-y-2 text-sm text-zinc-300">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={15} className={`mt-0.5 shrink-0 ${t.accent}`} /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/orbitxmcp"
                className="block rounded-full border border-white/20 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-white/5"
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* ── 4. FAQ ── */}
        <SectionTitle kicker="FAQ" title="Troubleshooting" />
        <div className="mb-16 space-y-3">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14]">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-bold text-white">{f.q}</span>
                  <ChevronDown size={18} className={`shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <div className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-zinc-300">{f.a}</div>}
              </div>
            );
          })}
        </div>

        {/* ── 5. Cross-links ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            to="/mcp/guide"
            className="group rounded-2xl border border-white/10 bg-[#0b0d14] p-6 transition-all hover:-translate-y-0.5 hover:border-og-lime/50"
          >
            <BookOpen size={22} className="mb-3 text-og-lime" />
            <div className="mb-1 font-bold text-white">MCP Guide</div>
            <div className="text-sm text-zinc-400">Full walkthrough of tools, auth, and agent patterns.</div>
          </Link>
          <Link
            to="/orbitxmcp"
            className="group rounded-2xl border border-white/10 bg-[#0b0d14] p-6 transition-all hover:-translate-y-0.5 hover:border-og-cyan/50"
          >
            <Store size={22} className="mb-3 text-og-cyan" />
            <div className="mb-1 font-bold text-white">MCP Marketplace</div>
            <div className="text-sm text-zinc-400">Browse every MCP in the OrbitX ecosystem.</div>
          </Link>
          <Link
            to="/supercomputer"
            className="group rounded-2xl border border-white/10 bg-[#0b0d14] p-6 transition-all hover:-translate-y-0.5 hover:border-og-gold/50"
          >
            <Sparkles size={22} className="mb-3 text-og-gold" />
            <div className="mb-1 font-bold text-white">Super Computer</div>
            <div className="text-sm text-zinc-400">Manage agents, keys, and revoke MCP access.</div>
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Zap size={13} className="text-og-lime" />
          Official OrbitX MCP · {mcpUrl}
        </div>
      </div>
    </div>
  );
}
