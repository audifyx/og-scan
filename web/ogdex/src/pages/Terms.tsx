import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-1 text-sm leading-relaxed">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-2xl font-black mb-2">Terms of Service</h1>
      <p className="text-muted mb-6">Last updated {new Date().getFullYear()}</p>

      <div className="card border border-down/30 bg-down/5 p-4 mb-6 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-down shrink-0 mt-0.5" />
        <p className="text-white/85"><b>Not financial advice.</b> OG DEX is an informational and analytics tool. Nothing here is financial, investment, legal, or tax advice. Crypto assets are extremely volatile and high-risk — you can lose everything. Always do your own research and never invest more than you can afford to lose.</p>
      </div>

      <Section title="What OG DEX is">OG DEX is purely a data &amp; analytics platform. It gives access to already-public on-chain data, presented in a higher-quality design — our tools tell you what most tools hide. Built on the recommendations of the crypto space online, it's a tool this space has needed for a long while. We are not responsible for what you buy or sell. OG DEX is updated weekly; read our Updates channel (t.me/OrbitXupdates) for changes and message Support (t.me/orbitxwrld) with questions.</Section>
            <Section title="1. Acceptance">By accessing OG DEX (ogscan.fun), its app, API, or bots, you agree to these terms. If you do not agree, do not use the service.</Section>
      <Section title="2. Informational use only">All data — token scores, risk flags, holder/whale/KOL labels, AI summaries, signals, trending lists, all-time-high figures and forensics — is provided "as is" for informational purposes. It is aggregated from third-party sources (Jupiter, GeckoTerminal, DexScreener, CoinGecko, Helius, Rugcheck, pump.fun and others) and may be delayed, incomplete, or inaccurate. We do not guarantee correctness.</Section>
      <Section title="3. No advice, no solicitation">Nothing on OG DEX is a recommendation to buy, sell, or hold any asset, nor a solicitation or offer. AI responses are automated and may be wrong. You are solely responsible for your own decisions.</Section>
      <Section title="4. Non-custodial">OG DEX never takes custody of your funds or private keys. Any trade you execute is non-custodial, signed by your own wallet, and routed to third-party programs. We are not responsible for on-chain outcomes, slippage, MEV, failed transactions, or smart-contract risk.</Section>
      <Section title="5. No liability">To the fullest extent permitted by law, OG DEX and its operators are not liable for any losses or damages arising from use of the service, reliance on its data, or third-party services and tokens it references.</Section>
      <Section title="6. Acceptable use & API">Do not abuse, scrape excessively, or attempt to disrupt the service. The public API is rate-limited; sustained heavy use may be throttled or require a key. We may change or discontinue any feature at any time.</Section>
      <Section title="7. Third-party tokens">Listings, boosts, and trending entries do not imply endorsement. Tokens may be scams or rug pulls. Verify everything yourself.</Section>
      <Section title="8. Changes">We may update these terms. Continued use after changes constitutes acceptance.</Section>
      <p className="text-muted mt-6">Questions? Reach us on Telegram <a className="text-accent" href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer">@ogscanner</a>.</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: any }) {
  return <div className="mb-4"><h2 className="font-bold text-white mb-1">{title}</h2><p className="text-muted">{children}</p></div>;
}
