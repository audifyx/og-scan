import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import catalogJson from "./tools-catalog.json";

/* ── Types ─────────────────────────────────────────────────────────── */

type ToolEntry = {
  name: string;
  description: string;
  category: string;
  auth: string;
  readOnly: boolean;
  variants?: number;
  chains?: string[];
};

const TOOLS = catalogJson as ToolEntry[];

const CATEGORY_ORDER = [
  "Start Here",
  "Auth & Access",
  "Token Intelligence",
  "Screeners",
  "Trading",
  "Token Launches",
  "Wallets",
  "Paper Trading",
  "NFTs",
  "Life / City",
  "Social & X",
  "Agents",
  "Credits & Access",
  "KOLs & Signals",
  "Charts & DEX",
  "Utilities",
];

/* ── Small building blocks ─────────────────────────────────────────── */

function ToolName({ name }: { name: string }) {
  return (
    <code className="break-all font-mono text-[13px] font-semibold text-og-lime">
      {name}
    </code>
  );
}

function AuthBadge({ auth }: { auth: string }) {
  const open = auth !== "required";
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
        (open
          ? "border-og-lime/40 bg-og-lime/10 text-og-lime"
          : "border-og-gold/40 bg-og-gold/10 text-og-gold")
      }
    >
      {open ? "Open" : "Requires auth"}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-zinc-300 transition-colors hover:border-og-lime/50 hover:text-og-lime"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function PromptCard({
  category,
  prompt,
  uses,
}: {
  category: string;
  prompt: string;
  uses: string[];
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-[#0b0d14] p-5">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-og-cyan">
        {category}
      </div>
      <div className="mb-3 flex flex-1 items-start gap-3 rounded-xl bg-black/50 p-4">
        <p className="flex-1 font-mono text-[13px] leading-relaxed text-zinc-200">
          {prompt}
        </p>
        <CopyButton text={prompt} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
        <span className="font-semibold uppercase tracking-wider">Uses:</span>
        {uses.map((u) => (
          <ToolName key={u} name={u} />
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ kicker, title, blurb }: { kicker: string; title: string; blurb?: string }) {
  return (
    <div className="mb-8">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.35em] text-og-lime">
        {kicker}
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {blurb && <p className="mt-3 max-w-3xl text-[15px] text-zinc-400">{blurb}</p>}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function McpGuidePage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [authFilter, setAuthFilter] = useState<"all" | "open" | "required">("all");

  const categories = useMemo(() => {
    const present = new Set(TOOLS.map((t) => t.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, []);

  const counts = useMemo(() => {
    const screener = TOOLS.find((t) => t.name === "orbitx_screen_*");
    return {
      total: TOOLS.length,
      tools: TOOLS.length - (screener ? 1 : 0),
      variants: screener?.variants ?? 0,
      categories: categories.length,
    };
  }, [categories]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (cat !== "All" && t.category !== cat) return false;
      if (authFilter === "open" && t.auth === "required") return false;
      if (authFilter === "required" && t.auth !== "required") return false;
      if (needle && !`${t.name} ${t.description}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [q, cat, authFilter]);

  const screener = useMemo(() => filtered.find((t) => t.name === "orbitx_screen_*"), [filtered]);
  const rest = useMemo(() => filtered.filter((t) => t.name !== "orbitx_screen_*"), [filtered]);

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute -top-40 left-[12%] h-[520px] w-[520px] rounded-full bg-og-lime/10 blur-[140px]" />
        <div className="pointer-events-none absolute top-40 right-0 h-[420px] w-[420px] rounded-full bg-og-cyan/10 blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-24 text-center">
          <div className="mb-6 text-xs uppercase tracking-[0.4em] text-og-lime">
            Official Guide · OrbitX Agent MCP
          </div>
          <h1 className="font-display mx-auto mb-6 max-w-4xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Plug your agent<br />into <span className="text-og-lime">OrbitX</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-zinc-300">
            Every tool your AI assistant needs to scan tokens, trade, launch,
            and build on OrbitX — live data, wired for AI. Reads are open;
            signing tools authenticate through OrbitX.
          </p>
          <code className="mb-8 inline-block break-all rounded-xl bg-black/50 px-5 py-3 font-mono text-sm text-og-lime">
            GET https://www.orbitx.world/api/mcp
          </code>
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#catalog"
              className="rounded-full bg-og-lime px-8 py-3.5 font-bold text-black transition-transform hover:scale-105"
            >
              BROWSE TOOLS
            </a>
            <Link
              to="/mcp"
              className="rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white hover:bg-white/5"
            >
              CONNECT AN ASSISTANT
            </Link>
          </div>
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-zinc-400">
            <span><b className="text-2xl text-white">{counts.tools}</b><br />tools live</span>
            <span><b className="text-2xl text-white">{counts.variants.toLocaleString()}</b><br />screener variants</span>
            <span><b className="text-2xl text-white">{counts.categories}</b><br />categories</span>
          </div>
        </div>
      </div>

      {/* ── Honest capability notes ── */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-og-lime/25 bg-og-lime/5 p-5">
            <h3 className="mb-1.5 font-bold text-og-lime">✅ Trading is live</h3>
            <p className="text-sm text-zinc-300">
              <ToolName name="orbitx_app_buy" /> and <ToolName name="orbitx_app_sell" /> execute real trades
              (backend-signed). Always verify on-chain by transaction signature — never trust an "ok" response alone.
            </p>
          </div>
          <div className="rounded-2xl border border-og-gold/25 bg-og-gold/5 p-5">
            <h3 className="mb-1.5 font-bold text-og-gold">⚠️ Coin launches are rolling out</h3>
            <p className="text-sm text-zinc-300">
              Launch-execution tools (<ToolName name="orbitx_app_launch" />) are experimental and still rolling out.
              Treat the launch flow below as coming soon — verify the current status before promising it to users.
            </p>
          </div>
          <div className="rounded-2xl border border-og-cyan/25 bg-og-cyan/5 p-5">
            <h3 className="mb-1.5 font-bold text-og-cyan">🔑 Signing needs the auth-code flow</h3>
            <p className="text-sm text-zinc-300">
              Backend-signed trades need the dashboard auth-code flow: call <ToolName name="orbitx_auth_link" />,
              approve in the dashboard, then <ToolName name="orbitx_auth_status" />. Reads work with the OAuth bearer.
            </p>
          </div>
          <div className="rounded-2xl border border-og-blood/25 bg-og-blood/5 p-5">
            <h3 className="mb-1.5 font-bold text-red-300">🧪 NFT minting is experimental</h3>
            <p className="text-sm text-zinc-300">
              NFT minting via the MCP (<ToolName name="orbitx_mint_nft" />) is marked experimental — status unverified.
              NFT marketplace reads (<ToolName name="orbitx_nft_listings" />, <ToolName name="orbitx_nft_items" />) are live.
            </p>
          </div>
        </div>
      </div>

      {/* ── 1. Tool catalog ── */}
      <div id="catalog" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-10">
        <SectionTitle
          kicker="01 · Tool catalog"
          title="Search every tool"
          blurb={`${counts.total} catalog entries pulled live from the MCP endpoint — ${counts.tools} distinct tools plus the orbitx_screen_* family, which expands to ${counts.variants.toLocaleString()} prebuilt screener variants (chains × windows × categories).`}
        />

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tools by name or description…"
          className="mb-5 block w-full rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-white placeholder-zinc-500 outline-none focus:border-og-lime/60"
        />

        <div className="mb-3 flex flex-wrap gap-2">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={
                "rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors " +
                (cat === c
                  ? "border-og-lime bg-og-lime text-black"
                  : "border-white/15 bg-white/5 text-zinc-300 hover:border-og-lime/50")
              }
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mb-8 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All auth" },
            { id: "open", label: "Open" },
            { id: "required", label: "Requires auth" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setAuthFilter(f.id as "all" | "open" | "required")}
              className={
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors " +
                (authFilter === f.id
                  ? "border-og-cyan bg-og-cyan/20 text-og-cyan"
                  : "border-white/10 text-zinc-400 hover:border-og-cyan/40")
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Screener expanded card */}
        {screener && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-og-lime/40 bg-gradient-to-br from-og-lime/10 to-transparent p-6">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <ToolName name={screener.name} />
              <AuthBadge auth={screener.auth} />
              <span className="rounded-full bg-og-lime px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                {screener.variants?.toLocaleString()} variants
              </span>
            </div>
            <p className="mb-4 max-w-3xl text-sm text-zinc-300">{screener.description}</p>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  How it works
                </div>
                <p className="text-sm text-zinc-300">
                  One tool family, endless scans. Pick a <b className="text-white">category</b> (trending, new,
                  runners, graduating, KOL, gainers, volume…), a <b className="text-white">chain</b>, and a{" "}
                  <b className="text-white">time window</b> (1m–24h) — the variant name composes the parts in order:
                </p>
                <code className="mt-2 block rounded-lg bg-black/50 p-3 font-mono text-[13px] text-og-lime">
                  orbitx_screen_&lt;category&gt;_&lt;chain&gt;_&lt;window&gt;
                </code>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Example shapes (illustrative)
                </div>
                <div className="space-y-1.5 font-mono text-[13px] text-zinc-300">
                  <div>orbitx_screen_trending_solana_1h</div>
                  <div>orbitx_screen_new_base_24h</div>
                  <div>orbitx_screen_gainers_ethereum_1m</div>
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">
                  Shapes shown to illustrate the pattern — discover exact variant names live via search/fetch.
                </p>
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Chains covered
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(screener.chains ?? []).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tool cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-[#0b0d14] p-5 transition-colors hover:border-white/25"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <ToolName name={t.name} />
                <AuthBadge auth={t.auth} />
              </div>
              <p className="mb-3 flex-1 text-[13px] leading-relaxed text-zinc-400">{t.description}</p>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                {t.category}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-zinc-500">No tools match your filters.</div>
        )}
        <p className="mt-4 text-center text-xs text-zinc-600">
          Showing {filtered.length} of {counts.total} catalog entries.
        </p>
      </div>

      {/* ── 2. Example prompts ── */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <SectionTitle
          kicker="02 · Example prompts"
          title="Copy-paste prompts"
          blurb="Drop these straight into any assistant connected to the OrbitX MCP. Replace the <placeholders> with your values."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PromptCard
            category="Token Intelligence"
            prompt="Scan this mint <mint> and give me the safety verdict: honeypot check, LP lock, and insider concentration."
            uses={["orbitx_crypto_scan", "orbitx_get_safety", "orbitx_get_forensics"]}
          />
          <PromptCard
            category="Screeners"
            prompt="Show me trending Solana tokens from the last hour, sorted by volume."
            uses={["orbitx_screen_*"]}
          />
          <PromptCard
            category="Trading"
            prompt="Buy $5 of <mint> with SOL at 200bps slippage, then show me the transaction signature so I can verify it on-chain."
            uses={["orbitx_trade_quote", "orbitx_app_buy"]}
          />
          <PromptCard
            category="Token Launches"
            prompt="Check whether the name 'OrbitRocket' / ticker $ROKT is available, then walk me through launching it step by step."
            uses={["orbitx_launch_check"]}
          />
          <PromptCard
            category="Wallets"
            prompt="Show me wallet <address>: SOL balance, holdings, and realized/unrealized PnL."
            uses={["orbitx_get_wallet", "orbitx_get_balance"]}
          />
          <PromptCard
            category="Social & X"
            prompt="List the open group chats, then let me join the OrbitX one."
            uses={["orbitx_gc_list", "orbitx_gc_join"]}
          />
          <PromptCard
            category="Paper Trading"
            prompt="Show me what the paper agents are buying right now, then pull one agent's full book: equity, win rate, and thesis."
            uses={["orbitx_paper_buying", "orbitx_paper_agent"]}
          />
          <PromptCard
            category="Auth & Access"
            prompt="Am I authenticated right now? If not, walk me through linking this chat."
            uses={["orbitx_whoami", "orbitx_auth_link"]}
          />
        </div>
      </div>

      {/* ── 3. Walkthroughs ── */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <SectionTitle
          kicker="03 · Walkthroughs"
          title="Use it end to end"
          blurb="Numbered steps with the real tool names, in order. Follow them top to bottom."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* (a) Scan a token */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0d14] p-6">
            <h3 className="mb-1 font-display text-xl font-bold">A. Scan a token end to end</h3>
            <p className="mb-5 text-sm text-zinc-400">From mint address to safety verdict in five calls.</p>
            <ol className="space-y-4">
              {[
                { tool: "search", text: "Get the mint. Paste the address, or search a ticker to resolve it." },
                { tool: "orbitx_crypto_scan", text: "One-shot aggregator: safety + forensics + token payload for the mint." },
                { tool: "orbitx_get_safety", text: "Honeypot / tradeability check — can you actually buy and sell this mint?" },
                { tool: "orbitx_get_forensics", text: "Dev wallet, first buyer, bundles, concentration, LP lock, safety flags." },
                { tool: "orbitx_xray", text: "Deep risk scan (holders, risks, flags) — plus orbitx_get_chart for price action." },
              ].map((s, i) => (
                <li key={s.tool} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-og-lime/15 font-mono text-xs font-bold text-og-lime">
                    {i + 1}
                  </span>
                  <div>
                    <ToolName name={s.tool} />
                    <p className="mt-0.5 text-[13px] text-zinc-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-xl bg-black/40 p-3.5 text-[13px] text-zinc-400">
              Only if everything checks out: get a quote with <ToolName name="orbitx_trade_quote" /> (no signature),
              then <ToolName name="orbitx_app_buy" /> — and verify the returned signature on-chain yourself.
            </p>
          </div>

          {/* (b) Check a wallet */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0d14] p-6">
            <h3 className="mb-1 font-display text-xl font-bold">B. Check a wallet</h3>
            <p className="mb-5 text-sm text-zinc-400">Portfolio, balances, and trade history — all open reads.</p>
            <ol className="space-y-4">
              {[
                { tool: "orbitx_get_wallet", text: "Wallet portfolio: SOL balance, holdings, realized/unrealized PnL." },
                { tool: "orbitx_get_balance", text: "Token or SOL balance for the wallet — drill into a single asset." },
                { tool: "orbitx_get_swaps", text: "Recent buy/sell swaps for the wallet — the full trade history." },
              ].map((s, i) => (
                <li key={s.tool} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-og-cyan/15 font-mono text-xs font-bold text-og-cyan">
                    {i + 1}
                  </span>
                  <div>
                    <ToolName name={s.tool} />
                    <p className="mt-0.5 text-[13px] text-zinc-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* (c) Launch flow */}
          <div className="rounded-2xl border border-og-gold/30 bg-[#0b0d14] p-6">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-bold">C. Launch a coin</h3>
              <span className="rounded-full border border-og-gold/50 bg-og-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-og-gold">
                Coming soon · experimental
              </span>
            </div>
            <p className="mb-5 text-sm text-zinc-400">
              Launch execution is still rolling out. The prep tools work today — treat the final launch step as
              experimental and verify its current status before promising it to users.
            </p>
            <ol className="space-y-4">
              {[
                { tool: "orbitx_launch_check", text: "Confirm the launch name / symbol is available (duplicate guard)." },
                { tool: "orbitx_vanity_mint", text: "Generate a vanity mint keypair (e.g. suffix obx) for the new launch." },
                { tool: "orbitx_launch_ipfs", text: "Upload token metadata / image to IPFS — returns the metadataUri for the create step." },
                { tool: "orbitx_app_launch", text: "Execute the launch from the desk wallet (backend signs). Experimental — verify before use." },
              ].map((s, i) => (
                <li key={s.tool} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-og-gold/15 font-mono text-xs font-bold text-og-gold">
                    {i + 1}
                  </span>
                  <div>
                    <ToolName name={s.tool} />
                    <p className="mt-0.5 text-[13px] text-zinc-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* (d) Connect an assistant */}
          <div className="rounded-2xl border border-white/10 bg-[#0b0d14] p-6">
            <h3 className="mb-1 font-display text-xl font-bold">D. Connect an AI assistant</h3>
            <p className="mb-5 text-sm text-zinc-400">Link Claude, ChatGPT, or any MCP client to OrbitX in five minutes.</p>
            <ol className="space-y-4">
              {[
                { tool: "/mcp", text: "Open the /mcp connect page and point your assistant at the MCP endpoint with a standard handshake.", raw: true },
                { tool: "orbitx_menu", text: "See the branded capability menu — what the MCP can do for you." },
                { tool: "orbitx_auth_link", text: "Returns a clickable approval URL (or use a dashboard-pasted authCode)." },
                { tool: "orbitx_auth_status", text: "Pass the authCode to link this chat. Keep using that authCode on every later tool." },
                { tool: "orbitx_whoami", text: "Confirm your session identity — userId, agentId, auth source." },
              ].map((s, i) => (
                <li key={s.tool} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-og-lime/15 font-mono text-xs font-bold text-og-lime">
                    {i + 1}
                  </span>
                  <div>
                    {s.raw ? (
                      <Link to="/mcp" className="font-mono text-[13px] font-semibold text-og-lime underline">
                        {s.tool}
                      </Link>
                    ) : (
                      <ToolName name={s.tool} />
                    )}
                    <p className="mt-0.5 text-[13px] text-zinc-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 rounded-xl bg-black/40 p-3.5 text-[13px] text-zinc-400">
              Reads work immediately with the OAuth bearer. Signing tools (<ToolName name="orbitx_app_buy" />,{" "}
              <ToolName name="orbitx_app_sell" />) need the authCode passed on every call.
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. Troubleshooting ── */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <SectionTitle
          kicker="04 · Troubleshooting"
          title="When something breaks"
          blurb="The five issues that bite people, and exactly how to get unstuck."
        />
        <div className="space-y-3">
          {[
            {
              symptom: "401 / unauthorized errors",
              fix: "Re-authenticate. Make sure a credential is attached in your MCP client, or re-run the auth flow: orbitx_auth_link → approve → orbitx_auth_status. Confirm with orbitx_whoami that your session resolves to the right userId/agentId.",
            },
            {
              symptom: "Signing tools fail but reads work",
              fix: "Reads work with the OAuth bearer, but backend-signed tools (orbitx_app_buy, orbitx_app_sell) need the authCode passed on every call. Go through the dashboard auth-code flow once — orbitx_auth_link returns the approval URL — then orbitx_auth_status, and keep using that authCode.",
            },
            {
              symptom: "Rate limits / throttled responses",
              fix: "Back off and retry. Batch your reads, cache safety/forensics results for a mint instead of re-scanning, and avoid hammering screener variants in tight loops.",
            },
            {
              symptom: "www vs apex 308 gotcha",
              fix: "Always use https://www.orbitx.world — the apex domain 308-redirects, and some MCP clients don't follow redirects on POST. If your handshake dies with a redirect, the missing www is almost always the cause.",
            },
            {
              symptom: "Stuck in group-chat mode",
              fix: "If every message keeps posting to a group chat (sticky GC mode), call orbitx_gc_leave immediately. It exits the focused chat — you can join back anytime with orbitx_gc_join.",
            },
          ].map((t) => (
            <div key={t.symptom} className="rounded-2xl border border-white/10 bg-[#0b0d14] p-5">
              <h3 className="mb-1.5 font-bold text-white">
                <span className="mr-2 text-og-blood">●</span>
                {t.symptom}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">{t.fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer CTA ── */}
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-6">
        <div className="relative overflow-hidden rounded-3xl border border-og-lime/20 bg-og-lime/5 p-10 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-og-lime/10 blur-[100px]" />
          <div className="relative">
            <h2 className="font-display mb-3 text-4xl font-bold">Ready to connect?</h2>
            <p className="mx-auto mb-6 max-w-xl text-zinc-300">
              Point your assistant at the OrbitX Agent MCP and start scanning. Free — no API keys, no signup.
            </p>
            <Link
              to="/mcp"
              className="inline-block rounded-full bg-og-lime px-8 py-3.5 font-bold text-black transition-transform hover:scale-105"
            >
              CONNECT AN ASSISTANT
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-zinc-600">
          Tool catalog generated live from the OrbitX Agent MCP endpoint. Tool availability and status can change — this guide
          reflects the catalog as published.
        </p>
      </div>
    </div>
  );
}
