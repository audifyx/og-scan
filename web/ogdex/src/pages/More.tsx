import { Link } from "react-router-dom";
import {
  Rocket, ShoppingBag, Zap, Send, Bell, Megaphone, FileText, Code,
  Trophy, BookOpen, Map, Activity, Copy, Users, Crosshair, Wrench, Sparkles,
} from "lucide-react";

type Item = { to: string; label: string; desc: string; Icon: typeof Rocket };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Trade & Launch",
    items: [
      { to: "/new", label: "New Launches", desc: "Freshest pump.fun launches", Icon: Sparkles },
      { to: "/launch", label: "Launch a Token", desc: "Fair-launch with safeguards", Icon: Rocket },
      { to: "/store", label: "Store · List & Boost", desc: "Featured placement", Icon: ShoppingBag },
      { to: "/boost", label: "Boost", desc: "Promote a token", Icon: Zap },
      { to: "/submit", label: "Submit Token", desc: "Add your project", Icon: Send },
    ],
  },
  {
    title: "Tools & Data",
    items: [
      { to: "/tools", label: "Tools", desc: "Sniper, scanners & calculators", Icon: Wrench },
      { to: "/scanner", label: "Scanner", desc: "Rug & risk forensics", Icon: Crosshair },
      { to: "/metadata", label: "Metadata", desc: "Update token metadata", Icon: FileText },
      { to: "/alerts", label: "Smart Alerts", desc: "Get pinged on moves", Icon: Bell },
      { to: "/copy-trade", label: "Copy Tracking", desc: "Track wallets' trades", Icon: Copy },
    ],
  },
  {
    title: "Community",
    items: [
      { to: "/callouts", label: "Callouts", desc: "Community calls", Icon: Megaphone },
      { to: "/kol", label: "KOL Scanner", desc: "Smart money & KOLs", Icon: Users },
      { to: "/kol/community", label: "Community KOLs", desc: "Nominated KOL lists", Icon: Users },
      { to: "/leaderboard", label: "Leaderboard", desc: "Top traders by PnL", Icon: Trophy },
    ],
  },
  {
    title: "Resources",
    items: [
      { to: "/api", label: "API Docs", desc: "Public API & MCP", Icon: Code },
      { to: "/whitepaper", label: "Whitepaper", desc: "How OrbitX works", Icon: BookOpen },
      { to: "/roadmap", label: "Roadmap", desc: "What's shipping", Icon: Map },
      { to: "/status", label: "Status", desc: "System health", Icon: Activity },
    ],
  },
];

export default function More() {
  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 space-y-8">
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-black text-white">More</h1>
        <span className="pill bg-accent/15 text-accent text-[10px] font-bold ml-1">All tools</span>
      </div>

      {GROUPS.map((g) => (
        <section key={g.title} className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="group flex items-center gap-3 rounded-2xl border border-line bg-panel2/50 p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-panel2/80"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent/12 text-accent transition group-hover:scale-105">
                  <it.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white">{it.label}</span>
                  <span className="block truncate text-[12px] text-muted">{it.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
