import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-1 text-sm leading-relaxed">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-2xl font-black mb-2">Privacy Policy</h1>
      <p className="text-muted mb-6">Last updated {new Date().getFullYear()}</p>
      <Section title="What we collect">OG DEX is privacy-light. We collect anonymous, aggregated usage events (page/token views, referrers) to improve the product. We do not require accounts or collect names, emails, or passwords to browse.</Section>
      <Section title="Wallets">Connecting a wallet shares only your public address (used for portfolio, watchlists, and alerts you opt into). We never receive your private keys or seed phrase. Trades are signed locally by your wallet.</Section>
      <Section title="Local storage">Preferences such as your watchlist and admin/session flags are stored in your browser's local storage, not on our servers, unless you opt into wallet-synced features.</Section>
      <Section title="Third parties">Token and market data is fetched from third-party APIs (Jupiter, GeckoTerminal, DexScreener, CoinGecko, Helius, Rugcheck, pump.fun). Their use is governed by their own policies. The AI assistant performs live web searches to answer questions; queries may be sent to those providers.</Section>
      <Section title="Cookies">We use minimal, functional storage only — no third-party advertising trackers.</Section>
      <Section title="Contact">Questions or deletion requests? Telegram <a className="text-accent" href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer">@ogscanner</a>.</Section>
    </div>
  );
}
function Section({ title, children }: { title: string; children: any }) {
  return <div className="mb-4"><h2 className="font-bold text-white mb-1">{title}</h2><p className="text-muted">{children}</p></div>;
}
