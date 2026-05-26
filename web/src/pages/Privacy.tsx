import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const Privacy = () => (
  <AppLayout>
    <PageHeader title="Privacy Policy" description="Last updated: April 2026" />
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
        {[
          { title: "1. Information We Collect", content: "We collect information you provide directly, such as email address and username when creating an account. We also collect usage data including tools accessed and feature interactions to improve the platform." },
          { title: "2. How We Use Your Information", content: "Your information is used to provide and maintain the Sol Tools platform, personalize your experience, communicate updates, and ensure platform security. We do not sell your personal data." },
          { title: "3. Data Storage & Security", content: "Your data is stored securely using industry-standard encryption. We use Lovable Cloud infrastructure with enterprise-grade security measures including encrypted connections and secure authentication." },
          { title: "4. Cookies & Tracking", content: "We use essential cookies for authentication and session management. Analytics cookies help us understand platform usage to improve features. You can control cookie preferences in your browser settings." },
          { title: "5. Third-Party Services", content: "We integrate with DexScreener for market data, Helius for Solana blockchain data, and AI services for analysis tools. These services have their own privacy policies." },
          { title: "6. Your Rights", content: "You can access, update, or delete your account data at any time through Settings. You may request a full data export or account deletion by contacting support." },
          { title: "7. Usage Data", content: "Feature usage data is tracked to improve platform performance and security. No personal financial information is ever stored." },
          { title: "8. Trading Risk Disclaimer", content: "Sol Tools provides analytical tools and information only. We do not provide financial advice. Cryptocurrency trading carries significant risk. Users are solely responsible for their trading decisions." },
          { title: "9. Community Data", content: "Posts, messages, and interactions in Communities and Trading Lobbies are visible to other members. Voice chat data is processed in real-time and not stored. Public profiles are visible to all users." },
          { title: "10. Account Deletion", content: "You can permanently delete your account at any time from your Profile → Settings tab. This will remove all your data including posts, community memberships, and liked/bookmarked content. This action is irreversible." },
          { title: "11. Contact", content: "For privacy inquiries, reach us through in-app support or via our community channels." },
        ].map((s, i) => (
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
