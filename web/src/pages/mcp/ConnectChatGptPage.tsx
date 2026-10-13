import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe2,
  Plug2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Wallet,
  LineChart,
  Database,
  FlaskConical,
  AlertTriangle,
} from "lucide-react";

/* ── Constants (exact values from the connect spec) ────────────────── */

const MCP_URL = "https://www.orbitx.world/api/mcp";
const CHATGPT_SETUP_URL = "https://chatgpt.com/plugins";
const ORBITX_URL = "https://www.orbitx.world/";

const STARTER_PROMPTS = [
  "Scan the crypto market and identify promising tokens, including the risks.",
  "Analyze this Solana token for holder concentration, liquidity, and contract risks.",
  "Research this wallet's activity and summarize its recent transactions.",
  "Show me the latest OrbitX market intelligence.",
  "Explain the risks before I consider a trade.",
];

const FEATURES = [
  {
    icon: ScanSearch,
    title: "Token discovery & market scanning",
    text: "Scan trending and newly launched tokens across chains, filtered by volume, liquidity, and momentum.",
  },
  {
    icon: ShieldCheck,
    title: "Token safety & risk analysis",
    text: "Honeypot checks, LP-lock verification, holder concentration, and contract risk flags before you ape.",
  },
  {
    icon: Wallet,
    title: "Wallet & transaction research",
    text: "Look up any wallet: balances, holdings, PnL, and a full history of its recent swaps.",
  },
  {
    icon: LineChart,
    title: "Trader & market activity analysis",
    text: "Track smart-money flows, KOL moves, and unusual on-chain activity as it happens.",
  },
  {
    icon: Database,
    title: "On-chain intelligence",
    text: "Deep forensics on any mint — dev wallets, bundles, first buyers, and insider patterns.",
  },
  {
    icon: FlaskConical,
    title: "Paper trading & strategy research",
    text: "Explore paper-trading desks and agent strategies to research ideas risk-free, where available.",
  },
];

const FAQS = [
  {
    q: "The connection will not save.",
    a: "Verify the server URL is exactly https://www.orbitx.world/api/mcp — no trailing slash, no typos — then repeat the validation step. The connection check must pass before ChatGPT lets you save.",
  },
  {
    q: "The authorization page did not appear.",
    a: "Check whether ChatGPT displays an authorization link in the conversation and follow it there. Make sure you are signed into the correct OrbitX account at orbitx.world before approving, and retry the connection flow if the link expired.",
  },
  {
    q: "OrbitX does not appear in my conversation.",
    a: "Open the connected apps / tools menu in ChatGPT, select OrbitX MCP if it is listed, and start a new conversation. Some clients only expose connected apps in fresh chats.",
  },
  {
    q: "Can I trade with OrbitX MCP?",
    a: "Capabilities vary by enabled tool and permission. Some actions may have financial consequences — always inspect trade details and confirm any live transaction yourself. Connecting the MCP does not automatically place trades.",
  },
];

/* ── Small building blocks ─────────────────────────────────────────── */

function copyText(text: string): Promise<boolean> {
  // Primary: async clipboard API (needs secure context)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text).then((ok) => {
          setState(ok ? "copied" : "failed");
          window.setTimeout(() => setState("idle"), 1600);
        });
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:border-og-lime/60 hover:text-og-lime"
      aria-live="polite"
    >
      {state === "copied" ? (
        <>
          <Check className="h-3.5 w-3.5 text-og-lime" /> Copied
        </>
      ) : state === "failed" ? (
        <>Copy failed</>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> {label}
        </>
      )}
    </button>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.35em] text-og-lime">
      {children}
    </div>
  );
}

function StepCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col rounded-2xl border border-white/10 bg-[#0b0d14] p-6 transition-colors hover:border-og-lime/30">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-og-lime font-display text-lg font-bold text-black shadow-[0_0_28px_-8px_hsl(var(--og-lime))]">
          {n}
        </span>
        <h3 className="font-display text-lg font-bold leading-snug text-white">{title}</h3>
      </div>
      <div className="flex-1 space-y-3 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d14]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-white">{q}</span>
        <ChevronDown
          className={"h-5 w-5 shrink-0 text-og-lime transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>
      {open && <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-400">{a}</p>}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function ConnectChatGptPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = "Connect OrbitX to ChatGPT — OrbitX";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#06070c] text-white">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute -top-40 left-[10%] h-[520px] w-[520px] rounded-full bg-og-lime/10 blur-[140px]" />
        <div className="pointer-events-none absolute top-32 right-0 h-[420px] w-[420px] rounded-full bg-og-cyan/10 blur-[120px]" />
        {/* subtle chart-line decoration */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-20"
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,120 L120,105 L240,118 L360,80 L480,95 L600,55 L720,70 L840,35 L960,50 L1080,20 L1200,30"
            fill="none"
            stroke="#17ff4d"
            strokeWidth="2"
          />
          <path
            d="M0,120 L120,105 L240,118 L360,80 L480,95 L600,55 L720,70 L840,35 L960,50 L1080,20 L1200,30 L1200,160 L0,160 Z"
            fill="url(#heroFill)"
            opacity="0.35"
          />
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#17ff4d" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#17ff4d" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 text-center sm:pt-24">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-og-lime/30 bg-og-lime/5 px-4 py-2">
            <img src="/og-icon.svg" alt="OrbitX" className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-og-lime">
              Connect to ChatGPT
            </span>
          </div>
          <h1 className="font-display mx-auto mb-5 max-w-4xl text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Bring <span className="text-og-lime">OrbitX</span> Into ChatGPT
          </h1>
          <p className="mx-auto mb-3 max-w-2xl text-lg text-zinc-300">
            Your on-chain intelligence, directly inside ChatGPT.
          </p>
          <p className="mx-auto mb-8 max-w-2xl text-[15px] text-zinc-400">
            Connect OrbitX to ChatGPT in just a few minutes. Access on-chain
            research, token analysis, wallet insights, market intelligence, and
            other available OrbitX MCP tools directly from your conversation.
          </p>
          <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={CHATGPT_SETUP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-og-lime px-8 py-3.5 font-bold text-black transition-transform hover:scale-105"
            >
              <Plug2 className="h-4 w-4" /> Get Connected <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={ORBITX_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white hover:bg-white/5"
            >
              <Globe2 className="h-4 w-4" /> Explore OrbitX
            </a>
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
            Powered by the OrbitX Model Context Protocol (MCP).
          </p>
        </div>
      </div>

      {/* ── 6 steps ── */}
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-8">
          <SectionKicker>Setup guide</SectionKicker>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Connect in 6 simple steps
          </h2>
          <p className="mt-3 max-w-3xl text-[15px] text-zinc-400">
            Follow these steps once — after that, OrbitX is available in your
            ChatGPT conversations whenever you need it.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StepCard n={1} title="Open ChatGPT's MCP setup page">
            <p>
              Make sure you are signed into your ChatGPT account first, then open
              the MCP setup page and click <b className="text-white">Add</b> /{" "}
              <b className="text-white">Create MCP App</b> (or the equivalent
              custom MCP server option).
            </p>
            <p className="text-zinc-500">
              If the custom MCP option is unavailable, you may need a supported
              account or permission to create custom MCP connections.
            </p>
            <a
              href={CHATGPT_SETUP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-og-lime underline"
            >
              chatgpt.com/plugins <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </StepCard>

          <StepCard n={2} title="Enter the OrbitX details">
            <p>Fill in the connection form:</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2.5">
                <img src="/og-icon.svg" alt="OrbitX logo" className="h-7 w-7 rounded-full border border-og-lime/40" />
                <span><b className="text-white">Image:</b> the official OrbitX logo</span>
              </li>
              <li><b className="text-white">Name:</b> <code className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[13px] text-og-lime">OrbitX MCP</code></li>
              <li>
                <b className="text-white">Description:</b>
                <span className="mt-1 block rounded-lg bg-black/40 p-2.5 text-[13px]">
                  "OrbitX provides on-chain intelligence, token research, wallet
                  analytics, market insights, and other available crypto research
                  tools through MCP."
                </span>
              </li>
            </ul>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                MCP server URL
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-black/50 p-2.5">
                <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-og-lime">{MCP_URL}</code>
                <CopyButton text={MCP_URL} label="Copy MCP Link" />
              </div>
            </div>
          </StepCard>

          <StepCard n={3} title="Select OAuth authentication">
            <p>
              Choose <b className="text-white">OAuth</b> as the authentication
              method when that option is offered.
            </p>
            <div className="flex gap-2.5 rounded-xl border border-og-gold/30 bg-og-gold/5 p-3.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-og-gold" />
              <p className="text-[13px]">
                <b className="text-white">Security:</b> OAuth lets you securely
                authorize OrbitX to connect to your account. Never paste your
                password, private key, seed phrase, or API secrets into a
                ChatGPT prompt.
              </p>
            </div>
          </StepCard>

          <StepCard n={4} title="Check and save">
            <p>
              Click <b className="text-white">Check</b> (or the equivalent
              validation / scan button), wait for the server connection to be
              checked, then click <b className="text-white">Save</b> /{" "}
              <b className="text-white">Create</b> when available.
            </p>
            <p className="text-zinc-500">
              Exact button labels may vary. If validation fails, double-check
              the MCP URL above and try again.
            </p>
          </StepCard>

          <StepCard n={5} title="Authorize your OrbitX account">
            <p>
              Before starting authorization, make sure you are already logged in
              to your OrbitX account at{" "}
              <a href={ORBITX_URL} target="_blank" rel="noreferrer" className="font-semibold text-og-lime underline">
                orbitx.world
              </a>
              .
            </p>
            <p>
              After saving, ChatGPT may open the OrbitX authorization page or
              show a link to authorize the connection. Follow that link, review
              the requested permissions, and approve only if you recognize the
              official OrbitX domain and agree to the permissions.
            </p>
            <p>
              If ChatGPT asks you to initiate authorization in the conversation,
              type:
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-black/50 p-2.5">
              <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-zinc-200">
                I want to authorize OrbitX.
              </code>
              <CopyButton text="I want to authorize OrbitX." />
            </div>
            <p className="text-zinc-500">
              Complete the OAuth flow and return to ChatGPT. Do not assume
              authorization succeeded until you finish the actual consent flow.
            </p>
          </StepCard>

          <StepCard n={6} title="You're connected!">
            <p>
              Start a new ChatGPT conversation, select{" "}
              <b className="text-white">OrbitX MCP</b> from the available
              tools/apps if necessary, and try a starter prompt:
            </p>
            <div className="space-y-2">
              {STARTER_PROMPTS.map((p) => (
                <div key={p} className="flex items-start gap-2 rounded-xl bg-black/50 p-2.5">
                  <p className="min-w-0 flex-1 text-[12.5px] italic leading-relaxed text-zinc-300">
                    "{p}"
                  </p>
                  <CopyButton text={p} />
                </div>
              ))}
            </div>
            <p className="text-[12px] text-zinc-500">
              Results depend on the tools available, your account permissions,
              and current data.
            </p>
          </StepCard>
        </div>
      </div>

      {/* ── Features ── */}
      <div className="border-y border-white/10 bg-white/[0.015]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="mb-8">
            <SectionKicker>Capabilities</SectionKicker>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              What can you do with OrbitX MCP?
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] text-zinc-400">
              The capabilities supported by the connected OrbitX server — ask
              for them by name in any conversation.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-[#0b0d14] p-6 transition-colors hover:border-og-lime/30"
              >
                <div className="mb-3 inline-flex rounded-xl border border-og-lime/25 bg-og-lime/10 p-2.5">
                  <f.icon className="h-5 w-5 text-og-lime" />
                </div>
                <h3 className="mb-1.5 font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-8">
          <SectionKicker>Troubleshooting</SectionKicker>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Stuck? Start here
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <FaqItem
              key={f.q}
              q={f.q}
              a={f.a}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </div>

      {/* ── Final CTA ── */}
      <div className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-og-lime/20 bg-og-lime/5 p-10 text-center sm:p-14">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-og-lime/10 blur-[100px]" />
          <div className="relative">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-og-lime" />
            <h2 className="font-display mb-3 text-3xl font-bold sm:text-4xl">
              Ready to Put On-Chain Intelligence to Work?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-zinc-300">
              Connect OrbitX to ChatGPT and start researching with the tools you choose.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={CHATGPT_SETUP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-og-lime px-8 py-3.5 font-bold text-black transition-transform hover:scale-105"
              >
                <Plug2 className="h-4 w-4" /> Open ChatGPT Setup <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={ORBITX_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-8 py-3.5 font-semibold text-white hover:bg-white/5"
              >
                <Globe2 className="h-4 w-4" /> Visit OrbitX
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-600">
          <Link to="/mcp" className="underline hover:text-zinc-400">
            OrbitX MCP connect page
          </Link>
          <Link to="/mcp/guide" className="underline hover:text-zinc-400">
            MCP tool guide
          </Link>
          <span>Product: OrbitX MCP</span>
        </div>
      </div>
    </div>
  );
}
