import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const SECTIONS: { title: string; content: string }[] = [
  { title: "Overview", content: "OrbitX (orbitx.world) is a non-custodial, privacy-light platform. You can browse trading intelligence with no account at all. We do not sell your personal data, and we never receive your private keys or seed phrase. This policy explains what we collect, why, and the choices you have." },
  { title: "1. Information We Collect", content: "We collect as little as possible: anonymous, aggregated usage events (page/token views, referrers, feature interactions) to improve the product; account data only if you create one (email, username, and anything you add to your profile such as display name, bio, avatar, banner and links); your public wallet address only if you connect one; the content you create (posts, comments, chat, Spaces and live-stream activity); and coarse security signals (IP and a device fingerprint) recorded on sign-in to prevent fraud, spam and abuse." },
  { title: "2. How We Use Your Information", content: "To operate and secure OrbitX: provide and personalize features, sync your profile and watchlists, deliver alerts you opt into, prevent abuse and rate-limit our public API, and improve performance and reliability. We do not use your data for third-party advertising and we do not sell it." },
  { title: "3. Wallets & On-Chain Data", content: "Connecting a wallet shares only your public address (used for portfolio, watchlists, Pro verification and opt-in alerts). Trades are signed locally by your own wallet and routed to public programs — OrbitX never takes custody of funds or keys. Copy-tracking is informational only, with no auto-execution. On-chain data is already public; OrbitX simply organizes and presents it." },
  { title: "4. Social, Spaces & Live Streaming", content: "Posts, profiles, community messages, voice Spaces and live streams are shared with other users by design — treat them as public. Live audio/video is transmitted in real time via our streaming provider (LiveKit) to other participants; we do not record your camera, microphone or screen unless a recording feature is explicitly offered and enabled. You can delete your own content at any time." },
  { title: "5. Data Storage & Security", content: "Authentication and data are handled by Supabase. Connections are encrypted in transit, access is role-restricted, and database access is protected by row-level security. We retain data only as long as needed to provide the service and meet legal/security obligations, then delete or anonymize it. No system is perfectly secure — use a strong, unique password and protect your wallet." },
  { title: "6. Cookies & Local Storage", content: "We use minimal, functional storage only. Preferences such as your watchlist, theme and session flags are kept in your browser's local storage, not on our servers, unless you opt into account- or wallet-synced features. We do not use third-party advertising trackers." },
  { title: "7. Third-Party Services", content: "Market and token data is fetched from third-party APIs (e.g. Jupiter, GeckoTerminal, DexScreener, CoinGecko, Helius, RugCheck, pump.fun). Live audio/video uses LiveKit; authentication/storage uses Supabase; the AI assistant performs live web searches to answer questions. Each provider has its own privacy policy, and we share only what is needed for these features to function." },
  { title: "8. Your Rights & Choices", content: "You can view and edit your profile, delete your own content, disconnect your wallet, and request a full export or deletion of your account data at any time via Settings or by contacting support. Depending on where you live you may have additional rights under laws such as the GDPR or CCPA; we honor valid requests." },
  { title: "9. Children", content: "OrbitX is not directed to children under 13 (or the minimum age in your jurisdiction) and we do not knowingly collect their data. Cryptocurrency trading is high-risk and intended for adults." },
  { title: "10. Trading Risk Disclaimer", content: "OrbitX provides analytical tools and information only. Nothing on the platform is financial, investment, legal or tax advice. Cryptocurrency trading carries significant risk; you are solely responsible for your decisions." },
  { title: "11. Changes & Contact", content: "We may update this policy as the platform evolves; material changes are announced via our official Updates channel and the date below changes. For privacy inquiries or deletion requests, reach us through in-app support or our community channels." },
];

const Privacy = () => (
  <AppLayout>
    <PageHeader title="Privacy Policy" description={`OrbitX · Last updated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}`} />
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
        {SECTIONS.map((s, i) => (
          <Card key={i} className="glass-card">
            <CardHeader><CardTitle className="text-base">{s.title}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p></CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  </AppLayout>
);

export default Privacy;
