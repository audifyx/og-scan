import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function Privacy() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-1 text-sm leading-relaxed">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-5 h-5 text-accent" /><h1 className="text-2xl font-black tracking-tight">Privacy Policy</h1></div>
      <p className="text-muted mb-6">OrbitX (orbitx.world) · Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}</p>

      <p className="text-muted mb-6">OrbitX is a non-custodial, privacy-light platform. You can browse trading intelligence with no account at all. This policy explains what we collect, why, and the choices you have. We do not sell your personal data, and we never receive your private keys or seed phrase.</p>

      <Section title="1. Information we collect">
        We collect as little as possible:
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><b className="text-white">Anonymous usage</b> — aggregated page/token views, referrers and feature events to improve the product.</li>
          <li><b className="text-white">Account data</b> (only if you create one) — email, username, and anything you choose to add to your profile (display name, bio, avatar, banner, links).</li>
          <li><b className="text-white">Wallet address</b> (only if you connect one) — your public address, used for portfolio, watchlists, Pro verification and alerts you opt into.</li>
          <li><b className="text-white">User content</b> — posts, comments, chat messages, Spaces and live-stream activity you create.</li>
          <li><b className="text-white">Security signals</b> — coarse device/network information (e.g. IP and a device fingerprint) recorded on sign-in to prevent fraud, abuse and bot/spam attacks.</li>
        </ul>
      </Section>

      <Section title="2. How we use it">
        To operate and secure the platform: serve features you use, sync your profile and watchlists, deliver alerts you request, prevent abuse and rate-limit the public API, and improve performance and reliability. We do not use your data for third-party advertising.
      </Section>

      <Section title="3. Wallets & on-chain data">
        Connecting a wallet shares only your public address. Trades are signed locally by your own wallet and routed to public programs — OrbitX never takes custody of funds or keys, and copy-tracking is informational only (no auto-execution). On-chain data (balances, transactions, holders) is already public; OrbitX simply organizes and presents it.
      </Section>

      <Section title="4. Social, Spaces & live streaming">
        Posts, profiles, community messages, Spaces and live streams are shared with other users by design — treat them as public. Live audio/video is transmitted in real time via our streaming provider (LiveKit) to other participants; we do not record your camera, microphone or screen unless a recording feature is explicitly offered and enabled. You can delete your own posts at any time.
      </Section>

      <Section title="5. Cookies & local storage">
        We use minimal, functional storage only — preferences such as your watchlist, theme and session flags live in your browser's local storage, not on our servers, unless you opt into wallet- or account-synced features. No third-party advertising trackers.
      </Section>

      <Section title="6. Third-party services">
        Token and market data is fetched from third-party APIs (e.g. Jupiter, GeckoTerminal, DexScreener, CoinGecko, Helius, RugCheck, pump.fun). Authentication and data storage use Supabase; live audio/video uses LiveKit; the AI assistant performs live web searches to answer questions. Each provider is governed by its own privacy policy. We share only what is needed for these features to function.
      </Section>

      <Section title="7. Data retention & security">
        We keep data only as long as needed to provide the service and meet legal/security obligations, then delete or anonymize it. Connections are encrypted in transit, access is role-restricted, and database access is protected by row-level security. No system is perfectly secure — please use a strong, unique password and protect your wallet.
      </Section>

      <Section title="8. Your rights & choices">
        You can view and edit your profile, delete your own content, disconnect your wallet, and request export or deletion of your account data at any time by contacting us. Depending on where you live, you may have additional rights under laws such as the GDPR or CCPA; we honor valid requests.
      </Section>

      <Section title="9. Children">
        OrbitX is not directed to children under 13 (or the minimum age in your jurisdiction), and we do not knowingly collect their data. Crypto trading is high-risk and intended for adults.
      </Section>

      <Section title="10. Changes">
        We may update this policy as the platform evolves. Material changes will be announced via the official Updates channel, and the "last updated" date above will change.
      </Section>

      <Section title="11. Contact">
        Questions, data export or deletion requests? Telegram <a className="text-accent" href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer">@orbitxwrld</a>. See also our <Link to="/terms" className="text-accent">Terms of Service</Link>.
      </Section>

      <p className="text-[11px] text-muted/60 mt-6">OrbitX is a data & analytics platform. Nothing here is financial, investment, legal or tax advice.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return <div className="mb-5"><h2 className="font-bold text-white mb-1.5">{title}</h2><div className="text-muted">{children}</div></div>;
}
