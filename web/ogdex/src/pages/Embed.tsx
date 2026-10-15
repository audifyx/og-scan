import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Code, Copy, CheckCircle2, ExternalLink, Monitor } from "lucide-react";

const BASE = "https://ogscan.fun";

export default function Embed() {
  const [mint, setMint]     = useState("So11111111111111111111111111111111111111112");
  const [chain, setChain]   = useState("solana");
  const [theme, setTheme]   = useState<"dark"|"light">("dark");
  const [size, setSize]     = useState<"sm"|"md"|"lg">("md");
  const [copied, setCopied] = useState(false);

  const snippet = `<script
  src="${BASE}/widget.js"
  data-mint="${mint}"
  data-chain="${chain}"
  data-theme="${theme}"
  data-size="${size}"
></script>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const mcpSnippet = `# Tool manifest (GET)
curl ${BASE}/api/mcp

# Execute a tool (POST)
curl -X POST ${BASE}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"tool":"ogdex_get_token","params":{"mint":"${mint}","chain":"${chain}"}}'`;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="flex items-center gap-2.5 mb-1">
        <Code className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-black tracking-tight">Embed & Integrate</h1>
      </div>
      <p className="text-xs text-muted mb-6">
        Add live token data to any website with a single script tag. Or connect any AI assistant via the MCP endpoint.
      </p>

      {/* Widget configurator */}
      <div className="card p-5 mb-5">
        <div className="text-sm font-bold mb-4 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-accent" /> Token Widget
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-muted mb-1 block">Token Mint / Address</label>
            <input value={mint} onChange={(e) => setMint(e.target.value)} className="inp" placeholder="Token address" />
          </div>
          <div>
            <label className="text-[11px] text-muted mb-1 block">Chain</label>
            <select value={chain} onChange={(e) => setChain(e.target.value)} className="inp bg-panel2 text-sm">
              <option value="solana">Solana</option>
              <option value="ethereum">Ethereum</option>
              <option value="base">Base</option>
              <option value="bsc">BNB Chain</option>
              <option value="arbitrum">Arbitrum</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted mb-1 block">Theme</label>
            <div className="grid grid-cols-2 gap-1">
              {(["dark","light"] as const).map((t) => (
                <button key={t} onClick={() => setTheme(t)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${theme === t ? "bg-accent/15 text-accent border-accent/30" : "bg-panel2 text-muted border-line hover:text-white"}`}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted mb-1 block">Size</label>
            <div className="grid grid-cols-3 gap-1">
              {(["sm","md","lg"] as const).map((s) => (
                <button key={s} onClick={() => setSize(s)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${size === s ? "bg-accent/15 text-accent border-accent/30" : "bg-panel2 text-muted border-line hover:text-white"}`}>
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview note */}
        <div className="rounded-xl bg-panel2 border border-line p-3 mb-4 text-center">
          <div className="text-[11px] text-muted mb-2">Preview loads live from the API</div>
          <div className="text-[10px] text-muted/60">
            The widget renders in any &lt;div&gt; or inline in HTML — dark background, no iframe, 0 dependencies.
          </div>
        </div>

        {/* Code snippet */}
        <div className="relative">
          <pre className="rounded-xl bg-panel p-4 text-[11px] font-mono text-accent overflow-x-auto whitespace-pre border border-line">
            {snippet}
          </pre>
          <button
            onClick={copy}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-panel2 border border-line text-muted hover:text-accent transition-colors"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-up" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="mt-3 text-[10px] text-muted/70">
          Drop this anywhere in your &lt;body&gt;. The widget auto-initialises, needs no build step, and works in any HTML page, Notion embed, Webflow, or CMS.
        </div>
      </div>

      {/* MCP section */}
      <div className="card p-5">
        <div className="text-sm font-bold mb-3 flex items-center gap-2">
          <Code className="w-4 h-4 text-accent" /> AI Agent / MCP Integration
        </div>
        <p className="text-xs text-muted mb-4">
          Any MCP-compatible AI — Claude, GPT-4, custom LLM agents — can discover and call OrbitX Terminal tools directly via the manifest endpoint.
        </p>
        <div className="space-y-2">
          {[
            { label: "Manifest URL", value: `${BASE}/api/mcp`, method: "GET" },
            { label: "Tool execution", value: `${BASE}/api/mcp`, method: "POST" },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted w-28 shrink-0">{row.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${row.method === "GET" ? "bg-up/15 text-up" : "bg-accent/15 text-accent"}`}>{row.method}</span>
              <code className="text-[11px] font-mono text-white/80 flex-1 truncate">{row.value}</code>
              <a href={row.method === "GET" ? row.value : "#"} target="_blank" rel="noreferrer"
                className="text-muted hover:text-accent p-1">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
        <pre className="mt-4 rounded-xl bg-panel p-4 text-[10px] font-mono text-accent/90 overflow-x-auto whitespace-pre border border-line">
          {mcpSnippet}
        </pre>
        <p className="text-[10px] text-muted/60 mt-2">
          Available tools: <span className="text-accent/80">ogdex_get_token, ogdex_screen_tokens, ogdex_get_forensics, ogdex_get_ath, ogdex_get_wallet, ogdex_get_chart, ogdex_get_kols, ogdex_search</span>
        </p>
      </div>
    </div>
  );
}
