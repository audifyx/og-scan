import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BellRing,
  Bot,
  BrainCircuit,
  Briefcase,
  Brush,
  Building2,
  CalendarClock,
  ChartCandlestick,
  ChartPie,
  Clapperboard,
  CodeXml,
  Coins,
  Compass,
  Copy,
  Cpu,
  Crosshair,
  Download,
  FileText,
  FlaskConical,
  Flame,
  Gamepad2,
  Gauge,
  Globe,
  GraduationCap,
  Image,
  LifeBuoy,
  Mail,
  Map,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Mic,
  Orbit,
  Palette,
  Phone,
  PhoneCall,
  PieChart,
  Podcast,
  Radar,
  Radio,
  Rocket,
  ScanSearch,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  SquareTerminal,
  Target,
  Telescope,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * OrbitX OS — full app catalog. One entry per real product surface,
 * audited against web/src/App.tsx route table (2026-09-29).
 */

export type AppCategory =
  | "trade"
  | "launch"
  | "social"
  | "play"
  | "agents"
  | "intel"
  | "platform";

export interface OsHomeApp {
  id: string;
  name: string;
  blurb: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  category: AppCategory;
  /** shown as a small lock/preview badge on the tile */
  badge?: "owner" | "new";
}

export const APP_CATEGORIES: { id: AppCategory; label: string }[] = [
  { id: "trade", label: "Trade" },
  { id: "launch", label: "Launch" },
  { id: "social", label: "Social" },
  { id: "play", label: "Play" },
  { id: "agents", label: "Agents" },
  { id: "intel", label: "Intel" },
  { id: "platform", label: "Platform" },
];

const LIME = "#17ff4d";
const CYAN = "#3de7ff";
const GOLD = "#f5c542";
const PINK = "#ff4d9a";
const VIOLET = "#a78bfa";
const ORANGE = "#ff6b35";
const BLUE = "#5b8cff";
const RED = "#ff4d5e";

export const APP_CATALOG: OsHomeApp[] = [
  // ── Trade ──────────────────────────────────────────────
  { id: "dex", name: "OrbitX DEX", blurb: "The flagship exchange surface", href: "/ORBITX_DEX", icon: ChartCandlestick, accent: LIME, category: "trade" },
  { id: "intel", name: "Intel Command", blurb: "Crypto intelligence command center", href: "/intel", icon: Radar, accent: CYAN, category: "trade" },
  { id: "terminal", name: "Trading Terminal", blurb: "Pro execution terminal", href: "/intel/trade", icon: SquareTerminal, accent: CYAN, category: "trade" },
  { id: "tradeapp", name: "Trade App", blurb: "Mobile-first trading", href: "/trade", icon: ArrowLeftRight, accent: BLUE, category: "trade" },
  { id: "portfolio", name: "Portfolio", blurb: "Holdings, P&L, positions", href: "/intel/portfolio", icon: ChartPie, accent: GOLD, category: "trade" },
  { id: "trending", name: "Trending", blurb: "What's moving right now", href: "/intel/trending", icon: Flame, accent: ORANGE, category: "trade" },
  { id: "whales", name: "Whale Radar", blurb: "Track smart-money wallets", href: "/intel/whales", icon: Waves, accent: BLUE, category: "trade" },
  { id: "sentiment", name: "Sentiment", blurb: "Market mood gauges", href: "/intel/sentiment", icon: Gauge, accent: PINK, category: "trade" },
  { id: "copy", name: "Copy Trading", blurb: "Mirror elite wallets live", href: "/copy", icon: Copy, accent: VIOLET, category: "trade" },
  { id: "scanner", name: "Token Scanner", blurb: "Forensic risk & OG score", href: "/intel/scan", icon: ScanSearch, accent: GOLD, category: "trade" },
  { id: "kol", name: "KOL Tracker", blurb: "Key opinion leader flows", href: "/kol-tracker", icon: Telescope, accent: CYAN, category: "trade", badge: "owner" },
  { id: "pnl", name: "PnL Tracker", blurb: "Trade performance ledger", href: "/app/pnl-tracker", icon: TrendingUp, accent: LIME, category: "trade", badge: "owner" },

  // ── Launch ─────────────────────────────────────────────
  { id: "launchpad", name: "Launchpad", blurb: "Fair-launch console", href: "/orbitxlaunch", icon: FlaskConical, accent: ORANGE, category: "launch" },
  { id: "launchstudio", name: "Launch Studio", blurb: "Token launch intel", href: "/intel/launch", icon: Rocket, accent: ORANGE, category: "launch" },
  { id: "create", name: "Create Token", blurb: "Deploy your own coin", href: "/orbitxlaunch/create", icon: Coins, accent: GOLD, category: "launch" },
  { id: "nft", name: "NFT Market", blurb: "Create, trade, collect", href: "/nft", icon: Image, accent: VIOLET, category: "launch" },
  { id: "nftcreate", name: "Mint NFT", blurb: "Mint on the marketplace", href: "/nft/create", icon: Palette, accent: PINK, category: "launch" },
  { id: "bagwork", name: "Bagwork", blurb: "Earn USDC for tasks", href: "/bagwork", icon: Briefcase, accent: LIME, category: "launch", badge: "new" },

  // ── Social ─────────────────────────────────────────────
  { id: "social", name: "Social Feed", blurb: "Posts, follows, signals", href: "/orbitx-social", icon: MessagesSquare, accent: PINK, category: "social" },
  { id: "messages", name: "Messages", blurb: "Direct messages", href: "/messages", icon: Mail, accent: BLUE, category: "social" },
  { id: "notifications", name: "Notifications", blurb: "Mentions & alerts", href: "/notifications", icon: Bell, accent: GOLD, category: "social" },
  { id: "voice", name: "Voice Rooms", blurb: "Live voice spaces", href: "/vc", icon: Mic, accent: LIME, category: "social" },
  { id: "groupchat", name: "Group Chat", blurb: "MCP group chats", href: "/gc", icon: Users, accent: CYAN, category: "social" },
  { id: "calls", name: "Calls", blurb: "OrbitX call rooms", href: "/calls", icon: Phone, accent: PINK, category: "social" },
  { id: "invite", name: "Invite", blurb: "Bring your crew", href: "/invite", icon: UserPlus, accent: VIOLET, category: "social" },

  // ── Play ───────────────────────────────────────────────
  { id: "games", name: "Games Hub", blurb: "Play Studio · missions", href: "/play", icon: Gamepad2, accent: LIME, category: "play" },
  { id: "predictions", name: "Predictions", blurb: "Prediction markets", href: "/predictions", icon: Target, accent: GOLD, category: "play" },
  { id: "city", name: "OrbitX City", blurb: "Enter the 3D crypto city", href: "/Orbitxcity", icon: Building2, accent: CYAN, category: "play" },
  { id: "onchain", name: "On-Chain World", blurb: "Living blockchain map", href: "/on-chain/world", icon: Globe, accent: BLUE, category: "play" },
  { id: "art", name: "Art Feed", blurb: "Community creations", href: "/art", icon: Brush, accent: PINK, category: "play", badge: "owner" },

  // ── Agents ─────────────────────────────────────────────
  { id: "agentplus", name: "AgentPlus", blurb: "Autonomous agent fleet", href: "/agentplus", icon: Bot, accent: VIOLET, category: "agents", badge: "new" },
  { id: "aihub", name: "AI Hub", blurb: "Chat + full MCP in-house", href: "/ai-hub", icon: BrainCircuit, accent: CYAN, category: "agents" },
  { id: "aichat", name: "AI Chat", blurb: "Alpha chat assistant", href: "/ai-chat", icon: MessageSquareText, accent: BLUE, category: "agents" },
  { id: "supercomputer", name: "Supercomputer", blurb: "MCP super-computer", href: "/supercomputer", icon: Cpu, accent: LIME, category: "agents" },
  { id: "orbitxai", name: "OrbitX AI", blurb: "Wallet-gated super app", href: "/ai", icon: Sparkles, accent: GOLD, category: "agents" },
  { id: "agents", name: "Agents World", blurb: "Meet the agent roster", href: "/orbitxagents", icon: Orbit, accent: VIOLET, category: "agents" },
  { id: "hunter", name: "Hunter Agent", blurb: "Autonomous token hunter", href: "/orbitxagents/hunter", icon: Crosshair, accent: RED, category: "agents" },

  // ── Intel / tools ──────────────────────────────────────
  { id: "devportal", name: "Developer", blurb: "APIs, keys, docs", href: "/developer", icon: CodeXml, accent: CYAN, category: "intel" },
  { id: "education", name: "Education", blurb: "Learn the game", href: "/education", icon: GraduationCap, accent: GOLD, category: "intel" },
  { id: "alerts", name: "Alerts", blurb: "Price & wallet alerts", href: "/ORBITX_DEX/alerts", icon: BellRing, accent: RED, category: "intel" },
  { id: "agentcalls", name: "Agent Calls", blurb: "Agent call ledger", href: "/agentcalls", icon: PhoneCall, accent: PINK, category: "intel" },
  { id: "discovery", name: "Discovery", blurb: "Find spaces & shows", href: "/discovery", icon: Compass, accent: BLUE, category: "intel", badge: "owner" },
  { id: "schedule", name: "Scheduler", blurb: "Plan your spaces", href: "/schedule", icon: CalendarClock, accent: VIOLET, category: "intel", badge: "owner" },
  { id: "podcasts", name: "Podcasts", blurb: "Publish & distribute", href: "/podcasts", icon: Podcast, accent: ORANGE, category: "intel", badge: "owner" },
  { id: "simulcast", name: "Simulcast", blurb: "Multistream control", href: "/simulcast", icon: Radio, accent: RED, category: "intel", badge: "owner" },
  { id: "clipexport", name: "Clip Export", blurb: "Clips → video", href: "/clip-export", icon: Clapperboard, accent: PINK, category: "intel", badge: "owner" },
  { id: "analytics", name: "Host Analytics", blurb: "Space performance", href: "/host-analytics", icon: BarChart3, accent: CYAN, category: "intel", badge: "owner" },
  { id: "autotweet", name: "Auto Tweet", blurb: "Hands-free posting", href: "/auto-tweet", icon: Send, accent: BLUE, category: "intel", badge: "owner" },

  // ── Platform ───────────────────────────────────────────
  { id: "whitepaper", name: "Whitepaper", blurb: "The OrbitX thesis", href: "/whitepaper", icon: FileText, accent: GOLD, category: "platform" },
  { id: "roadmap", name: "Roadmap", blurb: "Where we're headed", href: "/roadmap", icon: Map, accent: CYAN, category: "platform" },
  { id: "support", name: "Support", blurb: "Help center", href: "/support", icon: LifeBuoy, accent: BLUE, category: "platform" },
  { id: "install", name: "Install App", blurb: "Get the native app", href: "/install", icon: Download, accent: LIME, category: "platform" },
  { id: "telegram", name: "Telegram Bot", blurb: "OrbitX on Telegram", href: "/telegram", icon: MessageCircle, accent: CYAN, category: "platform" },
  { id: "mobile", name: "Mobile App", blurb: "Pocket OrbitX", href: "/mobile-app", icon: Smartphone, accent: VIOLET, category: "platform", badge: "owner" },
  { id: "profile", name: "Profile", blurb: "Your identity", href: "/profile", icon: User, accent: PINK, category: "platform" },
  { id: "settings", name: "Settings", blurb: "Tune everything", href: "/settings", icon: Settings, accent: GOLD, category: "platform" },
  { id: "wallet", name: "Wallets", blurb: "Manage wallets", href: "/ORBITX_DEX/wallet", icon: Wallet, accent: LIME, category: "platform" },
  { id: "stats", name: "Leaderboards", blurb: "Ranks & glory", href: "/ORBITX_DEX/leaderboard", icon: PieChart, accent: GOLD, category: "platform" },
];
