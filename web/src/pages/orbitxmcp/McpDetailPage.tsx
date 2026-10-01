import { useEffect, useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { MCP_REGISTRY, type McpEntry } from "./registry";

/** One-click demo per MCP: { tool, args }. Playground falls back gracefully if absent. */
const DEMOS: Record<string, { tool: string; args: Record<string, unknown>; label: string }> = {
  jupiter: { tool: "sol_price", args: {}, label: "Get live SOL price" },
  mercury: { tool: "gas_price", args: {}, label: "Base gas price" },
  terra: { tool: "gas_price", args: {}, label: "Ethereum gas price" },
  luna: { tool: "btc_price", args: {}, label: "Get live BTC price" },
  venus: { tool: "underlying_stock_price", args: { ticker: "NVDA" }, label: "NVDA stock price" },
  comet: { tool: "gas_price", args: {}, label: "BSC gas price" },
  io: { tool: "gas_price", args: {}, label: "Polygon gas price" },
  nebula: { tool: "gas_price", args: {}, label: "Arbitrum gas price" },
  orion: { tool: "stock_quote", args: { ticker: "AAPL" }, label: "AAPL quote" },
  europa: { tool: "convert", args: { from: "USD", to: "EUR", amount: 100 }, label: "Convert 100 USD → EUR" },
  neptune: { tool: "top_yields", args: { limit: 5 }, label: "Top 5 DeFi yields" },
  pulse: { tool: "fear_greed_now", args: {}, label: "Fear & Greed now" },
  harbor: { tool: "list_stablecoins", args: { limit: 5 }, label: "Top stablecoins" },
  titan: { tool: "gas_all", args: {}, label: "Gas on all chains" },
  mars: { tool: "scoreboard", args: { league: "nba" }, label: "NBA scoreboard" },
  aurora: { tool: "current_weather", args: { latitude: 40.71, longitude: -74.0 }, label: "NYC weather" },
  herald: { tool: "latest_news", args: { limit: 5 }, label: "Latest crypto news" },
  drop: { tool: "trending_now", args: {}, label: "What's trending" },
};

function CopyBtn({ text, dark }: { text: string; dark?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${dark ? "bg-white/10 hover:bg-white/20" : "bg-black/40 hover:bg-black/60 text-white"}`}
    >
      {done ? "Copied!" : "Copy"}
    </button>
  );
}

function Playground({ mcp, tools }: { mcp: McpEntry; tools: Array<{ name: string; description: string }> }) {
  const demo = DEMOS[mcp.slug];
  const [tool, setTool] = useState(demo?.tool ?? tools[0]?.name ?? "");
  const [args, setArgs] = useState(JSON.stringify(demo?.args ?? {}, null, 2));
  const [out, setOut] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (demo && tools.some((t) => t.name === demo.tool)) {
      setTool(demo.tool);
      setArgs(JSON.stringify(demo.args, null, 2));
    } else if (tools[0]) {
      setTool(tools[0].name);
    }
  }, [tools]);

  const run = async () => {
    let parsed: Record<string, unknown> = {};
    try { parsed = args.trim() ? JSON.parse(args) : {}; }
    catch { setOut("Invalid JSON in arguments."); return; }
    setRunning(true);
    setOut(null);
    try {
      const r = await fetch(mcp.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: parsed } }),
      });
      const d = await r.json();
      const text = d?.result?.content?.[0]?.text ?? JSON.stringify(d, null, 2);
      setOut(text.slice(0, 8000));
    } catch (e) {
      setOut("Request failed: " + String(e));
    }
    setRunning(false);
  };

  if (!tools.length) return null;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0b0d14] p-8">
      <h2 className="mb-2 font-serif text-3xl" style={{ fontFamily: "Georgia, serif" }}>Try it live</h2>
      <p className="mb-6 text-zinc-400">Run a real tool against the live MCP — right here, no signup.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Tool</label>
          <select value={tool} onChange={(e) => setTool(e.target.value)}
            className="mb-4 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm outline-none">
            {tools.map((t) => <option key={t.name} value={t.name} className="bg-[#0b0d14]">{t.name}</option>)}
          </select>
          <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Arguments (JSON)</label>
          <textarea value={args} onChange={(e) => setArgs(e.target.value)} rows={4}
            className="w-full rounded-xl border border-white/15 bg-black/40 p-3 font-mono text-sm outline-none" />
          <button onClick={run} disabled={running}
            className="mt-4 rounded-full px-8 py-3 font-bold text-black disabled:opacity-50"
            style={{ background: mcp.accent }}>
            {running ? "RUNNING…" : demo ? `▶ ${demo.label}` : "▶ RUN TOOL"}
          </button>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Result</label>
          <pre className="h-64 overflow-auto rounded-xl bg-black/50 p-4 font-mono text-xs text-zinc-300">
            {out ?? "// hit run to call the live MCP"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function McpDetailPage() {
  const { slug } = useParams();
  const mcp: McpEntry | undefined = MCP_REGISTRY.find((m) => m.slug === slug);
  const [liveTools, setLiveTools] = useState<Array<{ name: string; description: string }> | null>(null);

  useEffect(() => {
    if (!mcp || mcp.external) return;
    fetch(mcp.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    })
      .then((r) => r.json())
      .then((d) => {
        const tools = d?.result?.tools;
        if (Array.isArray(tools)) setLiveTools(tools);
      })
      .catch(() => {});
  }, [mcp]);

  const tools = useMemo(() => liveTools ?? [], [liveTools]);

  if (!mcp) return <Navigate to="/orbitxmcp" replace />;
  const configJson = JSON.stringify({ mcpServers: { [mcp.slug]: { url: mcp.endpoint } } }, null, 2);

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* ── Planet banner ── */}
      <div className="relative overflow-hidden">
        <img src={`/orbitxmcp/img/${mcp.slug}-hero.png`} alt={mcp.name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06070c]/70 via-[#06070c]/40 to-[#06070c]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20">
          <Link to="/orbitxmcp" className="mb-10 inline-block text-sm text-zinc-300 hover:text-white">← Marketplace</Link>
          <div className="flex items-end gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-black/50 text-5xl backdrop-blur"
              style={{ border: `1px solid ${mcp.accent}60` }}>
              {mcp.emoji}
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-[0.3em]" style={{ color: mcp.accent }}>{mcp.kicker}</div>
              <h1 className="font-serif text-6xl tracking-tight" style={{ fontFamily: "Georgia, serif" }}>{mcp.name}</h1>
              <p className="mt-2 text-xl italic text-zinc-300" style={{ fontFamily: "Georgia, serif" }}>{mcp.tagline}</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#playground" className="rounded-full px-8 py-3.5 font-bold text-black transition-transform hover:scale-105" style={{ background: mcp.accent }}>
              TRY IT LIVE
            </a>
            <a href={mcp.siteUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/30 px-8 py-3.5 font-semibold hover:bg-white/5">
              VISIT SITE
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Info cards */}
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["TOOLS", liveTools ? String(liveTools.length) : "…"],
            ["AUTH", "None"],
            ["DATA", "Live public"],
            ["VERSION", `v${mcp.version}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-[#0b0d14] p-5">
              <div className="mb-1 text-xs uppercase tracking-[0.2em]" style={{ color: mcp.accent }}>{k}</div>
              <div className="text-2xl font-bold">{v}</div>
            </div>
          ))}
        </div>

        {/* About */}
        <h2 className="mb-4 font-serif text-3xl" style={{ fontFamily: "Georgia, serif" }}>About</h2>
        <p className="mb-12 max-w-3xl text-lg leading-relaxed text-zinc-300">{mcp.longDescription}</p>

        {/* Playground */}
        <div id="playground" className="mb-12">
          <Playground mcp={mcp} tools={tools} />
        </div>

        {/* Tool catalog */}
        <h2 className="mb-2 font-serif text-3xl" style={{ fontFamily: "Georgia, serif" }}>
          Tool catalog {tools.length > 0 && <span className="text-xl text-zinc-500">({tools.length})</span>}
        </h2>
        <p className="mb-6 text-sm text-zinc-500">
          {liveTools ? "Pulled live from the MCP itself." : mcp.external ? "See the official site for the full catalog." : "Loading live catalog…"}
        </p>
        <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <div key={t.name} className="rounded-xl border border-white/10 bg-[#0b0d14] p-4 transition-colors hover:border-white/20">
              <div className="mb-1 font-mono text-sm font-semibold" style={{ color: mcp.accent }}>{t.name}</div>
              <div className="text-sm text-zinc-400">{t.description}</div>
            </div>
          ))}
        </div>

        {/* Connect */}
        <div className="rounded-3xl border border-white/10 bg-[#0b0d14] p-8">
          <h2 className="mb-2 font-serif text-3xl" style={{ fontFamily: "Georgia, serif" }}>Connect your agent</h2>
          <p className="mb-4 text-zinc-400">Endpoint — no API key needed:</p>
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-black/40 p-4">
            <code className="break-all font-mono text-sm" style={{ color: mcp.accent }}>{mcp.endpoint}</code>
            <CopyBtn text={mcp.endpoint} />
          </div>
          <div className="relative">
            <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-sm text-zinc-300">{configJson}</pre>
            <div className="absolute right-3 top-3"><CopyBtn text={configJson} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
