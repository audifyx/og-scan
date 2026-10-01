import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MCP_REGISTRY, CATEGORIES, type McpEntry } from "./registry";

function McpCard({ mcp }: { mcp: McpEntry }) {
  return (
    <Link
      to={`/orbitxmcp/${mcp.slug}`}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14] p-5 transition-all hover:border-white/25 hover:bg-[#10131c]"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: mcp.accent }}
      />
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
        style={{ background: `${mcp.accent}1a`, border: `1px solid ${mcp.accent}40` }}>
        {mcp.emoji}
      </div>
      <h3 className="mb-1 text-lg font-bold text-white">{mcp.name}</h3>
      <p className="mb-3 text-sm font-medium" style={{ color: mcp.accent }}>{mcp.tagline}</p>
      <p className="line-clamp-2 text-sm text-zinc-400">{mcp.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">{mcp.kicker}</span>
        <span className="text-sm font-semibold text-white/70 transition-colors group-hover:text-white">Get →</span>
      </div>
    </Link>
  );
}

export default function MarketplaceHome() {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    return MCP_REGISTRY.filter((m) => {
      if (cat !== "all" && m.category !== cat) return false;
      if (q && !`${m.name} ${m.tagline} ${m.description}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, q]);

  const featured = MCP_REGISTRY.filter((m) => ["orbitx", "apogee", "jupiter", "venus"].includes(m.slug));

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* Hero */}
      <div className="border-b border-white/10 bg-gradient-to-b from-[#0b0d16] to-[#06070c]">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <div className="mb-4 text-sm uppercase tracking-[0.3em] text-[#17ff4d]">OrbitX MCP Marketplace</div>
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight">
            The App Store for <span className="text-[#17ff4d]">agents</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-zinc-400">
            Plug live data into any AI agent. Every MCP is free, no API keys, no signup —
            just point your agent at the endpoint and go.
          </p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search MCPs…"
            className="mx-auto block w-full max-w-md rounded-full border border-white/15 bg-white/5 px-6 py-3 text-white placeholder-zinc-500 outline-none focus:border-[#17ff4d]/60"
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Featured */}
        {!q && cat === "all" && (
          <>
            <h2 className="mb-5 text-2xl font-bold">Featured</h2>
            <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((m) => <McpCard key={m.slug} mcp={m} />)}
            </div>
          </>
        )}

        {/* Category tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {[{ id: "all", label: "All" }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                cat === c.id ? "bg-[#17ff4d] text-black" : "bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => <McpCard key={m.slug} mcp={m} />)}
        </div>
        {list.length === 0 && (
          <div className="py-16 text-center text-zinc-500">No MCPs match your search.</div>
        )}

        {/* Submit CTA */}
        <div className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-[#0d1018] to-[#080a10] p-10 text-center">
          <h2 className="mb-3 text-3xl font-bold">Built an MCP?</h2>
          <p className="mx-auto mb-6 max-w-xl text-zinc-400">
            Get it listed in the marketplace. We review every submission by hand —
            DM us on X with your endpoint and we'll take a look.
          </p>
          <Link
            to="/orbitxmcp/submit"
            className="inline-block rounded-full bg-[#17ff4d] px-8 py-3 font-bold text-black transition-transform hover:scale-105"
          >
            Submit your MCP
          </Link>
        </div>
      </div>
    </div>
  );
}
