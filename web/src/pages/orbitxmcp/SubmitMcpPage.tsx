import { useState } from "react";
import { Link } from "react-router-dom";

const X_HANDLE = "orbitx_wrld";
const DM_URL = `https://x.com/${X_HANDLE}`;

export default function SubmitMcpPage() {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [desc, setDesc] = useState("");

  const dmText = `Hey! I'd like to submit my MCP to the OrbitX marketplace:\n\nName: ${name || "[your MCP name]"}\nEndpoint: ${endpoint || "[https://…/api/mcp]"}\nWhat it does: ${desc || "[one-liner]"}\n\nIt's public data, no auth needed.`;
  const dmLink = `https://x.com/messages/compose?text=${encodeURIComponent(dmText)}`;

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <Link to="/orbitxmcp" className="mb-8 inline-block text-sm text-zinc-400 hover:text-white">← Marketplace</Link>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight">Submit your MCP</h1>
        <p className="mb-8 text-lg text-zinc-400">
          We review every submission by hand. If your MCP serves live public data with no auth,
          it belongs here. Here's how it works:
        </p>

        <div className="mb-10 space-y-4">
          {[
            ["1", "Fill in your details", "Name, endpoint URL, and a one-line description below."],
            ["2", "DM us on X", "Hit the button — it opens a DM to @orbitx_wrld with everything pre-filled."],
            ["3", "We review it", "We check the endpoint is live, public, and useful. Manual review, usually within a day or two."],
            ["4", "You go live", "Approved MCPs get a full App Store-style page: banner, tools, connect info."],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-4 rounded-2xl border border-white/10 bg-[#0b0d14] p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#17ff4d] font-bold text-black">{n}</div>
              <div>
                <div className="font-bold">{t}</div>
                <div className="text-sm text-zinc-400">{d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0b0d14] p-8">
          <h2 className="mb-5 text-2xl font-bold">Your MCP details</h2>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-zinc-400">MCP name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nebula"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-[#17ff4d]/60" />
          </label>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-zinc-400">MCP endpoint URL</span>
            <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://your-mcp.vercel.app/api/mcp"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-sm outline-none focus:border-[#17ff4d]/60" />
          </label>
          <label className="mb-6 block">
            <span className="mb-1 block text-sm text-zinc-400">What does it do?</span>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Live weather data for agents…"
              rows={3} className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-[#17ff4d]/60" />
          </label>

          <div className="rounded-xl bg-black/40 p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">DM preview</div>
            <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300">{dmText}</pre>
          </div>

          <a href={dmLink} target="_blank" rel="noreferrer"
            className="mt-6 block rounded-full bg-[#17ff4d] py-4 text-center text-lg font-bold text-black transition-transform hover:scale-[1.02]">
            DM @orbitx_wrld on X
          </a>
          <p className="mt-3 text-center text-sm text-zinc-500">
            Or DM manually: <a href={DM_URL} target="_blank" rel="noreferrer" className="text-[#17ff4d]">x.com/{X_HANDLE}</a>
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-zinc-300">
          <span className="font-bold text-amber-400">Requirements:</span> live public endpoint, no auth or API keys,
          real tools (not stubs), and data that stays fresh. We reject private, broken, or key-gated MCPs.
        </div>
      </div>
    </div>
  );
}
