import type { ReactNode } from "react";

/** Shared OrbitX platform catalog — /app home + mini menu stay in sync. */
export type PlatformApp = {
  key: string;
  name: string;
  caption: string;
  href: string;
  external?: boolean;
  tone: string;
  iconBg: string;
  glyph: ReactNode;
  /** Include in the floating mini menu. Default true. */
  menu?: boolean;
  /** Pin as a command-deck gate on /app. */
  dock?: boolean;
};

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export const PlatformGlyph = {
  dex: (
    <Svg>
      <path d="M8 34l9-11 7 6 11-15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 40h32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity=".4" />
      <circle cx="35" cy="14" r="3.5" fill="currentColor" />
    </Svg>
  ),
  trade: (
    <Svg>
      <path d="M14 18h20M14 24h14M14 30h18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 14l6 6-6 6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  scanner: (
    <Svg>
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3.5" opacity=".3" />
      <circle cx="24" cy="24" r="7" stroke="currentColor" strokeWidth="3.5" opacity=".8" />
      <path d="M24 24L36 12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill="currentColor" />
    </Svg>
  ),
  launchpad: (
    <Svg>
      <path d="M24 6c6 3 10 9 10 17 0 5-2 9-4 12l-6 7-6-7c-2-3-4-7-4-12 0-8 4-14 10-17z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="20" r="4" stroke="currentColor" strokeWidth="3.5" />
    </Svg>
  ),
  vamp: (
    <Svg>
      <path d="M24 8l14 6v10c0 9-6 16-14 18-8-2-14-9-14-18V14l14-6z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M18 24l4 4 8-9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  kol: (
    <Svg>
      <path d="M24 8c-5 0-9 4-9 9v6l-3 6h24l-3-6v-6c0-5-4-9-9-9z" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 34a4 4 0 008 0" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  ),
  pnl: (
    <Svg>
      <path d="M10 34l8-10 6 5 14-16" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 13h10v10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  ai: (
    <Svg>
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3" opacity=".5" />
      <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="3" opacity=".75" />
      <path d="M24 16v-4M24 36v-4M16 24h-4M32 24h-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" />
    </Svg>
  ),
  agent: (
    <Svg>
      <rect x="10" y="12" width="28" height="24" rx="6" stroke="currentColor" strokeWidth="3.5" />
      <path d="M18 22h12M18 28h8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  ),
  x: (
    <Svg>
      <path d="M14 14l20 20M34 14L14 34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </Svg>
  ),
  shop: (
    <Svg>
      <path d="M12 18h24l-2 18H14L12 18z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M16 18V14a8 8 0 0116 0v4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  ),
  social: (
    <Svg>
      <circle cx="18" cy="18" r="6" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="32" cy="22" r="5" stroke="currentColor" strokeWidth="3.5" opacity=".6" />
      <path d="M8 40c0-6 5-10 10-10s10 4 10 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M30 40c0-5 3-8 6-8s6 3 6 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity=".6" />
    </Svg>
  ),
  hq: (
    <Svg>
      <path d="M10 40V20l14-10 14 10v20" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M20 40V28h8v12" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
    </Svg>
  ),
  gaming: (
    <Svg>
      <path d="M10 28c0-6 4-10 10-10h8c6 0 10 4 10 10v2c0 4-3 8-8 8h-4l-4-6-4 6h-4c-5 0-8-4-8-8v-2z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M18 26v6M15 29h6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="30" cy="27" r="1.6" fill="currentColor" />
      <circle cx="33" cy="31" r="1.6" fill="currentColor" />
    </Svg>
  ),
  play: (
    <Svg>
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3.5" />
      <path d="M20 16l14 8-14 8V16z" fill="currentColor" />
    </Svg>
  ),
  predict: (
    <Svg>
      <rect x="10" y="10" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="18" cy="18" r="3" fill="currentColor" />
      <circle cx="30" cy="30" r="3" fill="currentColor" />
      <circle cx="30" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="30" r="3.5" fill="currentColor" />
    </Svg>
  ),
  nft: (
    <Svg>
      <rect x="10" y="12" width="28" height="24" rx="6" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="19" cy="21" r="3" stroke="currentColor" strokeWidth="3" />
      <path d="M12 32l8-7 6 5 10-9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
  bagwork: (
    <Svg>
      <rect x="10" y="18" width="28" height="20" rx="5" stroke="currentColor" strokeWidth="3.5" />
      <path d="M18 18v-3a6 6 0 0112 0v3" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  ),
  city: (
    <Svg>
      <path d="M8 40V22h8v18M16 40V14h10v26M26 40V20h8v20M34 40V26h6v14" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M8 40h32" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </Svg>
  ),
  os: (
    <Svg>
      <rect x="8" y="10" width="32" height="24" rx="5" stroke="currentColor" strokeWidth="3.5" />
      <path d="M16 40h16M24 34v6" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="22" r="4" stroke="currentColor" strokeWidth="3" />
    </Svg>
  ),
  intel: (
    <Svg>
      <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="24" cy="24" r="5" fill="currentColor" />
      <path d="M24 10v4M24 34v4M10 24h4M34 24h4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  ),
  terminal: (
    <Svg>
      <rect x="8" y="10" width="32" height="28" rx="6" stroke="currentColor" strokeWidth="3.5" />
      <path d="M14 20l6 4-6 4M24 28h10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  ),
};

export const PLATFORM_APPS: PlatformApp[] = [
  { key: "dex", name: "OrbitX DEX", caption: "Scanner & trade", href: "/ORBITX_DEX", tone: "#2F80FF", iconBg: "linear-gradient(145deg, #5BA8FF 0%, #1A6CFF 48%, #0037A3 100%)", glyph: PlatformGlyph.dex, dock: true },
  { key: "trade", name: "Trade", caption: "Phantom buy & sell", href: "/trade", tone: "#AB9FF2", iconBg: "linear-gradient(145deg, #C9BFFF 0%, #AB9FF2 46%, #6B5FD4 100%)", glyph: PlatformGlyph.trade },
  { key: "terminal", name: "Terminal", caption: "Pro trading desk", href: "/terminal", tone: "#60A5FA", iconBg: "linear-gradient(145deg, #93C5FD 0%, #3B82F6 50%, #1D4ED8 100%)", glyph: PlatformGlyph.terminal },
  { key: "scanner", name: "Scanner", caption: "Forensic scan", href: "/orbitx-scanner", tone: "#14E0C8", iconBg: "linear-gradient(145deg, #5EEAD4 0%, #00C6B8 48%, #00766E 100%)", glyph: PlatformGlyph.scanner },
  { key: "launchpad", name: "Launchpad", caption: "Launch a token", href: "/orbitxlaunch", tone: "#FFC53D", iconBg: "linear-gradient(145deg, #FFE08A 0%, #FFC53D 48%, #B8860B 100%)", glyph: PlatformGlyph.launchpad },
  { key: "vamp", name: "Anti-Vamp", caption: "Originality checks", href: "/vamp", tone: "#67E8F9", iconBg: "linear-gradient(145deg, #A5F3FC 0%, #67E8F9 48%, #0891B2 100%)", glyph: PlatformGlyph.vamp, menu: false },
  { key: "intel", name: "Intel", caption: "Crypto intelligence", href: "/intel", tone: "#38BDF8", iconBg: "linear-gradient(145deg, #7DD3FC 0%, #0EA5E9 50%, #0369A1 100%)", glyph: PlatformGlyph.intel },
  { key: "koltracker", name: "KOL Tracker", caption: "Wallet alerts", href: "/app/kol-tracker", tone: "#22C55E", iconBg: "linear-gradient(145deg, #86EFAC 0%, #22C55E 48%, #065F46 100%)", glyph: PlatformGlyph.kol, menu: false },
  { key: "pnltracker", name: "PNL Tracker", caption: "Profit & loss", href: "/app/pnl-tracker", tone: "#F97316", iconBg: "linear-gradient(145deg, #FDBA74 0%, #F97316 48%, #B45309 100%)", glyph: PlatformGlyph.pnl, menu: false },
  { key: "ai", name: "OrbitX AI", caption: "Chat · create · transact", href: "/ai", tone: "#38BDF8", iconBg: "linear-gradient(145deg, #7DD3FC 0%, #38BDF8 48%, #0284C7 100%)", glyph: PlatformGlyph.ai },
  { key: "agent", name: "Agent MCP", caption: "Claude · ChatGPT · Grok", href: "/agent", tone: "#5EEAD4", iconBg: "linear-gradient(145deg, #99F6E4 0%, #2DD4BF 48%, #0F766E 100%)", glyph: PlatformGlyph.agent, dock: true },
  { key: "xmcp", name: "X MCP", caption: "Post & NVIDIA agent", href: "/x", tone: "#E7E9EA", iconBg: "linear-gradient(145deg, #71717A 0%, #3F3F46 50%, #18181B 100%)", glyph: PlatformGlyph.x },
  { key: "shop", name: "Shop", caption: "Credits + burn access", href: "/shop", tone: "#2DD4BF", iconBg: "linear-gradient(145deg, #5EEAD4 0%, #14B8A6 48%, #115E59 100%)", glyph: PlatformGlyph.shop, dock: true },
  { key: "social", name: "Social", caption: "Feed & spaces", href: "/orbitx-social", tone: "#A78BFA", iconBg: "linear-gradient(145deg, #C4B5FD 0%, #8B5CF6 48%, #5B21B6 100%)", glyph: PlatformGlyph.social },
  { key: "hq", name: "HQ", caption: "Social headquarters", href: "/hq", tone: "#F472B6", iconBg: "linear-gradient(145deg, #F9A8D4 0%, #EC4899 48%, #9D174D 100%)", glyph: PlatformGlyph.hq },
  { key: "os", name: "OrbitX OS", caption: "Desktop launcher", href: "/os", tone: "#17FF4D", iconBg: "linear-gradient(145deg, #86EFAC 0%, #22C55E 46%, #14532D 100%)", glyph: PlatformGlyph.os },
  { key: "city", name: "City", caption: "3D OrbitX city", href: "/Orbitxcity", tone: "#34D399", iconBg: "linear-gradient(145deg, #6EE7B7 0%, #10B981 48%, #065F46 100%)", glyph: PlatformGlyph.city, dock: true },
  { key: "play", name: "Play", caption: "Games & missions", href: "/play", tone: "#FF5BBD", iconBg: "linear-gradient(145deg, #F9A8D4 0%, #FF3EAA 48%, #9D174D 100%)", glyph: PlatformGlyph.play },
  { key: "gaming", name: "Degen Tower", caption: "Climb & win", href: "https://degen-tower.vercel.app", external: true, tone: "#FF5BBD", iconBg: "linear-gradient(145deg, #FB7185 0%, #FF3EAA 48%, #B20067 100%)", glyph: PlatformGlyph.gaming, menu: false },
  { key: "predict", name: "Predictions", caption: "Trade YES / NO", href: "/predictions", tone: "#FFC53D", iconBg: "linear-gradient(145deg, #FDE68A 0%, #F59E0B 48%, #B45309 100%)", glyph: PlatformGlyph.predict },
  { key: "nft", name: "NFT Market", caption: "Mint & trade", href: "/nft", tone: "#00FFA3", iconBg: "linear-gradient(145deg, #6EE7B7 0%, #00C776 48%, #047857 100%)", glyph: PlatformGlyph.nft },
  { key: "bagwork", name: "Bagwork", caption: "Earn USDC", href: "/bagwork", tone: "#F0C75E", iconBg: "linear-gradient(145deg, #FDE68A 0%, #F0C75E 48%, #B8860B 100%)", glyph: PlatformGlyph.bagwork },
];

export const PLATFORM_BY_KEY = Object.fromEntries(PLATFORM_APPS.map((a) => [a.key, a])) as Record<string, PlatformApp>;

export type PlatformSection = { id: string; title: string; subtitle: string; keys: string[] };

export const PLATFORM_SECTIONS: PlatformSection[] = [
  { id: "world", title: "World", subtitle: "City, OS, and play surfaces", keys: ["city", "os", "play", "gaming"] },
  { id: "trade", title: "Trade & Launch", subtitle: "DEX, terminal, scanner, launch", keys: ["dex", "trade", "terminal", "scanner", "launchpad", "vamp"] },
  { id: "intel", title: "Intelligence", subtitle: "Intel desk, wallets, PnL, AI", keys: ["intel", "koltracker", "pnltracker", "ai"] },
  { id: "mcp", title: "AI Connectors", subtitle: "Agent + X MCP and shop", keys: ["agent", "xmcp", "shop"] },
  { id: "social", title: "Social", subtitle: "Feed, HQ, and community", keys: ["social", "hq"] },
  { id: "play", title: "Play & Earn", subtitle: "Markets, NFTs, tasks", keys: ["predict", "nft", "bagwork"] },
];

export const PLATFORM_MENU = PLATFORM_APPS.filter((a) => a.menu !== false);

export const HOME_DOCK = PLATFORM_APPS.filter((a) => a.dock);

export const HOME_GRID_KEYS = PLATFORM_APPS.filter((a) => a.menu !== false).map((a) => a.key);

export function matchPlatformPath(href: string, pathname: string): boolean {
  if (href.startsWith("http")) return false;
  if (href === "/ORBITX_DEX") return pathname.startsWith("/ORBITX_DEX");
  if (href === "/Orbitxcity") return pathname.toLowerCase().startsWith("/orbitxcity");
  if (href === "/hq") return pathname === "/hq" || pathname.startsWith("/hq/");
  if (href === "/os") return pathname === "/os" || pathname.startsWith("/os/");
  if (href === "/play") return pathname === "/play" || pathname.startsWith("/play/");
  if (href === "/intel") return pathname === "/intel" || pathname.startsWith("/intel/");
  if (href === "/x") return pathname === "/x" || pathname.startsWith("/x/");
  if (href === "/ai") return pathname.toLowerCase() === "/ai";
  if (href === "/app") return pathname === "/app" || pathname.startsWith("/hub");
  return pathname === href || pathname.startsWith(`${href}/`);
}
