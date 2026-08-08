import React, { useMemo, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, Clipboard, Code2, Copy, Globe2, KeyRound, Layers3, Network, RefreshCw, ShieldCheck, Sparkles, Terminal, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Decision = "blocked" | "flagged" | "clear" | "degraded";

interface DemoResult {
  blocked: boolean;
  flagged: boolean;
  warning?: string;
  hardMatch?: { name: string; ticker: string; source: string } | null;
  matches?: Array<{ name: string; ticker: string; source: string; sim: number; hard?: boolean; chainId?: string }>;
}

const FALLBACK_RESULT: DemoResult = {
  blocked: false,
  flagged: true,
  warning: "verification_degraded",
  matches: [],
};

const installCode = `// Your server — never expose credentials in the browser\nexport async function checkOriginality(input) {\n  const response = await fetch(\n    "https://ogscan.fun/api/orbitx/anti-vamp-check",\n    {\n      method: "POST",\n      headers: { "content-type": "application/json" },\n      body: JSON.stringify({\n        name: input.name,\n        ticker: input.ticker,\n        chainId: input.chainId,\n        assetType: input.assetType ?? "token"\n      })\n    }\n  );\n\n  if (!response.ok) throw new Error("Anti-vamp check unavailable");\n  return response.json();\n}`;

const responseCode = `type AntiVampResult = {\n  blocked: boolean;\n  flagged: boolean;\n  hardMatch: Match | null;\n  matches: Match[];\n  checkedChains: string[];\n  sourceHealth: Record<string, boolean>;\n  warning?: "verification_degraded";\n};`;

const decisionCards = [
  { key: "blocked" as Decision, label: "Hard block", title: "Exact clones do not launch", text: "A normalized exact match or near-identical identity stops the launch before funds or metadata are committed.", icon: XCircle, tone: "danger" },
  { key: "flagged" as Decision, label: "Soft route", title: "Lookalikes still ship safely", text: "A suspicious overlap can launch, but creator fees or royalties route to OrbitX buyback instead.", icon: Zap, tone: "warning" },
  { key: "degraded" as Decision, label: "Fail open", title: "Source outages never freeze you", text: "If a market source is unavailable, the result is explicitly degraded and the platform can continue with its policy.", icon: RefreshCw, tone: "info" },
];

const supportedLanes = [
  { icon: Network, title: "SPL + Token-2022", text: "Solana registry, pump.fun, and market discovery." },
  { icon: Globe2, title: "EVM launches", text: "Base, Ethereum, BNB, Arbitrum, Optimism, Polygon, and more." },
  { icon: Layers3, title: "NFT collections", text: "Collection name, symbol, and individual item identity." },
];

function decisionFor(result: DemoResult): Decision {
  if (result.warning) return "degraded";
  if (result.blocked) return "blocked";
  if (result.flagged) return "flagged";
  return "clear";
}

function CodeBlock({ code, label, onCopy, copied }: { code: string; label: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070a12] shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40"><Terminal className="size-3.5" /> {label}</div>
        <button onClick={onCopy} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white" aria-label={`Copy ${label}`}>
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 text-cyan-100/80"><code>{code}</code></pre>
    </div>
  );
}

export default function VampPortal() {
  const [name, setName] = useState("OrbitX Nova");
  const [ticker, setTicker] = useState("NOVA");
  const [chainId, setChainId] = useState("base");
  const [assetType, setAssetType] = useState("token");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const decision = useMemo(() => result ? decisionFor(result) : null, [result]);
  const copy = async (value: string, key: string) => {
    await navigator.clipboard?.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const runCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/orbitx/anti-vamp-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, ticker, chainId, assetType }) });
      if (!response.ok) throw new Error("unavailable");
      setResult(await response.json());
    } catch {
      setResult(FALLBACK_RESULT);
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#060810] text-white selection:bg-cyan-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 opacity-70 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="relative mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/10 py-5">
          <a href="/" className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200"><ShieldCheck className="size-5" /></span><span className="font-mono text-sm font-black tracking-[0.2em]">ORBITX / VAMP</span></a>
          <nav className="hidden items-center gap-6 text-xs font-semibold text-white/50 sm:flex"><a href="#how" className="transition hover:text-white">How it works</a><a href="#integrate" className="transition hover:text-white">Integrate</a><a href="#faq" className="transition hover:text-white">FAQ</a><a href="#demo" className="rounded-full border border-cyan-300/30 px-4 py-2 text-cyan-200 transition hover:bg-cyan-300/10">Run a check</a></nav>
        </header>

        <section className="grid gap-12 pb-24 pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200"><Sparkles className="size-3.5" /> Originality infrastructure for launchpads</div>
            <h1 className="max-w-4xl text-balance text-5xl font-black leading-[.95] tracking-[-0.06em] sm:text-7xl">Stop the clone <span className="text-cyan-200">before</span> it becomes the brand.</h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-white/55">OrbitX Anti-Vamp gives token, NFT, and launch platforms one shared originality layer for names, tickers, symbols, and lookalike identities across chains.</p>
            <div className="mt-9 flex flex-wrap gap-3"><a href="#integrate" className="inline-flex items-center gap-2 rounded-xl bg-cyan-200 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100">Start integrating <ArrowRight className="size-4" /></a><a href="#how" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"><Code2 className="size-4" /> Read the model</a></div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35"><span>Token + NFT</span><span>Multi-chain</span><span>Fail-open by design</span></div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-cyan-300/10 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">Decision rail / live policy</span><span className="flex items-center gap-2 text-[10px] font-bold text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_currentColor]" /> ONLINE</span></div>
              <div className="grid gap-3">{decisionCards.map(card => { const Icon = card.icon; return <div key={card.key} className={cn("rounded-2xl border p-4 transition", card.tone === "danger" ? "border-rose-300/15 bg-rose-300/[0.04]" : card.tone === "warning" ? "border-amber-300/15 bg-amber-300/[0.04]" : "border-cyan-300/15 bg-cyan-300/[0.04]")}><div className="flex gap-3"><Icon className={cn("mt-0.5 size-5", card.tone === "danger" ? "text-rose-300" : card.tone === "warning" ? "text-amber-200" : "text-cyan-200")} /><div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{card.label}</div><h2 className="mt-1 font-bold">{card.title}</h2><p className="mt-1 text-sm leading-6 text-white/45">{card.text}</p></div></div></div> })}</div>
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-8 border-t border-white/10 py-24"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">01 / The model</div><h2 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">A reputation layer for launch infrastructure.</h2><p className="mt-5 max-w-md leading-7 text-white/50">Vamp checks are designed to be fast at the edge of a launch, strict on proven clones, and transparent when discovery sources are incomplete.</p></div><div className="grid gap-3 sm:grid-cols-2">{[{ n: "01", title: "Normalize", text: "Case, punctuation, leetspeak, and identity fragments collapse into comparable forms." }, { n: "02", title: "Score context", text: "Registry matches are strict. Market matches account for common ticker reuse." }, { n: "03", title: "Scan chains", text: "Check the target chain plus relevant market sources for existing identities." }, { n: "04", title: "Route policy", text: "Hard matches block. Soft matches launch with fees or royalties routed away." }].map(item => <div key={item.n} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><span className="font-mono text-xs text-cyan-200/70">{item.n}</span><h3 className="mt-8 text-lg font-bold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-white/45">{item.text}</p></div>)}</div></div></section>

        <section className="border-y border-white/10 py-20"><div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">Coverage map</div><h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">One policy across every launch lane.</h2></div><p className="max-w-sm text-sm leading-6 text-white/45">No platform-specific clone logic to maintain. Use the same result contract for tokens, collections, and items.</p></div><div className="grid gap-3 md:grid-cols-3">{supportedLanes.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-white/10 bg-[#0b0f1b] p-5"><Icon className="size-5 text-cyan-200" /><h3 className="mt-10 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/45">{text}</p></div>)}</div><div className="mt-3 flex flex-wrap gap-2">{["Solana", "Base", "Ethereum", "BNB", "Arbitrum", "Optimism", "Polygon", "Avalanche", "Blast", "Sonic", "Monad"].map(chain => <span key={chain} className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-white/45">{chain}</span>)}</div></section>

        <section id="demo" className="scroll-mt-8 py-24"><div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr]"><div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">Try the policy</div><h2 className="mt-4 text-4xl font-black tracking-[-0.04em]">See what your launch would return.</h2><p className="mt-4 leading-7 text-white/50">This demo calls the same public endpoint your backend can call. If a source is unavailable, the UI shows degraded verification instead of pretending certainty.</p><div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50"><div className="flex gap-3"><KeyRound className="size-4 shrink-0 text-cyan-200" /><span>Run checks server-side in production. Keep any platform credentials and launch decisions off the client.</span></div></div></div><div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-white/55">Name<input value={name} onChange={e => setName(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-200/60" /></label><label className="text-xs font-bold text-white/55">Ticker / symbol<input value={ticker} onChange={e => setTicker(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm uppercase text-white outline-none transition focus:border-cyan-200/60" /></label><label className="text-xs font-bold text-white/55">Target chain<select value={chainId} onChange={e => setChainId(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-cyan-200/60"><option value="base">Base</option><option value="solana">Solana</option><option value="ethereum">Ethereum</option><option value="arbitrum">Arbitrum</option></select></label><label className="text-xs font-bold text-white/55">Asset type<select value={assetType} onChange={e => setAssetType(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none focus:border-cyan-200/60"><option value="token">Token</option><option value="nft_collection">NFT collection</option><option value="nft_item">NFT item</option></select></label></div><button onClick={runCheck} disabled={checking || !name.trim()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-200 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">{checking ? <RefreshCw className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{checking ? "Checking sources…" : "Run originality check"}</button>{result && <div className={cn("mt-5 rounded-2xl border p-4", decision === "blocked" ? "border-rose-300/30 bg-rose-300/10" : decision === "flagged" ? "border-amber-300/30 bg-amber-300/10" : decision === "degraded" ? "border-cyan-300/30 bg-cyan-300/10" : "border-emerald-300/30 bg-emerald-300/10")}><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 text-current" /><div><div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">{decision === "blocked" ? "Launch blocked" : decision === "flagged" ? "Soft flag / route fees" : decision === "degraded" ? "Verification degraded / fail open" : "No collision detected"}</div><p className="mt-1 text-sm leading-6 text-white/70">{result.warning ? "A source was unavailable. Continue under your platform's degraded verification policy and retry before final settlement." : result.hardMatch ? `Matched ${result.hardMatch.name} (${result.hardMatch.ticker}) from ${result.hardMatch.source}.` : result.flagged ? "A lookalike was found. Route creator fees or royalties to your buyback policy." : "No hard or soft collision was returned for this identity."}</p></div></div></div>}</div></div></section>

        <section id="integrate" className="scroll-mt-8 border-t border-white/10 py-24"><div className="mb-10 max-w-2xl"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">02 / Integrate</div><h2 className="mt-4 text-4xl font-black tracking-[-0.04em]">Install the policy at your final launch gate.</h2><p className="mt-4 leading-7 text-white/50">There is no browser SDK to trust with launch decisions. Add a tiny server adapter, call the endpoint before building the transaction, then persist the returned route.</p></div><div className="grid gap-5 lg:grid-cols-2"><CodeBlock code="pnpm add @orbitx/anti-vamp\n# or call the endpoint directly from your server" label="Install pattern" onCopy={() => copy("pnpm add @orbitx/anti-vamp", "install")} copied={copied === "install"} /><CodeBlock code={installCode} label="Server adapter" onCopy={() => copy(installCode, "adapter")} copied={copied === "adapter"} /></div><div className="mt-5"><CodeBlock code={responseCode} label="Response contract" onCopy={() => copy(responseCode, "response")} copied={copied === "response"} /></div><div className="mt-8 grid gap-3 sm:grid-cols-3">{[{ icon: Clipboard, title: "1. Preflight", text: "Call immediately before creating the launch transaction." }, { icon: ShieldCheck, title: "2. Enforce", text: "Block hard matches and persist the soft fee route." }, { icon: Check, title: "3. Audit", text: "Store source health, matches, and the policy decision." }].map(step => <div key={step.title} className="rounded-2xl border border-white/10 p-4"><step.icon className="size-4 text-cyan-200" /><div className="mt-5 text-sm font-bold">{step.title}</div><p className="mt-1 text-sm leading-6 text-white/45">{step.text}</p></div>)}</div></section>

        <section id="faq" className="scroll-mt-8 border-t border-white/10 py-24"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">Operational notes</div><h2 className="mt-4 text-4xl font-black tracking-[-0.04em]">Protect trust without false certainty.</h2><p className="mt-4 leading-7 text-white/50">Platforms use Anti-Vamp because identity abuse compounds quickly: it fragments liquidity, confuses users, and rewards copycats. The model makes the tradeoff explicit at every step.</p></div><div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.025]">{[{ q: "Does a soft flag block a launch?", a: "No. Soft flags are designed for a policy route: launch may continue, while creator fees or NFT royalties route to your platform buyback or protection account." }, { q: "What happens when a source is down?", a: "The response includes verification_degraded. Never convert an outage into a hard block. Show the state, retry, and apply your own risk policy." }, { q: "Can we use this for our own registry?", a: "Yes. Registry matches are the strictest context. Store your own first-party names and feed them into the same comparison model rather than inventing a second scorer." }, { q: "Why not only compare exact tickers?", a: "Popular tickers are reused legitimately. Anti-Vamp combines normalized names, identity fragments, similarity, and context to reduce false positives." }].map((item, index) => <div key={item.q} className="p-5"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 text-left font-bold"><span>{item.q}</span><ChevronDown className={cn("size-4 shrink-0 text-white/40 transition", openFaq === index && "rotate-180 text-cyan-200")} /></button>{openFaq === index && <p className="mt-3 max-w-2xl text-sm leading-7 text-white/50">{item.a}</p>}</div>)}</div></div></section>

        <footer className="flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between"><span className="font-mono tracking-[0.15em]">ORBITX ANTI-VAMP / ORIGINALITY AS INFRASTRUCTURE</span><a href="mailto:builders@ogscan.fun" className="text-cyan-200/70 transition hover:text-cyan-200">Talk to the team <ArrowRight className="ml-1 inline size-3" /></a></footer>
      </div>
    </main>
  );
}
