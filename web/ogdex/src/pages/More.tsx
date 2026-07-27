import { Link } from "react-router-dom";
import {
  Rocket, ShoppingBag, Zap, Send, Bell, Megaphone, FileText, Code,
  Trophy, BookOpen, Map, Activity, Copy, Users, Crosshair, Wrench, Sparkles, LayoutGrid,
} from "lucide-react";
import { PageHero, DexPanel } from "../components/PageShell";

type Item = { to: string; label: string; desc: string; Icon: typeof Rocket };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Trade & Launch",
    items: [
      { to: "/launchpad", label: "Launchpad", desc: "Real OrbitX launch desk", Icon: Rocket },
      { to: "/tools?tab=create", label: "Create token", desc: "Multi-chain DEX launcher", Icon: Sparkles },
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
    <div className="mx-auto max-w-[1080px] space-y-8">
      <PageHero kicker="Terminal hub" title="More" sub="Every tool, doc, and community surface in one place." icon={LayoutGrid} />

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="term-label mb-3">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((it) => (
              <Link key={it.to} to={it.to} className="group">
                <DexPanel className="flex items-center gap-3 transition hover:border-[rgba(96,165,250,0.4)] hover:-translate-y-0.5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--ox-silver-dim)] bg-black/40 text-[var(--ox-gold-hi)]">
                    <it.Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-white">{it.label}</span>
                    <span className="block truncate text-[12px] text-[var(--ox-silver)]">{it.desc}</span>
                  </span>
                </DexPanel>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
