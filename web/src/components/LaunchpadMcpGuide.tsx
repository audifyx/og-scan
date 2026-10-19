/**
 * LaunchpadMcpGuide — setup guide for connecting the OrbitX Launchpad MCP
 * to Claude, ChatGPT, or Grok. Self-contained: copy URL, tabbed per-AI
 * instructions, and copy-pasteable example prompts.
 */
import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";

const MCP_URL = "https://www.orbitx.world/api/mcp-launchpad";
const AUTH_PAGE = "https://www.orbitx.world/agent";

type AiTab = "claude" | "chatgpt" | "grok";

const TABS: { id: AiTab; label: string; note: string }[] = [
  { id: "claude", label: "Claude", note: "Free, Pro, Max, Team & Enterprise" },
  { id: "chatgpt", label: "ChatGPT", note: "Paid plans only — not on Free/Go" },
  { id: "grok", label: "Grok", note: "Custom connectors on grok.com" },
];

const STEPS: Record<AiTab, string[]> = {
  claude: [
    "Go to claude.ai, click your profile icon, then open Settings → Connectors.",
    "Click Add custom connector.",
    `Enter the name "OrbitX Launchpad" and paste the Remote MCP server URL above.`,
    "Keep the default auth settings and click Add — complete the sign-in step if one appears.",
    "Start a new chat and make sure the connector is enabled from the tools menu in the composer.",
    `Grab your auth code at ${AUTH_PAGE} and paste it to Claude when it asks.`,
  ],
  chatgpt: [
    "ChatGPT custom connectors need a paid plan (Plus, Pro, Business, Enterprise, or Edu) — not available on Free/Go.",
    "Click your profile → Settings → Apps & Connectors → Advanced settings, and turn on Developer mode. (On Business/Enterprise, an admin may need to allow it first.)",
    "Go to Settings → Connectors and click Create (it may read Create app).",
    `Fill in the name "OrbitX Launchpad", paste the MCP server URL above, and leave Authentication on OAuth.`,
    "Save the connector, then complete the sign-in / consent step that follows.",
    `In a chat, add the connector via the tools menu, then paste your auth code from ${AUTH_PAGE} when asked.`,
  ],
  grok: [
    "Open grok.com/connectors in your browser.",
    "Click New Connector, then choose Custom.",
    "Paste the MCP server URL above.",
    "Finish any authentication step Grok shows you.",
    `In your next chat the tools are live — paste your auth code from ${AUTH_PAGE} when asked.`,
  ],
};

const PROMPTS: string[] = [
  '"Launch a coin called Diamond Hands with symbol DIAMOND and a 1B supply"',
  '"Show me trending tokens on the OrbitX launchpad"',
  '"Buy 0.5 SOL of $MOON"',
  '"What\'s my launchpad wallet balance?"',
  '"Get details on the token with symbol MOON"',
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function LaunchpadMcpGuide() {
  const [tab, setTab] = useState<AiTab>("claude");
  const [urlCopied, setUrlCopied] = useState(false);

  const copyUrl = () => {
    void navigator.clipboard.writeText(MCP_URL).then(() => {
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black p-6 text-white sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-400" />
        <h2 className="text-xl font-black tracking-tight">Connect the Launchpad MCP</h2>
      </div>
      <p className="mt-2 text-sm text-white/50">
        One URL, your favorite AI. Launch and trade tokens from chat — your OrbitX desk
        wallet signs in the background, no popups.
      </p>

      {/* MCP URL */}
      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 pl-4">
        <code className="flex-1 truncate text-sm text-blue-300">{MCP_URL}</code>
        <button
          onClick={copyUrl}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          {urlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {urlCopied ? "Copied" : "Copy URL"}
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[100px] rounded-2xl border px-4 py-3 text-left transition-all ${
              tab === t.id
                ? "border-blue-500/50 bg-gradient-to-br from-blue-600/20 to-purple-600/20"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
            }`}
          >
            <div className={`text-sm font-bold ${tab === t.id ? "text-white" : "text-white/60"}`}>
              {t.label}
            </div>
            <div className="mt-0.5 text-[11px] leading-tight text-white/40">{t.note}</div>
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <ol className="space-y-3">
          {STEPS[tab].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-xs font-black">
                {i + 1}
              </span>
              <span className="pt-0.5 text-white/70">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Example prompts */}
      <div className="mt-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">
          Try saying
        </h3>
        <div className="mt-3 space-y-2">
          {PROMPTS.map((prompt, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/40 px-4 py-3"
            >
              <span className="flex-1 font-mono text-sm text-white/70">{prompt}</span>
              <CopyButton text={prompt.replace(/^"|"$/g, "")} label="Copy" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
