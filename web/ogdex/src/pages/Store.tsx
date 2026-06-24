import { useNavigate } from "react-router-dom";
import { Rocket, Zap, ArrowRight, ShoppingBag, Tag } from "lucide-react";

// First 25 listing slots discount (35% off)
const TOTAL_DISCOUNT_SLOTS = 25;
const DISCOUNT_PCT = 35;

// Real prices
const STANDARD_PRICE = 40;
const EXPRESS_PRICE = 60;

// Discounted prices (35% off)
const STANDARD_DISC = Math.round(STANDARD_PRICE * (1 - DISCOUNT_PCT / 100));   // $26
const EXPRESS_DISC  = Math.round(EXPRESS_PRICE  * (1 - DISCOUNT_PCT / 100));   // $39

export default function Store() {
  const nav = useNavigate();

  return (
    <div className="max-w-xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
          <ShoppingBag className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-3xl font-black tracking-tight">OG DEX Store</h1>
        <p className="text-muted text-sm mt-2">List your token or boost your visibility to thousands of traders.</p>

        {/* Discount banner */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/25 text-yellow-400 text-sm font-semibold">
          <Tag className="w-3.5 h-3.5" />
          {DISCOUNT_PCT}% off listings for the first {TOTAL_DISCOUNT_SLOTS} slots — limited availability
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* List Token */}
        <button
          onClick={() => nav("/submit")}
          className="card group p-6 text-left hover:border-accent/50 transition-all hover:bg-accent/5 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 grid place-items-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Rocket className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="font-bold text-base">List Your Token</div>
              <div className="text-xs text-muted">Standard &amp; Express tiers</div>
            </div>
          </div>
          <p className="text-sm text-muted/80 leading-relaxed">
            Get your project added to OG DEX's token directory. Manually reviewed and approved — seen by all users on the <span className="text-white">Listed</span> tab.
          </p>

          <div className="space-y-2 text-sm">
            {/* Standard */}
            <div className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-muted/80">Standard listing</span>
              <div className="flex items-center gap-2">
                <span className="text-muted/40 line-through text-xs">${STANDARD_PRICE}</span>
                <span className="font-bold text-white">${STANDARD_DISC}</span>
                <span className="pill bg-yellow-500/15 text-yellow-400 text-[9px] font-bold">{DISCOUNT_PCT}% OFF</span>
              </div>
            </div>
            {/* Express */}
            <div className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-muted/80">Express (24h review)</span>
              <div className="flex items-center gap-2">
                <span className="text-muted/40 line-through text-xs">${EXPRESS_PRICE}</span>
                <span className="font-bold text-white">${EXPRESS_DISC}</span>
                <span className="pill bg-yellow-500/15 text-yellow-400 text-[9px] font-bold">{DISCOUNT_PCT}% OFF</span>
              </div>
            </div>
          </div>

          <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-accent group-hover:gap-2 transition-all">
            List now <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Launch Token */}
        <button
          onClick={() => nav("/launch")}
          className="card group p-6 text-left hover:border-accent/50 transition-all hover:bg-accent/5 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 grid place-items-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <Rocket className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="font-bold text-base">Launch a Token</div>
              <div className="text-xs text-muted">Deploy on pump.fun</div>
            </div>
          </div>
          <p className="text-sm text-muted/80 leading-relaxed">
            Create a token on pump.fun straight from OG DEX. Pay a flat fee, deploy in seconds, and get added to the <span className="text-white">Newly Listed</span> section automatically. Unverified, no boost.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-muted/80">Flat launch fee</span>
              <span className="font-bold text-accent">$5</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-muted/80">Pay in</span>
              <span className="font-semibold text-white text-xs">SOL / USDC / USDT</span>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-accent group-hover:gap-2 transition-all">
            Launch now <ArrowRight className="w-4 h-4" />
          </div>
        </button>

        {/* Buy Boost */}
        <button
          onClick={() => nav("/boost")}
          className="card group p-6 text-left hover:border-yellow-500/50 transition-all hover:bg-yellow-500/5 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 grid place-items-center shrink-0 group-hover:bg-yellow-500/20 transition-colors">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="font-bold text-base">Buy a Boost</div>
              <div className="text-xs text-muted">Featured reel placement</div>
            </div>
          </div>
          <p className="text-sm text-muted/80 leading-relaxed">
            Put your token in the scrolling boost reel and Featured Daily section. Seen by every visitor. Pay SOL or stablecoin — manually verified and activated.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-muted/80">6-hour boost</span>
              <span className="font-bold text-yellow-400">$20</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2">
              <span className="text-muted/80">24-hour boost</span>
              <span className="font-bold text-yellow-400">$60</span>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-1 text-sm font-semibold text-yellow-400 group-hover:gap-2 transition-all">
            Get boosted <ArrowRight className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* FAQ */}
      <div className="mt-8 card p-4 text-xs text-muted space-y-2">
        <p><span className="text-white font-medium">How do I pay?</span> — Send SOL (or USDC/USDT) to our payment wallet and submit the tx hash. We verify on-chain.</p>
        <p><span className="text-white font-medium">How fast is approval?</span> — Boosts activate within 1–2 hours. Standard listings within 24h, Express within 2h.</p>
        <p><span className="text-white font-medium">Questions?</span> — DM us on <a href="https://t.me/ogscanner" target="_blank" rel="noreferrer" className="text-accent hover:underline">Telegram</a>.</p>
      </div>
    </div>
  );
}
