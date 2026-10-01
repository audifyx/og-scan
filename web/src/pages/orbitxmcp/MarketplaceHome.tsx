import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MCP_REGISTRY, CATEGORIES, type McpEntry } from "./registry";

function McpCard({ mcp }: { mcp: McpEntry }) {
  return (
    <Link
      to={`/orbitxmcp/${mcp.slug}`}
      className="group relative min-w-[260px] snap-start overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14] transition-all hover:border-white/25"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={`/orbitxmcp/img/${mcp.slug}-hero.png`}
          alt={mcp.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d14] via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 flex h-11 w-11 items-center justify-center rounded-xl text-2xl backdrop-blur"
          style={{ background: `${mcp.accent}22`, border: `1px solid ${mcp.accent}55` }}>
          {mcp.emoji}
        </div>
      </div>
      <div className="p-4">
        <h3 className="mb-0.5 text-base font-bold text-white">{mcp.name}</h3>
        <p className="mb-2 text-xs font-medium" style={{ color: mcp.accent }}>{mcp.tagline}</p>
        <p className="line-clamp-2 text-xs text-zinc-400">{mcp.description}</p>
      </div>
    </Link>
  );
}

function Row({ title, items }: { title: string; items: McpEntry[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-10">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {items.map((m) => <McpCard key={m.slug} mcp={m} />)}
      </div>
    </div>
  );
}

export default function MarketplaceHome() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return null;
    return MCP_REGISTRY.filter((m) =>
      `${m.name} ${m.tagline} ${m.description}`.toLowerCase().includes(q.toLowerCase())
    );
  }, [q]);

  const byCat = (c: string) => MCP_REGISTRY.filter((m) => m.category === c);
  const featured = MCP_REGISTRY.filter((m) => ["orbitx", "apogee", "jupiter", "venus", "mars"].includes(m.slug));

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-white/10">
        <img
          src="/orbitxmcp/img/orbitx-hero.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#06070c]/60 via-[#06070c]/80 to-[#06070c]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
          <div className="mb-6 text-xs uppercase tracking-[0.4em] text-[#17ff4d]">
            OrbitX MCP Marketplace
          </div>
          <h1 className="mx-auto mb-6 max-w-4xl font-serif text-6xl leading-[1.05] tracking-tight sm:text-7xl" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            The App Store<br />for <span className="italic text-[#17ff4d]">agents</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-300">
            Live data, wired for AI. Every MCP is free — no API keys, no signup.
            Point your agent at an endpoint and it just works.
          </p>
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <a href="#browse" className="rounded-full bg-[#17ff4d] px-8 py-3.5 font-bold text-black transition-transform hover:scale-105">
              BROWSE MCPS
            </a>
            <Link to="/orbitxmcp/submit" className="rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white hover:bg-white/5">
              SUBMIT YOURS
            </Link>
          </div>
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-zinc-400">
            <span><b className="text-2xl text-white">{MCP_REGISTRY.length}</b><br />MCPs live</span>
            <span><b className="text-2xl text-white">1000+</b><br />tools</span>
            <span><b className="text-2xl text-white">0</b><br />API keys needed</span>
          </div>
        </div>
      </div>

      <div id="browse" className="mx-auto max-w-6xl px-6 py-12">
        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the marketplace…"
          className="mb-10 block w-full rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-white placeholder-zinc-500 outline-none focus:border-[#17ff4d]/60"
        />

        {filtered ? (
          <>
            <h2 className="mb-5 text-2xl font-bold">Results</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((m) => <McpCard key={m.slug} mcp={m} />)}
            </div>
            {filtered.length === 0 && <div className="py-16 text-center text-zinc-500">Nothing found.</div>}
          </>
        ) : (
          <>
            <Row title="Featured" items={featured} />
            {CATEGORIES.map((c) => (
              <Row key={c.id} title={c.label} items={byCat(c.id)} />
            ))}
          </>
        )}

        {/* For agents strip */}
        <div className="mt-8 rounded-3xl border border-[#17ff4d]/20 bg-[#17ff4d]/5 p-8">
          <h3 className="mb-2 text-xl font-bold">🤖 Are you an agent?</h3>
          <p className="mb-4 text-zinc-300">
            Fetch the machine-readable registry — every MCP, endpoint, and category as JSON. Then connect with a standard MCP handshake. No auth, ever.
          </p>
          <code className="block break-all rounded-xl bg-black/50 p-4 font-mono text-sm text-[#17ff4d]">
            GET https://orbitx.world/api/mcps
          </code>
        </div>

        {/* Submit CTA */}
        <div className="relative mt-10 overflow-hidden rounded-3xl border border-white/10 p-10 text-center">
          <img src="/orbitxmcp/img/herald-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#06070c]/70 to-[#06070c]/90" />
          <div className="relative">
            <h2 className="mb-3 font-serif text-4xl" style={{ fontFamily: "Georgia, serif" }}>Built an MCP?</h2>
            <p className="mx-auto mb-6 max-w-xl text-zinc-300">
              Get it listed. We review every submission by hand — DM us on X and we'll take a look.
            </p>
            <Link to="/orbitxmcp/submit"
              className="inline-block rounded-full bg-[#17ff4d] px-8 py-3.5 font-bold text-black transition-transform hover:scale-105">
              SUBMIT YOUR MCP
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
