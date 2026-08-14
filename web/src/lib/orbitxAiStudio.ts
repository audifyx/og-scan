export type AgentMode = "auto" | "research" | "trade" | "create" | "social";

export type SlashAction = "prompt" | "create" | "x" | "send" | "tools" | "chart";

export type SlashCommand = {
  cmd: string;
  label: string;
  detail: string;
  action: SlashAction;
  prompt?: string;
};

export const AGENT_MODE_IDS: AgentMode[] = ["auto", "research", "trade", "create", "social"];

export const AGENT_MODES: Array<{
  id: AgentMode;
  label: string;
  detail: string;
  prompt: string;
  starter: string;
}> = [
  {
    id: "auto",
    label: "Auto",
    detail: "Full MCP copilot",
    prompt: "",
    starter: "What can you do with live OrbitX tools right now?",
  },
  {
    id: "research",
    label: "Research",
    detail: "Safety, forensics, charts",
    prompt: "Operate in research mode. Pull live token, safety, forensics, and chart tools before answering.",
    starter: "Run a full safety and forensics scan, then explain the risks in plain English.",
  },
  {
    id: "trade",
    label: "Trade desk",
    detail: "Liquidity, wallets, handoffs",
    prompt: "Operate as a trade desk. Prioritize charts, liquidity, volume, wallet balances, and prepare-trade tools. Never claim a transaction was sent.",
    starter: "Analyze my wallet, then show the live chart and liquidity for the largest holding.",
  },
  {
    id: "create",
    label: "Create",
    detail: "Grok image and video",
    prompt: "Operate in create mode. Shape vivid visual direction and use media tools when the user wants an image or video.",
    starter: "Create a cinematic still of neon Tokyo rain over a Solana trading floor.",
  },
  {
    id: "social",
    label: "Social",
    detail: "Feed, communities, X",
    prompt: "Operate in social mode. Prefer feed, community, and X-ready copy. Keep posts punchy and useful.",
    starter: "Draft a sharp X post about today's Solana momentum without hype.",
  },
];

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    cmd: "/chart",
    label: "Live chart",
    detail: "DexScreener embed",
    action: "chart",
  },
  {
    cmd: "/scan",
    label: "Safety scan",
    detail: "Forensics + risk",
    action: "prompt",
    prompt: "Run a full safety and forensics scan on ",
  },
  {
    cmd: "/wallet",
    label: "Wallet intel",
    detail: "Holdings and swaps",
    action: "prompt",
    prompt: "Analyze my connected wallet, holdings, recent swaps, and risk exposure.",
  },
  {
    cmd: "/screen",
    label: "Momentum",
    detail: "Trending Solana",
    action: "prompt",
    prompt: "Screen Solana for the strongest trending tokens in the last hour. Include volume, liquidity, and risk.",
  },
  {
    cmd: "/image",
    label: "Generate image",
    detail: "Grok Imagine",
    action: "create",
  },
  {
    cmd: "/video",
    label: "Generate video",
    detail: "Grok Imagine",
    action: "create",
  },
  {
    cmd: "/post",
    label: "X Studio",
    detail: "Draft and publish",
    action: "x",
  },
  {
    cmd: "/send",
    label: "Send tokens",
    detail: "Non-custodial",
    action: "send",
  },
  {
    cmd: "/tools",
    label: "Command center",
    detail: "Full MCP catalog",
    action: "tools",
  },
  {
    cmd: "/help",
    label: "Studio help",
    detail: "Modes and shortcuts",
    action: "prompt",
    prompt: "Explain OrbitX AI studio modes, slash commands, workspace pinning, and when a tool needs confirmation.",
  },
];

const MINT_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

export function detectMint(value: string): string | null {
  const match = String(value || "").match(MINT_RE);
  return match?.[0] || null;
}

export function suggestFollowUps(content: string, tools: string[]): string[] {
  const haystack = `${content} ${tools.join(" ")}`.toLowerCase();
  const ideas: string[] = [];
  if (/chart|price|token|liquidity|volume/.test(haystack)) {
    ideas.push("Break down the risk and liquidity in plain English.");
    ideas.push("Compare this against ORBITX on the same interval.");
  }
  if (/wallet|holding|swap|balance/.test(haystack)) {
    ideas.push("What should I watch on this wallet next?");
    ideas.push("Flag any concentrated or risky positions.");
  }
  if (/safety|forensic|rug|scan|xray/.test(haystack)) {
    ideas.push("List the red flags and what would change your view.");
  }
  if (/trend|screen|launch|momentum/.test(haystack)) {
    ideas.push("Narrow this to the three highest-conviction names.");
  }
  ideas.push("Turn this into a sharp X post.");
  ideas.push("Generate a visual that matches this idea.");
  return [...new Set(ideas)].slice(0, 4);
}

export function matchSlashCommands(value: string): SlashCommand[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return [];
  const [token = ""] = trimmed.split(/\s+/);
  const query = token.toLowerCase();
  if (trimmed.includes(" ") && SLASH_COMMANDS.some((command) => command.cmd === query)) {
    return [];
  }
  return SLASH_COMMANDS.filter(
    (command) =>
      command.cmd.startsWith(query) || command.label.toLowerCase().includes(query.slice(1)),
  );
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function speechEngine(): (new () => SpeechRecognitionLike) | null {
  const holder = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return holder.SpeechRecognition || holder.webkitSpeechRecognition || null;
}

export function canUseVoiceInput(): boolean {
  return typeof window !== "undefined" && Boolean(speechEngine());
}

export function startVoiceInput(
  onText: (transcript: string, isFinal: boolean) => void,
): { stop: () => void } | null {
  const Engine = speechEngine();
  if (!Engine) return null;
  const recognition = new Engine();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    const last = event.results[event.results.length - 1];
    const transcript = last?.[0]?.transcript || "";
    if (transcript) onText(transcript, Boolean((last as { isFinal?: boolean })?.isFinal));
  };
  recognition.onerror = () => undefined;
  recognition.onend = () => undefined;
  recognition.start();
  return { stop: () => recognition.stop() };
}

export function speakText(value: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value.slice(0, 4_000));
  utterance.rate = 1.02;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

const FAVORITE_KEY = "orbitx-ai-favorite-tools";
const MODE_KEY = "orbitx-ai-mode";

export function loadFavoriteTools(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveFavoriteTools(names: string[]): void {
  window.localStorage.setItem(FAVORITE_KEY, JSON.stringify(names.slice(0, 40)));
}

export function loadAgentMode(): AgentMode {
  try {
    const raw = window.localStorage.getItem(MODE_KEY);
    return AGENT_MODE_IDS.includes(raw as AgentMode) ? (raw as AgentMode) : "auto";
  } catch {
    return "auto";
  }
}

export function saveAgentMode(mode: AgentMode): void {
  window.localStorage.setItem(MODE_KEY, mode);
}
