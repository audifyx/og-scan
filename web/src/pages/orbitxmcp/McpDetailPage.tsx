import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { MCP_REGISTRY, type McpEntry } from "./registry";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
    >
      {done ? "Copied!" : "Copy"}
    </button>
  );
}

export default function McpDetailPage() {
  const { slug } = useParams();
  const mcp: McpEntry | undefined = MCP_REGISTRY.find((m) => m.slug === slug);
  const [liveTools, setLiveTools] = useState<Array<{ name: string; description: string }> | null>(null);

  useEffect(() => {
    if (!mcp || mcp.external) return;
    // Ask the MCP itself what tools it has (agents can read this too).
    fetch(mcp.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    })
      .then((r) => r.json())
      .then((d) => {
        const tools = d?.result?.tools;
        if (Array.isArray(tools)) setLiveTools(tools.map((t: { name: string; description: string }) => ({ name: t.name, description: t.description })));
      })
      .catch(() => {});
  }, [mcp]);

  if (!mcp) return <Navigate to="/orbitxmcp" replace />;

  const tools = liveTools ?? mcp.tools ?? [];
  const configJson = JSON.stringify({ mcpServers: { [mcp.slug]: { url: mcp.endpoint } } }, null, 2);

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* Banner */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${mcp.accent}55, transparent)` }} />
        <div className="relative mx-auto max-w-6xl px-6 pb-10 pt-14">
          <Link to="/orbitxmcp" className="mb-8 inline-block text-sm text-zinc-400 hover:text-white">← All MCPs</Link>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl text-5xl"
              style={{ background: `${mcp.accent}1a`, border: `1px solid ${mcp.accent}50` }}>
              {mcp.emoji}
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.25em]" style={{ color: mcp.accent }}>{mcp.kicker}</div>
              <h1 className="text-4xl font-extrabold tracking-tight">{mcp.name}</h1>
              <p className="mt-1 text-lg text-zinc-400">{mcp.tagline}</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={mcp.siteUrl} target="_blank" rel="noreferrer"
              className="rounded-full px-6 py-2.5 font-bold text-black" style={{ background: mcp.accent }}>
              Visit site
            </a>
            <a href="#connect" className="rounded-full border border-white/20 px-6 py-2.5 font-semibold hover:bg-white/5">
              Connect agent
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Info */}
        <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Tools", liveTools ? String(liveTools.length) : "—"],
            ["Auth", "None"],
            ["Data", "Live public"],
            ["Version", `v${mcp.version}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-[#0b0d14] p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">{k}</div>
              <div className="text-xl font-bold">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-2xl font-bold">About</h2>
        <p className="mb-10 max-w-3xl text-zinc-300">{mcp.longDescription}</p>

        {/* Tools */}
        <h2 className="mb-3 text-2xl font-bold">
          Tools {liveTools && <span className="ml-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">live</span>}
        </h2>
        <p className="mb-5 text-sm text-zinc-500">
          {liveTools ? "Pulled live from the MCP right now." : "Loading live tool list…"}
        </p>
        <div className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tools.map((t) => (
            <div key={t.name} className="rounded-xl border border-white/10 bg-[#0b0d14] p-4">
              <div className="mb-1 font-mono text-sm font-semibold" style={{ color: mcp.accent }}>{t.name}</div>
              <div className="text-sm text-zinc-400">{t.description}</div>
            </div>
          ))}
          {tools.length === 0 && <div className="text-zinc-500">Fetching tools…</div>}
        </div>

        {/* Connect */}
        <div id="connect" className="rounded-3xl border border-white/10 bg-[#0b0d14] p-8">
          <h2 className="mb-2 text-2xl font-bold">Connect your agent</h2>
          <p className="mb-4 text-zinc-400">Endpoint — no API key needed:</p>
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-black/40 p-4">
            <code className="break-all font-mono text-sm" style={{ color: mcp.accent }}>{mcp.endpoint}</code>
            <CopyBtn text={mcp.endpoint} />
          </div>
          <p className="mb-4 text-zinc-400">MCP client config:</p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-sm text-zinc-300">{configJson}</pre>
            <div className="absolute right-3 top-3"><CopyBtn text={configJson} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
