import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Rocket, Zap, ArrowRight, ShoppingBag, Tag, Gift, Sparkles, Pencil, Bell,
  Code, Users, Megaphone, Crown, Layout, FileText, Radio, Crosshair, Wallet2,
  Feather, BarChart3, Shield,
} from "lucide-react";
import { getConfig } from "../lib/api";
import { CommandHero, PayWalletBar, QuickToolGrid } from "../components/DexAdvanced";
import { PLATFORM_PAY_WALLET } from "../lib/constants";

const TOTAL_DISCOUNT_SLOTS = 25;
const DISCOUNT_PCT = 35;
const STANDARD_PRICE = 40;
const EXPRESS_PRICE = 60;
const STANDARD_DISC = Math.round(STANDARD_PRICE * (1 - DISCOUNT_PCT / 100));
const EXPRESS_DISC = Math.round(EXPRESS_PRICE * (1 - DISCOUNT_PCT / 100));

type Product = {
  id: string;
  title: string;
  tag: string;
  desc: string;
  price: string;
  priceNote?: string;
  Icon: typeof Rocket;
  to: string;
  accent?: "gold" | "blue" | "green";
};

const FREE_TOOLS: Product[] = [
  { id: "meta", title: "Edit Token Metadata", tag: "Free · self-serve", desc: "Update name, symbol, image & socials from your dev wallet.", price: "$0", Icon: Pencil, to: "/metadata", accent: "blue" },
  { id: "alerts", title: "Smart Alerts", tag: "Free", desc: "Price, whale, and migration alerts to Telegram or webhooks.", price: "$0", Icon: Bell, to: "/alerts", accent: "blue" },
  { id: "embed", title: "Embed Widget", tag: "Free", desc: "One script tag — live token metrics on any website.", price: "$0", Icon: Layout, to: "/embed", accent: "blue" },
  { id: "api", title: "Public API & MCP", tag: "Free tier", desc: "REST + Model Context Protocol for AI assistants.", price: "$0", Icon: Code, to: "/api", accent: "blue" },
];

const PAID: Product[] = [
  { id: "list-std", title: "Standard Listing", tag: `${DISCOUNT_PCT}% off`, desc: "Manually reviewed directory entry on the Listed tab.", price: `$${STANDARD_DISC}`, priceNote: `$${STANDARD_PRICE} list`, Icon: Rocket, to: "/submit", accent: "gold" },
  { id: "list-exp", title: "Express Listing", tag: "6h review", desc: "Priority review — live within hours.", price: `$${EXPRESS_DISC}`, priceNote: `$${EXPRESS_PRICE} list`, Icon: Zap, to: "/submit", accent: "gold" },
  { id: "boost-6", title: "6h Boost", tag: "Featured reel", desc: "Scrolling boost reel + featured strip placement.", price: "$20", Icon: Megaphone, to: "/boost", accent: "gold" },
  { id: "boost-24", title: "24h Boost", tag: "Max visibility", desc: "Full-day featured placement across the terminal.", price: "$60", Icon: Crown, to: "/boost", accent: "gold" },
  { id: "launch", title: "Launch Token", tag: "pump.fun", desc: "Deploy from OrbitX — flat fee, vanity mint optional.", price: "$5", Icon: Sparkles, to: "/launch", accent: "green" },
  { id: "kol-nom", title: "Nominate a KOL", tag: "Community", desc: "Submit a wallet for the community KOL directory.", price: "Free", Icon: Users, to: "/kol/community", accent: "blue" },
  { id: "callout", title: "Community Callout", tag: "Social", desc: "Post a structured call on the Callouts board.", price: "Free", Icon: Radio, to: "/callouts", accent: "blue" },
  { id: "research", title: "Token Research", tag: "Intel", desc: "Deep-dive report request for any Solana mint.", price: "Contact", Icon: FileText, to: "https://t.me/orbitxwrld", accent: "blue" },
];

const accentBorder = (a?: string) =>
  a === "gold" ? "hover:border-[var(--ox-gold)]/50" : a === "green" ? "hover:border-up/50" : "hover:border-[var(--ox-blue)]/50";

export default function Store() {
  const nav = useNavigate();
  const [payWallet, setPayWallet] = useState(PLATFORM_PAY_WALLET);
  const [tab, setTab] = useState<"all" | "paid" | "free">("all");

  useEffect(() => {
    getConfig().then((c) => { if (c?.payWallet) setPayWallet(c.payWallet); }).catch(() => {});
  }, []);

  const showFree = tab === "all" || tab === "free";
  const showPaid = tab === "all" || tab === "paid";

  return (
    <div className="mx-auto max-w-5xl space-y-2">
      <CommandHero
        kicker="OrbitX terminal · marketplace"
        title="Store"
        sub="List, boost, launch, and promote your token — plus free tools for builders."
        icon={ShoppingBag}
        actions={
          <span className="pill bg-yellow-500/15 text-yellow-400 text-[11px] font-bold inline-flex items-center gap-1">
            <Tag className="w-3 h-3" /> {DISCOUNT_PCT}% off first {TOTAL_DISCOUNT_SLOTS} listings
          </span>
        }
      />

      <PayWalletBar wallet={payWallet} />

      <QuickToolGrid links={[
        { to: "/scanner", label: "OG Scanner", desc: "Forensic token scan", Icon: Crosshair },
        { to: "/pulse", label: "Pulse", desc: "Live market signals", Icon: BarChart3 },
        { to: "/wallet", label: "Wallets", desc: "Portfolio intel", Icon: Wallet2 },
        { to: "/robinhood", label: "Robinhood", desc: "HOOD chain feed", Icon: Feather },
      ]} />

      {/* Free pitch banner */}
      <div className="rounded-2xl border border-accent/30 overflow-hidden mb-4">
        <div className="relative bg-gradient-to-br from-accent2/15 via-panel to-accent/10 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold sm:text-lg">
                Got a real one? We&apos;ll feature it <span className="text-brand-gradient">free</span> for 2 days.
              </h2>
              <p className="mt-1.5 text-sm text-muted leading-relaxed">
                If your project is genuinely strong, pitch us — no payment required for a featured slot.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="dex-btn dex-btn--blue !text-xs">Telegram pitch</a>
                <a href="https://x.com/orbitx_wrldbackup" target="_blank" rel="noreferrer" className="dex-btn dex-btn--ghost !text-xs">DM on X</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "paid", "free"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`dex-cat-pill capitalize ${tab === t ? "dex-cat-pill--on" : ""}`}>{t}</button>
        ))}
      </div>

      {showPaid && (
        <>
          <h2 className="term-label mb-2 text-[var(--ox-gold-hi)]">Paid services</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {PAID.map((p) => (
              <ProductCard key={p.id} p={p} onGo={() => p.to.startsWith("http") ? window.open(p.to, "_blank") : nav(p.to)} />
            ))}
          </div>
        </>
      )}

      {showFree && (
        <>
          <h2 className="term-label mb-2 text-[var(--ox-blue-hi)]">Free tools</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {FREE_TOOLS.map((p) => (
              <ProductCard key={p.id} p={p} onGo={() => nav(p.to)} compact />
            ))}
          </div>
        </>
      )}

      <div className="rounded-xl border border-line bg-panel/50 p-4 text-xs text-muted space-y-2">
        <p className="flex items-start gap-2"><Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-accent" /><span><span className="text-white font-medium">How to pay:</span> Send SOL, USDC, or USDT to the official wallet above, then submit your tx hash on the product page.</span></p>
        <p><span className="text-white font-medium">SLA:</span> Boosts ~1–2h · Standard listing 24h · Express ~2–6h.</p>
        <p><span className="text-white font-medium">More:</span> <Link to="/whitepaper" className="text-accent hover:underline">Whitepaper</Link> · <Link to="/terms" className="text-accent hover:underline">Terms</Link></p>
      </div>
    </div>
  );
}

function ProductCard({ p, onGo, compact }: { p: Product; onGo: () => void; compact?: boolean }) {
  return (
    <button type="button" onClick={onGo} className={`card group text-left p-4 flex flex-col gap-3 transition-all ${accentBorder(p.accent)} hover:bg-white/[0.02]`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent group-hover:bg-accent/20">
          <p.Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm">{p.title}</span>
            <span className="pill bg-accent/15 text-accent text-[9px]">{p.tag}</span>
          </div>
          {!compact && <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{p.desc}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-1">
        <div>
          <span className="font-black text-lg text-white">{p.price}</span>
          {p.priceNote && <span className="ml-2 text-xs text-muted line-through">{p.priceNote}</span>}
        </div>
        <ArrowRight className="h-4 w-4 text-muted group-hover:text-accent transition-colors" />
      </div>
    </button>
  );
}
